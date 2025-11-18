// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  const [admin, guardia, medico, social, juez] = await ethers.getSigners();
  console.log("Admin:", admin.address);
  console.log("Guardia:", guardia.address);
  console.log("Medico :", medico.address);
  console.log("Social :", social.address);
  console.log("Juez   :", juez.address);

  const EventRegistry = await ethers.getContractFactory("EventRegistry", admin);
  const registry = await EventRegistry.deploy(ethers.ZeroAddress);
  await registry.waitForDeployment();
  console.log("EventRegistry:", await registry.getAddress());

  const InmateStateLedger = await ethers.getContractFactory("InmateStateLedger", admin);
  const ledger = await InmateStateLedger.deploy(admin.address, await registry.getAddress());
  await ledger.waitForDeployment();
  console.log("InmateStateLedger:", await ledger.getAddress());

  await (await registry.grantLedger(await ledger.getAddress())).wait();

  const ROL_GUARDIA = ethers.id("ROL_GUARDIA");
  const ROL_MEDICO  = ethers.id("ROL_MEDICO");
  const ROL_SOCIAL  = ethers.id("ROL_SOCIAL");
  const ROL_ADMIN   = ethers.id("ROL_ADMIN");
  const ROL_JUEZ    = ethers.id("ROL_JUEZ");

  // Admin conserva DEFAULT_ADMIN_ROLE y ROL_ADMIN
  await (await ledger.otorgarRol(ROL_ADMIN,   admin.address)).wait();

  // Cada rol a su signer específico
  await (await ledger.otorgarRol(ROL_GUARDIA, guardia.address)).wait();
  await (await ledger.otorgarRol(ROL_MEDICO,  medico.address)).wait();
  await (await ledger.otorgarRol(ROL_SOCIAL,  social.address)).wait();
  await (await ledger.otorgarRol(ROL_JUEZ,    juez.address)).wait();

  console.log("Roles iniciales asignados a cuentas distintas.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

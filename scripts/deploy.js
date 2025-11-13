const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const EventRegistry = await ethers.getContractFactory("EventRegistry");
  const registry = await EventRegistry.deploy(ethers.ZeroAddress);
  await registry.waitForDeployment();
  console.log("EventRegistry:", await registry.getAddress());

  const InmateStateLedger = await ethers.getContractFactory("InmateStateLedger");
  const ledger = await InmateStateLedger.deploy(deployer.address, await registry.getAddress());
  await ledger.waitForDeployment();
  console.log("InmateStateLedger:", await ledger.getAddress());

  await (await registry.grantLedger(await ledger.getAddress())).wait();

  const ROL_GUARDIA = ethers.id("ROL_GUARDIA");
  const ROL_MEDICO  = ethers.id("ROL_MEDICO");
  const ROL_SOCIAL  = ethers.id("ROL_SOCIAL");
  const ROL_ADMIN   = ethers.id("ROL_ADMIN");
  const ROL_JUEZ    = ethers.id("ROL_JUEZ");

  await (await ledger.otorgarRol(ROL_GUARDIA, deployer.address)).wait();
  await (await ledger.otorgarRol(ROL_MEDICO,  deployer.address)).wait();
  await (await ledger.otorgarRol(ROL_SOCIAL,  deployer.address)).wait();
  await (await ledger.otorgarRol(ROL_ADMIN,   deployer.address)).wait();
  await (await ledger.otorgarRol(ROL_JUEZ,    deployer.address)).wait();

  console.log("Roles iniciales asignados.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

const { expect } = require("chai");
const { ethers } = require("hardhat");

const idHash = (txt) => ethers.keccak256(ethers.toUtf8Bytes(txt));
const dummyHash = idHash("evidencia");

describe("InmateStateLedger", function () {
  let registry, ledger, owner, usr;

  beforeEach(async () => {
    [owner, usr] = await ethers.getSigners();

    const EventRegistry = await ethers.getContractFactory("EventRegistry");
    registry = await EventRegistry.deploy(ethers.ZeroAddress);
    await registry.waitForDeployment();

    const InmateStateLedger = await ethers.getContractFactory("InmateStateLedger");
    ledger = await InmateStateLedger.deploy(owner.address, await registry.getAddress());
    await ledger.waitForDeployment();

    await (await registry.grantLedger(await ledger.getAddress())).wait();

    const roles = ["ROL_GUARDIA","ROL_MEDICO","ROL_SOCIAL","ROL_ADMIN","ROL_JUEZ"].map(ethers.id);
    for (const r of roles) await (await ledger.otorgarRol(r, owner.address)).wait();
  });

  it("flujo completo", async () => {
    const interno = idHash("interno-1");

    await expect(ledger.ingresarInterno(interno, "Unidad A", dummyHash))
      .to.emit(ledger, "EstadoActualizado");

    let rec = await ledger.verInterno(interno);
    expect(rec.estadoActual).to.equal(1);

    await expect(ledger.aplicarSancion(interno, "incumplimiento", dummyHash))
      .to.emit(ledger, "EstadoActualizado");
    rec = await ledger.verInterno(interno);
    expect(rec.estadoActual).to.equal(3);

    await expect(ledger.cumplirSancion(interno, "cumplida", dummyHash))
      .to.emit(ledger, "EstadoActualizado");
    rec = await ledger.verInterno(interno);
    expect(rec.estadoActual).to.equal(1);

    await expect(ledger.iniciarPrograma(interno, "educacion", dummyHash))
      .to.emit(ledger, "EstadoActualizado");
    rec = await ledger.verInterno(interno);
    expect(rec.estadoActual).to.equal(4);

    await expect(ledger.finalizarPrograma(interno, "aprobado", dummyHash))
      .to.emit(ledger, "EstadoActualizado");
    rec = await ledger.verInterno(interno);
    expect(rec.estadoActual).to.equal(1);

    await expect(ledger.ordenarTraslado(interno, "Unidad B", dummyHash))
      .to.emit(ledger, "EstadoActualizado");
    rec = await ledger.verInterno(interno);
    expect(rec.estadoActual).to.equal(2);

    await expect(ledger.arriboDestino(interno, "Unidad B", dummyHash))
      .to.emit(ledger, "EstadoActualizado");
    rec = await ledger.verInterno(interno);
    expect(rec.estadoActual).to.equal(1);

    await expect(ledger.liberar(interno, "resolucion-123", dummyHash))
      .to.emit(ledger, "EstadoActualizado");
    rec = await ledger.verInterno(interno);
    expect(rec.estadoActual).to.equal(5);
  });

  it("bloquea transiciones inválidas", async () => {
    const interno = idHash("interno-2");
    await ledger.ingresarInterno(interno, "U-A", dummyHash);

    await expect(
      ledger.arriboDestino(interno, "U-B", dummyHash)
    ).to.be.revertedWithCustomError(ledger, "InvalidaTransicion");
  });

  it("enforce RBAC", async () => {
    const interno = idHash("interno-3");
    await expect(
      ledger.connect(usr).ingresarInterno(interno, "U-A", dummyHash)
    ).to.be.reverted;
  });
});

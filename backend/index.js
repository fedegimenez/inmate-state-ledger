// backend/index.js
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());


const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Usá SIEMPRE el mnemonic del nodo de Hardhat (prefunde las cuentas 0..19)
// --- HD desde la seed root ---
const MNEMONIC = process.env.MNEMONIC || "test test test test test test test test test test test junk";

// 1) Obtenemos la seed root (profundidad 0)
const root = ethers.HDNodeWallet.fromSeed(
  ethers.Mnemonic.fromPhrase(MNEMONIC).computeSeed()
);

// 2) Helper de path por índice
const PATH = (i) => `m/44'/60'/0'/0/${i}`;

// 3) Derivamos cada cuenta y la conectamos al provider
function walletFromIndex(i) {
  return root.derivePath(PATH(i)).connect(provider);
}

const ROLE_INDEX = { ADMIN: 0, GUARDIA: 1, MEDICO: 2, SOCIAL: 3, JUEZ: 4 };

const wallets = {
  ADMIN:   walletFromIndex(ROLE_INDEX.ADMIN),
  GUARDIA: walletFromIndex(ROLE_INDEX.GUARDIA),
  MEDICO:  walletFromIndex(ROLE_INDEX.MEDICO),
  SOCIAL:  walletFromIndex(ROLE_INDEX.SOCIAL),
  JUEZ:    walletFromIndex(ROLE_INDEX.JUEZ),
};

// Debug: imprimí para verificar que salen distintas
console.log("ADMIN  :", wallets.ADMIN.address);
console.log("GUARDIA:", wallets.GUARDIA.address);
console.log("MEDICO :", wallets.MEDICO.address);
console.log("SOCIAL :", wallets.SOCIAL.address);
console.log("JUEZ   :", wallets.JUEZ.address);


// --- ABIs mínimos ---
const ledgerAbi = [
  "function verInterno(bytes32) view returns (tuple(bytes32 idInternoHash,string nombre,uint8 estadoActual,uint256 fechaUltimaActualizacion,address rolUltimoActor,string ubicacionActual,uint256[] eventos,bytes32 hashExpediente,bool existe))",
  "function ingresarInterno(bytes32,string,string,bytes32)",
  "function ordenarTraslado(bytes32,string,bytes32)",
  "function arriboDestino(bytes32,string,bytes32)",
  "function aplicarSancion(bytes32,string,bytes32)",
  "function cumplirSancion(bytes32,string,bytes32)",
  "function iniciarPrograma(bytes32,string,bytes32)",
  "function finalizarPrograma(bytes32,string,bytes32)",
  "function liberar(bytes32,string,bytes32)",
  "function registrarParteMedico(bytes32,string,bytes32)"
];
const registryAbi = [
  "function verEvento(uint256) view returns (tuple(uint256 id,bytes32 idInternoHash,uint8 tipo,string descripcion,uint256 fechaRegistro,address rolEmisor,bytes32 hashEvento,uint8 estadoAsociado))"
];

// Contratos RO (lectura)
const ledgerRO   = new ethers.Contract(process.env.LEDGER_ADDRESS,   ledgerAbi, provider);
const registryRO = new ethers.Contract(process.env.REGISTRY_ADDRESS, registryAbi, provider);

// helper: contrato RW (escritura) por rol
function ledgerRW(role) {
  const w = wallets[role?.toUpperCase()];
  if (!w) throw new Error(`Rol inválido o no soportado: ${role}`);
  return new ethers.Contract(process.env.LEDGER_ADDRESS, ledgerAbi, w);
}

const idToHash = (id) => ethers.keccak256(ethers.toUtf8Bytes(id));
const strHash = (s) => ethers.keccak256(ethers.toUtf8Bytes(s || ""));

// Extraer rol de header o body
function getRole(req) {
  return (req.headers["x-role"] || req.body.role || "").toString().toUpperCase();
}

// --------------- RUTAS ---------------

// GET estado + timeline
app.get("/api/interno/:id", async (req, res) => {
  try {
    const key = idToHash(req.params.id);
    const rec = await ledgerRO.verInterno(key);
    if (!rec.existe) return res.json({ existe: false });

    const eventos = [];
    for (const evId of rec.eventos) {
      const ev = await registryRO.verEvento(evId);
      eventos.push({
        id: Number(ev.id),
        tipo: Number(ev.tipo),
        descripcion: ev.descripcion,
        fechaRegistro: Number(ev.fechaRegistro),
        rolEmisor: ev.rolEmisor,
        estadoAsociado: Number(ev.estadoAsociado),
        hashEvento: ev.hashEvento
      });
    }

    res.json({
      existe: true,
      id: req.params.id,
      idInternoHash: rec.idInternoHash,
      nombre: rec.nombre,
      estadoActual: Number(rec.estadoActual),
      fechaUltimaActualizacion: Number(rec.fechaUltimaActualizacion),
      rolUltimoActor: rec.rolUltimoActor,
      ubicacionActual: rec.ubicacionActual,
      hashExpediente: rec.hashExpediente,
      eventos
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function write(txp, res) {
  const tx = await txp;
  const r  = await tx.wait();
  res.json({ txHash: r.hash, blockNumber: r.blockNumber });
}

const EST = { NONE:0, INGRESADO:1, EN_TRASLADO:2, SANCIONADO:3, EN_REHABILITACION:4, LIBERADO:5 };
async function getRecOrNull(idStr) {
  const key = idToHash(idStr);
  const rec = await ledgerRO.verInterno(key);
  return rec.existe ? { key, rec } : null;
}

// --- Endpoints de escritura: ahora requieren rol ---
app.post("/api/ingresar", async (req, res) => {
  try {
    const role = getRole(req);              // GUARDIA
    const L = ledgerRW(role);
    const { id, nombre, ubicacion, descripcion } = req.body;

    const found = await getRecOrNull(id);
    if (found) return res.status(409).json({ error: "El interno ya existe" });

    await write(
      L.ingresarInterno(idToHash(id), nombre || "", ubicacion || "", strHash(descripcion)),
      res
    );
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/traslado", async (req, res) => {
  try {
    const role = getRole(req);              // ADMIN
    const L = ledgerRW(role);
    const { id, destino, descripcion } = req.body;

    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });

    const st = Number(got.rec.estadoActual);
    if (![EST.INGRESADO, EST.SANCIONADO, EST.EN_REHABILITACION].includes(st)) {
      return res.status(409).json({ error: `Transición inválida: estado ${st}` });
    }

    await write(L.ordenarTraslado(got.key, destino, strHash(descripcion)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/arribo", async (req, res) => {
  try {
    const role = getRole(req);              // GUARDIA
    const L = ledgerRW(role);
    const { id, ubicacion, descripcion } = req.body;

    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });

    const st = Number(got.rec.estadoActual);
    if (st !== EST.EN_TRASLADO) return res.status(409).json({ error: "Se requiere EN_TRASLADO" });

    await write(L.arriboDestino(got.key, ubicacion, strHash(descripcion)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sancion", async (req, res) => {
  try {
    const role = getRole(req);              // ADMIN
    const L = ledgerRW(role);
    const { id, motivo } = req.body;

    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });
    if (Number(got.rec.estadoActual) !== EST.INGRESADO)
      return res.status(409).json({ error: "Se requiere INGRESADO" });

    await write(L.aplicarSancion(got.key, motivo, strHash(motivo)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/cumplir", async (req, res) => {
  try {
    const role = getRole(req);              // ADMIN
    const L = ledgerRW(role);
    const { id, detalle } = req.body;

    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });
    if (Number(got.rec.estadoActual) !== EST.SANCIONADO)
      return res.status(409).json({ error: "Se requiere SANCIONADO" });

    await write(L.cumplirSancion(got.key, detalle, strHash(detalle)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/iniciar-programa", async (req, res) => {
  try {
    const role = getRole(req);              // SOCIAL
    const L = ledgerRW(role);
    const { id, programa } = req.body;

    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });
    if (Number(got.rec.estadoActual) !== EST.INGRESADO)
      return res.status(409).json({ error: "Se requiere INGRESADO" });

    await write(L.iniciarPrograma(got.key, programa, strHash(programa)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/finalizar-programa", async (req, res) => {
  try {
    const role = getRole(req);              // SOCIAL
    const L = ledgerRW(role);
    const { id, resultado } = req.body;

    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });
    if (Number(got.rec.estadoActual) !== EST.EN_REHABILITACION)
      return res.status(409).json({ error: "Se requiere EN_REHABILITACION" });

    await write(L.finalizarPrograma(got.key, resultado, strHash(resultado)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/liberar", async (req, res) => {
  try {
    const role = getRole(req);              // JUEZ
    const L = ledgerRW(role);
    const { id, resolucion } = req.body;

    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });
    if (Number(got.rec.estadoActual) !== EST.EN_REHABILITACION)
      return res.status(409).json({ error: "Se requiere EN_REHABILITACION" });

    await write(L.liberar(got.key, resolucion, strHash(resolucion)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/parte-medico", async (req, res) => {
  try {
    const role = getRole(req);              // MEDICO
    const L = ledgerRW(role);
    const { id, informe } = req.body;

    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });

    await write(L.registrarParteMedico(got.key, informe || "", strHash(informe)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(process.env.PORT || 4000, () => {
  console.log("API on", process.env.PORT || 4000);
});

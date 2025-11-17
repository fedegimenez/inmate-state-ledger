const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const path = require("path")
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// ABI mínimos
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
  "function registrarParteMedico(bytes32,string,bytes32)" // <-- nuevo
];
const registryAbi = [
  "function verEvento(uint256) view returns (tuple(uint256 id,bytes32 idInternoHash,uint8 tipo,string descripcion,uint256 fechaRegistro,address rolEmisor,bytes32 hashEvento,uint8 estadoAsociado))"
];

const ledger = new ethers.Contract(process.env.LEDGER_ADDRESS, ledgerAbi, wallet);
const registry = new ethers.Contract(process.env.REGISTRY_ADDRESS, registryAbi, wallet);

const idToHash = (id) => ethers.keccak256(ethers.toUtf8Bytes(id));
const strHash = (s) => ethers.keccak256(ethers.toUtf8Bytes(s || ""));

// GET estado + timeline de un interno
app.get("/api/interno/:id", async (req, res) => {
  try {
    const key = idToHash(req.params.id);
    const rec = await ledger.verInterno(key);
    if (!rec.existe) return res.json({ existe: false });

    const eventos = [];
    for (const evId of rec.eventos) {
      const ev = await registry.verEvento(evId);
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
      nombre: rec.nombre,                 // <-- nuevo
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

// helpers genéricos de write
async function write(txp, res) {
  const tx = await txp;
  const r = await tx.wait();
  res.json({ txHash: r.hash, blockNumber: r.blockNumber });
}
const EST = { NONE:0, INGRESADO:1, EN_TRASLADO:2, SANCIONADO:3, EN_REHABILITACION:4, LIBERADO:5 };
async function getRecOrNull(idStr) {
  const key = idToHash(idStr);
  const rec = await ledger.verInterno(key);
  return rec.existe ? { key, rec } : null;
}

app.post("/api/parte-medico", async (req, res) => {
  try {
    const { id, informe } = req.body;
    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });
    await write(ledger.registrarParteMedico(got.key, informe || "", strHash(informe)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/ingresar", async (req, res) => {
  try {
    const { id, nombre, ubicacion, descripcion } = req.body;
    const found = await getRecOrNull(id);
    if (found) return res.status(409).json({ error: "El interno ya existe" });
    await write(
      ledger.ingresarInterno(idToHash(id), nombre || "", ubicacion || "", strHash(descripcion)),
      res
    );
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/traslado", async (req, res) => {
  try {
    const { id, destino, descripcion } = req.body;
    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });

    const st = Number(got.rec.estadoActual);
    if (![EST.INGRESADO, EST.SANCIONADO, EST.EN_REHABILITACION].includes(st)) {
      return res.status(409).json({
        error: `Transición inválida: estado actual ${st}, se requiere INGRESADO/SANCIONADO/EN_REHABILITACION`
      });
    }

    await write(ledger.ordenarTraslado(got.key, destino, strHash(descripcion)), res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


app.post("/api/arribo", async (req, res) => {
  try {
    const { id, ubicacion, descripcion } = req.body;
    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });
    const st = Number(got.rec.estadoActual);
    if (st !== EST.EN_TRASLADO)
      return res.status(409).json({ error: `Transición inválida: estado actual ${st}, se requiere EN_TRASLADO` });
    await write(ledger.arriboDestino(got.key, ubicacion, strHash(descripcion)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sancion", async (req, res) => {
  try {
    const { id, motivo } = req.body;
    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });
    if (Number(got.rec.estadoActual) !== EST.INGRESADO)
      return res.status(409).json({ error: "Transición inválida: se requiere INGRESADO" });
    await write(ledger.aplicarSancion(got.key, motivo, strHash(motivo)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/cumplir", async (req, res) => {
  try {
    const { id, detalle } = req.body;
    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });
    if (Number(got.rec.estadoActual) !== EST.SANCIONADO)
      return res.status(409).json({ error: "Transición inválida: se requiere SANCIONADO" });
    await write(ledger.cumplirSancion(got.key, detalle, strHash(detalle)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/iniciar-programa", async (req, res) => {
  try {
    const { id, programa } = req.body;
    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });
    if (Number(got.rec.estadoActual) !== EST.INGRESADO)
      return res.status(409).json({ error: "Transición inválida: se requiere INGRESADO" });
    await write(ledger.iniciarPrograma(got.key, programa, strHash(programa)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/finalizar-programa", async (req, res) => {
  try {
    const { id, resultado } = req.body;
    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });
    if (Number(got.rec.estadoActual) !== EST.EN_REHABILITACION)
      return res.status(409).json({ error: "Transición inválida: se requiere EN_REHABILITACION" });
    await write(ledger.finalizarPrograma(got.key, resultado, strHash(resultado)), res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/liberar", async (req, res) => {
  try {
    const { id, resolucion } = req.body;
    const got = await getRecOrNull(id);
    if (!got) return res.status(404).json({ error: "Interno no existe" });

    const st = Number(got.rec.estadoActual);
    if (st !== EST.EN_REHABILITACION) {
      return res.status(409).json({ error: "Transición inválida: se requiere EN_REHABILITACION" });
    }

    await write(ledger.liberar(got.key, resolucion, strHash(resolucion)), res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


app.listen(process.env.PORT || 4000, () => {
  console.log("API on", process.env.PORT || 4000);
});

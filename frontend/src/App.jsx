import { useEffect, useMemo, useState } from "react";
import { acciones, ejecutar, getInterno } from "./api";
import "./App.css";

const ESTADOS = ["NONE","INGRESADO","EN_TRASLADO","SANCIONADO","EN_REHABILITACION","LIBERADO"];
const TIPOS = [
  "Ingreso",
  "OrdenDeTraslado",
  "ArriboADestino",
  "AplicarSancion",
  "CumplirSancion",
  "IniciarPrograma",
  "FinalizarPrograma",
  "Liberacion",
  "ParteMedico" // <-- nuevo
];

function shortHex(h = "", head = 6, tail = 4) {
  if (!h || h.length <= head + tail + 2) return h || "-";
  return `${h.slice(0, 2 + head)}...${h.slice(-tail)}`;
}
function fmtTs(ts) {
  if (!ts) return "-";
  return new Date(Number(ts) * 1000).toLocaleString();
}
const ROLE_BY_EVENT = {
  0: "GUARDIA", 1: "ADMIN", 2: "GUARDIA", 3: "ADMIN",
  4: "ADMIN", 5: "SOCIAL", 6: "SOCIAL", 7: "JUEZ", 8: "MEDICO"
};

function InternoView({ interno }) {
  if (!interno || interno.existe === false) return null;
  const lastEvent = (interno.eventos || []).at(-1);
  const rolUltimo = lastEvent ? ROLE_BY_EVENT[Number(lastEvent.tipo)] : undefined;

  return (
    <>
      <div className="state">
        <span className="pill">Nombre: {interno.nombre || "-"}</span>
        <span className="pill">Estado: {ESTADOS[interno.estadoActual] || "-"}</span>
        <span className="pill">Ubicación: {interno.ubicacionActual || "-"}</span>
      </div>

      <div className="meta-grid">
        <div>Última act.: {fmtTs(interno.fechaUltimaActualizacion)}</div>
        <div>
          Último actor:{" "}
          <code className="mono wrap-hash" title={interno.rolUltimoActor}>
            {shortHex(interno.rolUltimoActor)}{rolUltimo ? ` (${rolUltimo})` : ""}
          </code>
        </div>
        <div>
          Hash expediente:{" "}
          <code className="mono wrap-hash" title={interno.hashExpediente}>
            {interno.hashExpediente}
          </code>
        </div>
        <div>
          Id hash:{" "}
          <code className="mono wrap-hash" title={interno.idInternoHash}>
            {interno.idInternoHash}
          </code>
        </div>
      </div>

      <h3 style={{ marginTop: 16 }}>Historial</h3>
      <table className="ledger">
        <thead>
          <tr>
            <th className="col-id">ID ev</th>
            <th className="col-tipo">Tipo</th>
            <th className="col-desc">Descripción</th>
            <th className="col-fecha">Fecha</th>
            <th className="col-estado">Estado</th>
            <th className="col-emisor">Emisor</th>
            <th className="col-hash">Hash</th>
          </tr>
        </thead>
        <tbody>
          {(interno.eventos || [])
            .slice()
            .reverse()
            .map((ev) => {
              const rol = ROLE_BY_EVENT[Number(ev.tipo)];
              return (
                <tr key={ev.id}>
                  <td className="col-id">{ev.id}</td>
                  <td className="col-tipo">{TIPOS[ev.tipo] ?? ev.tipo}</td>
                  <td className="col-desc wrap-text">{ev.descripcion}</td>
                  <td className="col-fecha">{fmtTs(ev.fechaRegistro)}</td>
                  <td className="col-estado">
                    {ESTADOS[ev.estadoAsociado] ?? ev.estadoAsociado}
                  </td>
                  <td className="col-emisor mono wrap-hash" title={ev.rolEmisor}>
                    {shortHex(ev.rolEmisor)}{rol ? ` (${rol})` : ""}
                  </td>
                  <td className="col-hash mono wrap-hash" title={ev.hashEvento}>
                    {ev.hashEvento}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </>
  );
}

export default function App() {
  const [rol, setRol] = useState("GUARDIA");
  const accionesRol = useMemo(() => acciones[rol] || [], [rol]);

  const [form, setForm] = useState({});
  const [consultaId, setConsultaId] = useState("");
  const [interno, setInterno] = useState(null);
  const [msg, setMsg] = useState("");

  const onChange = (k, v) => setForm({ ...form, [k]: v });

  async function onRun(path) {
    setMsg("");
    const res = await ejecutar(path, form);
    setMsg(res.error ? `Error: ${res.error}` : `OK: ${res.txHash}`);
  }

  async function buscar() {
    setMsg("");
    const data = await getInterno(consultaId.trim());
    setInterno(data);
    if (!data.existe) setMsg("Interno no encontrado");
  }

  return (
    <div className="wrap">
      <header>
        <h1>Inmate State Ledger</h1>
        <div className="toolbar">
          <select value={rol} onChange={e => setRol(e.target.value)}>
            <option>GUARDIA</option>
            <option>ADMIN</option>
            <option>SOCIAL</option>
            <option>MEDICO</option>
            <option>JUEZ</option>
          </select>
        </div>
      </header>

      <section className="grid">
        <div className="card">
          <h2>Acciones disponibles</h2>
          <div className="actions">
            {accionesRol.map(a => (
              <div key={a.key} className="action">
                <h3>{a.label}</h3>
                {a.fields.map(f => (
                  <input key={f} placeholder={f} onChange={e => onChange(f, e.target.value)} />
                ))}
                <button onClick={() => onRun(a.path)}>Ejecutar</button>
              </div>
            ))}
          </div>
          {msg && <p className={msg.startsWith("Error") ? "bad" : "ok"}>{msg}</p>}
        </div>

        <div className="card">
          <h2>Historial por interno</h2>
          <div className="row">
            <input placeholder="id legible (se hashea)" value={consultaId} onChange={e => setConsultaId(e.target.value)} />
            <button onClick={buscar}>Buscar</button>
          </div>

          {interno && <InternoView interno={interno} />}
        </div>
      </section>

      <footer>
        <small>Conectado a API http://localhost:4000 • Simulación de roles en UI</small>
      </footer>
    </div>
  );
}

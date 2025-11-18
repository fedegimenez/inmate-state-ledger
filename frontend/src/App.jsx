import { useMemo, useState } from "react";
import { acciones, ejecutar, getInterno } from "./api";
import "./App.css";

const ESTADOS = ["NONE", "INGRESADO", "EN_TRASLADO", "SANCIONADO", "EN_REHABILITACION", "LIBERADO"];
const TIPOS = [
  "Ingreso",
  "OrdenDeTraslado",
  "ArriboADestino",
  "AplicarSancion",
  "CumplirSancion",
  "IniciarPrograma",
  "FinalizarPrograma",
  "Liberacion",
  "ParteMedico"
];

const ROLE_BY_EVENT = {
  0: "GUARDIA", 1: "ADMIN", 2: "GUARDIA", 3: "ADMIN",
  4: "ADMIN", 5: "SOCIAL", 6: "SOCIAL", 7: "JUEZ", 8: "MEDICO"
};

function shortHex(h = "", head = 6, tail = 4) {
  if (!h || h.length <= head + tail + 2) return h || "-";
  return `${h.slice(0, 2 + head)}...${h.slice(-tail)}`;
}

function fmtTs(ts) {
  if (!ts) return "-";
  return new Date(Number(ts) * 1000).toLocaleString();
}

function InternoView({ interno }) {
  if (!interno || interno.existe === false) return null;
  const lastEvent = (interno.eventos || []).at(-1);
  const rolUltimo = lastEvent ? ROLE_BY_EVENT[Number(lastEvent.tipo)] : undefined;

  return (
    <div className="interno-view">
      <div className="interno-header">
        <div className="interno-main">
          <h3 className="interno-name">{interno.nombre || "Interno sin nombre"}</h3>
          <span className={`status-pill status-${ESTADOS[interno.estadoActual] || "NONE"}`}>
            {ESTADOS[interno.estadoActual] || "SIN ESTADO"}
          </span>
        </div>
        <p className="interno-meta-line">
          <span className="label">Ubicación actual:</span>{" "}
          <span className="value">{interno.ubicacionActual || "-"}</span>
        </p>
      </div>

      <div className="meta-grid">
        <div className="meta-item">
          <span className="meta-label">Última actualización</span>
          <span className="meta-value">{fmtTs(interno.fechaUltimaActualizacion)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Último actor</span>
          <span className="meta-value mono wrap-hash" title={interno.rolUltimoActor}>
            {shortHex(interno.rolUltimoActor)}{rolUltimo ? ` (${rolUltimo})` : ""}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Hash expediente</span>
          <span className="meta-value mono wrap-hash" title={interno.hashExpediente}>
            {interno.hashExpediente}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">ID hash interno</span>
          <span className="meta-value mono wrap-hash" title={interno.idInternoHash}>
            {interno.idInternoHash}
          </span>
        </div>
      </div>

      <div className="section-divider">
        <h3 className="section-title">Historial de eventos</h3>
      </div>

      <div className="table-wrapper">
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
      </div>
    </div>
  );
}

export default function App() {
  const [rol, setRol] = useState("GUARDIA");
  const [form, setForm] = useState({});
  const [consultaId, setConsultaId] = useState("");
  const [interno, setInterno] = useState(null);
  const [msg, setMsg] = useState("");
  const accionesRol = useMemo(() => acciones[rol] || [], [rol]);

  const onChange = (k, v) => setForm({ ...form, [k]: v });

  async function onRun(path) {
    setMsg("");
    const res = await ejecutar(path, form, rol);   // ← pasa el rol
    setMsg(res.error ? `Error: ${res.error}` : `OK: ${res.txHash}`);
  }


  async function buscar() {
    setMsg("");
    const id = consultaId.trim();
    if (!id) {
      setInterno(null);
      setMsg("Ingresá un ID de interno para consultar.");
      return;
    }
    const data = await getInterno(id);
    setInterno(data);
    if (!data.existe) setMsg("Interno no encontrado");
  }

  return (
    <div className="app-root">
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-left">
            <div className="logo-mark">IS</div>
            <div className="topbar-text">
              <h1>Inmate State Ledger</h1>
              <p>Gestión de estado on-chain para población penitenciaria.</p>
            </div>
          </div>

          <div className="role-switcher">
            <span className="role-label">Rol activo</span>
            <select
              className="role-select"
              value={rol}
              onChange={e => setRol(e.target.value)}
            >
              <option>GUARDIA</option>
              <option>ADMIN</option>
              <option>SOCIAL</option>
              <option>MEDICO</option>
              <option>JUEZ</option>
            </select>
          </div>
        </header>

        <main className="main-grid">
          {/* Columna izquierda: acciones */}
          <section className="card card-actions">
            <div className="card-header">
              <div>
                <h2>Acciones disponibles</h2>
                <p className="card-subtitle">
                  Ejecutá transiciones de estado según el rol seleccionado.
                </p>
              </div>
              <span className="role-chip">{rol}</span>
            </div>

            <div className="actions">
              {accionesRol.map((a) => (
                <div key={a.key} className="action">
                  <div className="action-header">
                    <h3>{a.label}</h3>
                    <span className="action-path">{a.path}</span>
                  </div>
                  <div className="action-fields">
                    {a.fields.map((f) => (
                      <div key={f} className="field">
                        <label className="field-label" htmlFor={`${a.key}-${f}`}>
                          {f}
                        </label>
                        <input
                          id={`${a.key}-${f}`}
                          placeholder={f}
                          onChange={e => onChange(f, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => onRun(a.path)}
                  >
                    Ejecutar acción
                  </button>
                </div>
              ))}
            </div>

            {msg && (
              <p className={`status-text ${msg.startsWith("Error") ? "status-bad" : "status-ok"}`}>
                {msg}
              </p>
            )}
          </section>

          {/* Columna derecha: historial / consulta */}
          <section className="card card-history">
            <div className="card-header">
              <div>
                <h2>Historial por interno</h2>
                <p className="card-subtitle">
                  Consultá el timeline completo de un interno usando su ID legible.
                </p>
              </div>
            </div>

            <div className="search-row">
              <div className="field">
                <label className="field-label" htmlFor="consulta-id">
                  ID de interno
                </label>
                <input
                  id="consulta-id"
                  placeholder="id legible (se hashea on-chain)"
                  value={consultaId}
                  onChange={e => setConsultaId(e.target.value)}
                />
              </div>
              <button className="btn-secondary" onClick={buscar}>
                Buscar
              </button>
            </div>

            {interno ? (
              <InternoView interno={interno} />
            ) : (
              <div className="empty-state">
                <p>
                  Ingresá un ID y presioná <strong>Buscar</strong> para ver el
                  estado y el historial on-chain.
                </p>
              </div>
            )}
          </section>
        </main>

        <footer className="app-footer">
          <small>
            Conectado a API <code>http://localhost:3001</code> • Nodo local Hardhat •
            Interfaz de prueba para roles simulados.
          </small>
        </footer>
      </div>
    </div>
  );
}

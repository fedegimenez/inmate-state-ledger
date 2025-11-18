// src/api.js (ejemplo)
const BASE = "http://localhost:4000";

export async function ejecutar(path, data, role) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-role": role },
    body: JSON.stringify({ ...data }) // opcionalmente también podrías incluir role en body
  });
  return r.json();
}

export async function getInterno(id) {
  const r = await fetch(`${BASE}/api/interno/${encodeURIComponent(id)}`);
  return r.json();
}

// Definición de acciones por rol (igual que tenías)
export const acciones = {
  GUARDIA: [
    { key: "ingresar", label: "Ingresar interno", path: "/api/ingresar", fields: ["id", "nombre", "ubicacion", "descripcion"] },
    { key: "arribo", label: "Arribo a destino", path: "/api/arribo", fields: ["id", "ubicacion", "descripcion"] }
  ],
  ADMIN: [
    { key: "traslado", label: "Ordenar traslado", path: "/api/traslado", fields: ["id", "destino", "descripcion"] },
    { key: "sancion", label: "Aplicar sanción", path: "/api/sancion", fields: ["id", "motivo"] },
    { key: "cumplir", label: "Cumplir sanción", path: "/api/cumplir", fields: ["id", "detalle"] }
  ],
  SOCIAL: [
    { key: "iniciar", label: "Iniciar programa", path: "/api/iniciar-programa", fields: ["id", "programa"] },
    { key: "finalizar", label: "Finalizar programa", path: "/api/finalizar-programa", fields: ["id", "resultado"] }
  ],
  MEDICO: [
    { key: "parte", label: "Registrar parte médico", path: "/api/parte-medico", fields: ["id", "informe"] }
  ],
  JUEZ: [
    { key: "liberar", label: "Liberar interno", path: "/api/liberar", fields: ["id", "resolucion"] }
  ]
};

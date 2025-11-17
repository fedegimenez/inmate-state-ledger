const API = "http://localhost:3001/api";

export async function getInterno(id) {
  const r = await fetch(`${API}/interno/${encodeURIComponent(id)}`);
  return r.json();
}

async function post(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.json();
}

export const acciones = {
  GUARDIA: [
    { key:"ingresar", label:"Ingresar interno", path:"/ingresar", fields:["id","nombre","ubicacion","descripcion"] },
    { key:"arribo", label:"Arribo a destino", path:"/arribo", fields:["id","ubicacion","descripcion"] }
  ],
  ADMIN: [
    { key:"traslado", label:"Ordenar traslado", path:"/traslado", fields:["id","destino","descripcion"] },
    { key:"sancion",  label:"Aplicar sanción", path:"/sancion", fields:["id","motivo"] },
    { key:"cumplir",  label:"Cumplir sanción", path:"/cumplir", fields:["id","detalle"] }
  ],
  SOCIAL: [
    { key:"iniciar",   label:"Iniciar programa", path:"/iniciar-programa", fields:["id","programa"] },
    { key:"finalizar", label:"Finalizar programa", path:"/finalizar-programa", fields:["id","resultado"] }
  ],
  MEDICO: [
    { key:"parte", label:"Registrar parte médico", path:"/parte-medico", fields:["id","informe"] } // <-- nuevo
  ],
  JUEZ: [
    { key:"liberar", label:"Liberar", path:"/liberar", fields:["id","resolucion"] }
  ]
};


export async function ejecutar(path, payload) { return post(path, payload); }

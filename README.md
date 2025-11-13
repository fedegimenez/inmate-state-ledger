# Inmate State Ledger

Este README describe cómo preparar el entorno, compilar y desplegar los contratos Solidity, ejecutar la blockchain local (Hardhat node), y cómo instalar y ejecutar el backend y el frontend del proyecto "inmate-state-ledger".

Basado en la estructura del repositorio:
- Root:
  - package.json (contiene dependencias de Hardhat y OpenZeppelin)
  - hardhat.config.js
  - scripts/ (scripts de despliegue)
  - contracts/ (contratos Solidity)
- backend/
  - package.json (express, ethers, dotenv, cors)
  - index.js (punto de entrada esperado)
- frontend/
  - package.json (proyecto React + Vite)

Contenido:
- Requisitos
- Instalación
- Compilar contratos
- Ejecutar blockchain local (Hardhat)
- Desplegar contratos en la red local
- Configurar variables de entorno para backend y frontend
- Ejecutar backend
- Ejecutar frontend
- Conectar MetaMask / pruebas
- Consejos y resolución de problemas

---

## Requisitos (recomendado)
- Node.js >= 18
- npm >= 8 (o yarn)
- Git
- Navegador (Chrome/Firefox) con MetaMask para interactuar con el frontend

---

## Clonar el repositorio
```bash
git clone https://github.com/fedegimenez/inmate-state-ledger.git
cd inmate-state-ledger
```

---

## Instalación de dependencias

1. Instala las dependencias del root (Hardhat y dependencias globales de desarrollo):
```bash
npm install
```

2. Instala dependencias del backend:
```bash
npm install --prefix backend
```

3. Instala dependencias del frontend:
```bash
npm install --prefix frontend
```

Estas acciones usarán los package.json respectivos:
- root/package.json incluye: hardhat, @nomicfoundation/hardhat-toolbox, dotenv, @openzeppelin/contracts
- backend/package.json incluye: express, cors, dotenv, ethers
- frontend/package.json incluye: react, react-dom, vite y plugins

---

## Compilar contratos Solidity

Desde el directorio raíz del repo:
```bash
npx hardhat compile
```
Esto compilará los contratos dentro de la carpeta `contracts/` usando la configuración en `hardhat.config.js`.

Si quieres limpiar artefactos anteriores:
```bash
npx hardhat clean
```

---

## Ejecutar una blockchain local (Hardhat Node)

Para desplegar y probar localmente, abre una terminal y arranca la red local de Hardhat:
```bash
npx hardhat node
```
Esto levanta una red local (por defecto en `http://127.0.0.1:8545`) y muestra varias cuentas prefinanciadas con sus claves privadas. La red local estándar de Hardhat usa chainId `31337` o `1337` según configuración; revisa `hardhat.config.js`.

Mantén esta terminal abierta mientras trabajas.

---

## Desplegar contratos en la red local

Asumiendo que hay un script de despliegue en `scripts/` (p. ej. `scripts/deploy.js`), en otra terminal ejecuta:
```bash
npx hardhat run --network localhost scripts/deploy.js
```

- Si el script imprime la dirección del contrato al desplegar, anota esa dirección.
- Si el repositorio incluye scripts con nombres distintos, ajústalos en el comando: `npx hardhat run --network localhost scripts/<tu-script>.js`.

Si no existe un script, puedes crear uno que use `ethers` para desplegar tus contratos. Ejemplo de despliegue (plantilla) — crea `scripts/deploy.js` si no existe:

```js
// Ejemplo básico (plantilla)
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const Contract = await ethers.getContractFactory("NombreDelContrato");
  const contract = await Contract.deploy(/* constructor args if any */);
  await contract.deployed();
  console.log("Contract deployed to:", contract.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

## Variables de entorno (.env)

Crea archivos `.env` para `backend` y `frontend` según necesites. Aquí hay ejemplos:

backend/.env
```
# URL del proveedor (Hardhat local)
RPC_URL=http://127.0.0.1:8545
# Privada de la cuenta que el backend usará (extraída de npx hardhat node)
PRIVATE_KEY=0x...
# Dirección del contrato desplegado
CONTRACT_ADDRESS=0x...
# Puerto donde correrá el backend
PORT=3001
```

frontend/.env
(En Vite, las variables que empiezan con VITE_ estarán disponibles en el cliente)
```
VITE_RPC_URL=http://127.0.0.1:8545
VITE_CONTRACT_ADDRESS=0x...
VITE_CHAIN_ID=31337
```

Notas:
- Nunca subas claves privadas a repositorios públicos.
- Si no quieres usar una clave privada en el backend, el backend puede funcionar en modo lectura (sólo consultas).

---

## Ejecutar backend

El `backend/package.json` tiene `main: index.js`. Para iniciar el backend (esperando que exista `backend/index.js` como punto de entrada):

Desde la raíz del repositorio:
```bash
node backend/index.js
```
O, desde la carpeta del backend:
```bash
cd backend
node index.js
```

Si prefieres usar npm scripts, añade en `backend/package.json` un script start:
```json
"scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js"
}
```
y luego:
```bash
npm run start
# o
npm run dev
```

El backend normalmente leerá `process.env.RPC_URL`, `process.env.PRIVATE_KEY` y `process.env.CONTRACT_ADDRESS` para conectarse a la blockchain y al contrato.

---

## Ejecutar frontend (React + Vite)

Desde la raíz:
```bash
npm run dev --prefix frontend
```
O entrando al frontend:
```bash
cd frontend
npm run dev
```

El comando `dev` usa Vite y por defecto sirve la app en `http://localhost:5173` (u otro puerto que indique la consola). Asegúrate de tener `VITE_CONTRACT_ADDRESS` y `VITE_RPC_URL` en `frontend/.env` para que el código cliente pueda conectar con la blockchain local.

---

## Conectar MetaMask a la red local (para probar el frontend con transacciones)

1. Abre MetaMask → Ajustes → Redes → Añadir red.
2. Datos de la red local:
   - Nombre: Hardhat Local
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337 (o 1337 según tu `hardhat.config.js`)
   - Símbolo: ETH (opcional)
3. Importa una de las claves privadas mostradas en la salida de `npx hardhat node` (menú de cuentas en la terminal cuando inicias la node). Esto te permite firmar transacciones desde MetaMask con fondos de prueba.

---

## Flujo típico de desarrollo

1. Levantar nodo local:
   - `npx hardhat node`
2. En otra terminal compilar y desplegar:
   - `npx hardhat compile`
   - `npx hardhat run --network localhost scripts/deploy.js`
3. Configurar `.env` de backend y frontend con la dirección del contrato desplegado.
4. Ejecutar backend:
   - `node backend/index.js`
5. Ejecutar frontend:
   - `npm run dev --prefix frontend`
6. Abrir frontend en el navegador y conectar MetaMask (cuenta importada desde Hardhat node).

---

## Notas sobre contratos y dependencias

- El proyecto depende de `@openzeppelin/contracts` (instalado en root). Usa estas bibliotecas en tus contratos.
- Hardhat y el plugin toolbox están listados en `devDependencies`. Usa `npx hardhat` para comandos (compilar, test, node, run).
- El backend usa `ethers@^6.x` (APIs de ethers v6, ten en cuenta que la API difiere de v5).

---


## Troubleshooting / Puntos frecuentes

- `Error: cannot find module 'ethers'` → asegurarse de haber corrido `npm install --prefix backend` y que la versión de Node sea compatible.
- Problemas con chainId → verificar `hardhat.config.js` y usar el mismo chainId en MetaMask y en la variable VITE_CHAIN_ID si la usas.
- El script de despliegue no encuentra contratos → revisar que el nombre usado en `getContractFactory("NombreDelContrato")` coincida con el archivo y el nombre del contrato compilado.
- Si el backend necesita firmar transacciones, asegúrate de proporcionar una PRIVATE_KEY válida (una de las claves de `npx hardhat node` para pruebas locales).
- Para ver cuentas y claves: `npx hardhat node` imprime cuentas y claves privadas en la salida de la terminal.

---

## Sugerencias / mejoras
- Añadir scripts de npm en `backend/package.json` (start, dev) para facilidad.
- Añadir script `deploy` en root/package.json:
```json
"scripts": {
  "deploy:local": "npx hardhat run --network localhost scripts/deploy.js"
}
```
- Añadir documentación en `scripts/deploy.js` para imprimir contract address en JSON o archivo `.env.local` para facilitar integración con frontend/backend.

---

Si necesitas, puedo:
- Generar un ejemplo de `scripts/deploy.js` adaptado a los nombres de tus contratos.
- Crear plantillas de `.env` listas para copiar.
- Añadir scripts `start`/`dev` sugeridos para backend y root.

Buen desarrollo!

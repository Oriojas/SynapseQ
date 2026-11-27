# Despliegue de SynapseQ en Railway (Infrastructure as Code)

Esta carpeta es un paquete aislado: su `package.json` y `node_modules` solo contienen el SDK de
Railway y no afectan a `sdk/`, `gateway/` ni `frontend/`.

| Archivo | Qué hace |
|---|---|
| `railway.ts` | Define el proyecto: servicios `gateway` y `frontend` y el volumen `gateway-data` |
| `../gateway/Dockerfile` | Imagen del Key-Release Gateway (Node 22 + tsx) |
| `../frontend/Dockerfile` + `../frontend/Caddyfile` | Build de Vite y servidor estático Caddy |
| `../.dockerignore` | Deja fuera de las imágenes los `.env`, `node_modules` y `contracts` |

Ambos servicios se construyen desde la raíz del repo porque importan `../sdk/src`.

## 0. Requisitos

- Node 22 o superior y el CLI de Railway 5.63 o superior (`railway --version`).
  ```bash
  brew install railway
  ```
- Acceso de Railway al repositorio `Oriojas/SynapseQ`: en Railway → Account Settings → GitHub,
  instala o autoriza la GitHub App de Railway para ese repo.
- `railway.ts` despliega la rama **`master`**: fusiona esta rama antes de desplegar, o cambia
  `BRANCH` en `railway.ts`.

## 1. Vincular la cuenta

```bash
railway login
```
Abre el navegador (en SSH o sin navegador usa `railway login --browserless`). Compruébalo con:
```bash
railway whoami
```

## 2. Crear o vincular el proyecto

Desde la raíz del repo, para un proyecto nuevo:
```bash
railway init --name SynapseQ
```
Para uno que ya existe:
```bash
railway link
```
Elige el workspace, el proyecto y el entorno (`production`).

## 3. Instalar el SDK de IaC y revisar el plan

```bash
cd .railway && npm install
```
```bash
npm run plan
```
`plan` no cambia nada: muestra qué servicios, volúmenes y variables se crearían.

## 4. Aplicar

```bash
npm run apply
```
Esto crea `gateway`, `frontend` y el volumen `gateway-data` (montado en `/app/gateway/data`).
El primer despliegue del gateway **fallará** hasta el paso 5: sin `SYNAPSE_VAULT_ADDRESS`
el gateway se detiene a propósito.

## 5. Variables que `railway.ts` no gestiona (secretos y dirección del contrato)

Están marcadas con `preserve()`, así que `apply` nunca las sobrescribe. Defínelas una vez:

```bash
railway variable set -s gateway SYNAPSE_VAULT_ADDRESS=0xTU_CONTRATO
```
```bash
railway variable set -s frontend VITE_SYNAPSE_VAULT_ADDRESS=0xTU_CONTRATO
```
El JWT de Pinata se pasa por stdin para que no quede en el historial de la shell:
```bash
railway variable set -s gateway PINATA_JWT --stdin
```

`PINATA_JWT` solo va en el **gateway**. Nunca lo pongas en una variable `VITE_*`: Vite la
incrusta en el bundle público.

## 6. Dominios públicos

Las URLs cruzadas (`CORS_ORIGIN` del gateway y `VITE_GATEWAY_URL` del frontend) usan
`${{<servicio>.RAILWAY_PUBLIC_DOMAIN}}`, así que cada servicio necesita un dominio:
```bash
railway domain -s gateway
```
```bash
railway domain -s frontend
```

## 7. Redesplegar y verificar

`railway variable set` ya lanza un despliegue nuevo. Después de crear los dominios, vuelve a
desplegar el gateway para que tome el `CORS_ORIGIN` resuelto:
```bash
railway redeploy -s gateway
```
El frontend incrusta las `VITE_*` en el build, así que **tiene que reconstruirse**, no solo
reiniciarse: en el dashboard, abre el servicio `frontend` y usa **Deploy latest commit** (o haz
un push a `master`).

Comprueba el estado:
```bash
curl https://<dominio-del-gateway>/health
```
```bash
railway logs -s gateway
```

## Cambios posteriores

- Edita `railway.ts` y ejecuta `npm run plan` y luego `npm run apply`.
- Los pushes a `master` despliegan solos. Cada servicio se reconstruye solo si cambian sus
  archivos o `sdk/` (`watchPatterns`).
- En CI, para detectar diferencias: `railway config plan --detailed-exit-code` (sale con 2 si
  hay cambios pendientes).

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| Gateway en bucle de reinicio: `SYNAPSE_VAULT_ADDRESS is missing` | Falta el paso 5 |
| El navegador da error CORS al llamar al gateway | El frontend no tiene dominio, o el gateway no se redesplegó después de crearlo (pasos 6 y 7) |
| El frontend llama a `undefined` o a una URL vieja | Las `VITE_*` se fijan al construir: redespliega el frontend |
| Railway construye código viejo | `BRANCH` apunta a `master` y esta rama aún no se ha fusionado |

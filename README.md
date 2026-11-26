# 🧬⚙️ SynapseQ: Post-Quantum Ephemeral Health & Cyber-Human Augmentation Vault

[![Hackathon](https://img.shields.io/badge/QoreChain-Build%20Before%20Q--Day-6E56CF?style=for-the-badge)](https://build.qorechain.io/es/projects)
[![Network](https://img.shields.io/badge/Network-QoreChain%20Diana%20(Chain%20ID%209800)-00D1B2?style=for-the-badge)](https://dashboard.qorechain.io/faucet)
[![PQC](https://img.shields.io/badge/PQC-ML--KEM--1024%20%2B%20ML--DSA--87-FF3860?style=for-the-badge)](https://build.qorechain.io/es/kits)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-F59E0B?style=for-the-badge)](https://book.getfoundry.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **"Protegiendo la biología humana del presente y asegurando la trazabilidad biónica de los ciber-humanos del mañana frente a la era cuántica."**

---

## 🌐 Visión Dual: De la Medicina Actual a la Era Ciber-Humana

**SynapseQ** nace como una bóveda descentralizada de datos biomédicos con resistencia post-cuántica y control de acceso efímero (*ephemeral access*). Sin embargo, su arquitectura está diseñada para trascender el expediente clínico tradicional y convertirse en el **estándar criptográfico de catalogación y trazabilidad de piezas biónicas, neuro-prótesis y órganos sintéticos para los futuros ciber-humanos**.

### 1. El Presente: Soberanía de Datos Clínicos e Imágenes Médicas
Los registros médicos actuales (estudios DICOM, resonancias magnéticas, perfiles genómicos e historiales clínicos) requieren una confidencialidad superior a **50-70 años**. A diferencia de una clave bancaria, tu ADN y tu historial médico no se pueden rotar ni revocar tras una filtración.
* **Defensa contra ataques *Harvest Now, Decrypt Later* (HNDL):** Los adversarios ya interceptan tráfico médico cifrado con algoritmos clásicos (RSA/ECC) esperando ordenadores cuánticos capaces de ejecutar el algoritmo de Shor.
* **Acceso Efímero Auto-Soberano:** Inspirado en la sinapsis neuronal, el paciente otorga pases temporales de lectura a médicos especialistas. Al expirar el contador o activarse la revocación manual (*Kill-Switch*), el contrato inteligente extingue el acceso de forma inmutable.

### 2. El Futuro: Catalogación y Trazabilidad de Piezas para Ciber-Humanos (HBOM)
A medida que la humanidad integra interfaces cerebro-computadora (BCI), extremidades biónicas, exoesqueletos, implantes cocleares/retinianos y órganos bio-impresos, **el cuerpo humano pasa a tener una Cadena de Suministro y una Lista de Materiales (*Human Bill of Materials* - HBOM)**.
* **Vulnerabilidad Cuántica en Cuerpo Humano:** Si un ordenador cuántico vulnera la firma criptográfica de un marcapasos, un brazo biónico o un implante neural, el riesgo deja de ser una filtración de privacidad y pasa a ser el **secuestro físico o alteración de una parte del cuerpo humano**.
* **Catalogación Universal de Piezas Humanas:** SynapseQ registra cada componente implantado como un activo único auditable on-chain: fabricante OEM, zona anatómica, modelo, número de serie, versión de firmware, hash de calibración y firma **ML-DSA-87**.
* **Trazabilidad del Ciclo de Vida Biónico:** Desde el implante inicial, pasando por actualizaciones de firmware firmadas con `ML-DSA-87` y estados operativos (`ACTIVE`, `MAINTENANCE`, `DECOMMISSIONED`), hasta su reemplazo.
* **Pases Efímeros para Bio-Ingenieros:** Un ciber-humano puede otorgar acceso temporal (ej. 2 horas) ligado a una pieza `partId` específica para diagnosticar telemetría sin ceder control permanente de su hardware corporal.

---

## 🏗️ Arquitectura del Sistema

SynapseQ combina cifrado post-cuántico en cliente (100% compatible con navegador), almacenamiento descentralizado cifrado y gobernanza inmutable en **QoreChain Diana Testnet (`Chain ID 9800`)**:

```text
+-------------------------------------------------------------------------------------------------------------+
|                                  ARQUITECTURA INTEGRADA SYNAPSEQ (BIO + CYBER)                              |
+-------------------------------------------------------------------------------------------------------------+
|                                                                                                             |
|  [ 1. CLIENTE / SDK PQC (sdk/src/pqc.ts — Browser-Safe TypeScript) ]                                        |
|       |                                                                                                     |
|       +---> Cifrado simétrico local (Web Crypto AES-256-GCM) + Hash de integridad (SHAKE-256):              |
|       |     • Datos Clínicos: Resonancias (DICOM), laboratorios, genómica.                                  |
|       |     • Telemetría Ciber-Humana: Logs de implantes BCI, calibración, diagnósticos biónicos.           |
|       |     Blob cifrado (.enc) se sube vía Key-Release Gateway (Pinata server-side) ---> Obtiene CID       |
|       |                                                                                                     |
|       +---> Encapsulamiento Post-Cuántico (NIST FIPS 203 ML-KEM-1024):                                      |
|       |     Encapsula la clave AES-256 usando la clave pública ML-KEM-1024 del Médico o Bio-Ingeniero.      |
|       |                                                                                                     |
|       +---> Firmas de Firmware y Certificación HBOM (NIST FIPS 204 ML-DSA-87):                              |
|       |     Firma inmutable de parches de firmware y especificaciones del fabricante OEM.                   |
|       |                                                                                                     |
|  [ 2. SMART CONTRACT: SynapseVaultRegistry.sol (Foundry / QoreChain Diana Chain ID 9800) ]                  |
|       |                                                                                                     |
|       +---> Solo compromisos on-chain: contentHash (SHAKE-256 del CIFRADO) y envelopeHash. El sobre y   |
|       |     el CID NUNCA van al contrato (storage y calldata EVM son públicos aunque digan `private`).     |
|       +---> Módulo Clínico / Efímero: grantTimedAccess, extendAccess, revokeAccess, emergencyRevokeAll.     |
|       |     recordId = keccak256(patient, salt); Kill-Switch O(1) por época.                               |
|       +---> Módulo HBOM: el fabricante registra (partId = keccak256(fabricante, serial)); solo él publica  |
|       |     firmware; DECOMMISSIONED es terminal; la firma ML-DSA-87 completa va en un evento.           |
|       |                                                                                                     |
|  [ 3. KEY-RELEASE GATEWAY (gateway/) ]                                                                      |
|       |                                                                                                     |
|       +---> Custodia el sobre ML-KEM-1024 y el CID. Lo entrega solo si la wallet firma un reto            |
|       |     (nonce de un uso + chain ID + recordId) y getGrantMetadata(recordId).isActive es true.         |
|       +---> Verifica que el sobre coincida con envelopeHash on-chain; cuotas, CORS y tokens de descarga.   |
|       |                                                                                                     |
|  [ 4. PORTAL ESPECIALISTA (Médico / Bio-Ingeniero) ]                                                        |
|       |                                                                                                     |
|       +---> Pide el sobre al gateway, comprueba envelopeHash y contentHash contra la cadena,              |
|       |     desencapsula ML-KEM-1024 localmente y descifra AES-256-GCM en memoria.                        |
|       +---> Límite honesto: revocar impide NUEVAS entregas; no recupera lo que ya se descifró.          |
|                                                                                                             |
+-------------------------------------------------------------------------------------------------------------+
```

> **Escalabilidad Institucional (Roadmap `x/rdk`):** El campo `contentHash` (`SHAKE-256`) del contrato está diseñado para soportar tanto compromisos de integridad sobre **IPFS** (archivos médicos de 50-70 años) como futuros blobs efímeros en un **Sovereign Rollup (`x/rdk`, perfil `enterprise`)** de QoreChain con poda automática para telemetría biónica de alta frecuencia.

---

## 🦾 Módulo de Catalogación y Trazabilidad Ciber-Humana (HBOM)

| Dimensión | Aplicación en Salud Biológica Actual | Aplicación en Catalogación Ciber-Humana (Futuro) |
| :--- | :--- | :--- |
| **Activo Custodiado** | Imágenes DICOM, análisis de sangre, biopsias, historial genético. | Neuro-implantes (BCI), prótesis robóticas, órganos sintéticos, sensores subdérmicos, córneas biónicas. |
| **Identificador Único** | `recordId` + Hash `SHAKE-256` + CID en IPFS. | `partId` (Cyber-Part ID) + Serial OEM + Hash de firmware (`ML-DSA-87`) + Zona anatómica (`AnatomicalZone`). |
| **Trazabilidad On-Chain** | Registro inmutable de quién obtuvo acceso y durante qué ventana de tiempo. | Ciclo de vida completo: *Registro HBOM ➔ Parches de Firmware (`FirmwareRecord[]`) ➔ Cambios de Estado*. |
| **Control Efímero** | Pase de 24h a un médico para segunda opinión + *Kill-Switch* inmediato. | Pase de 2h ligado a `partId` para que un bio-ingeniero lea telemetría sin entregar control permanente. |

---

## 📁 Estructura del Repositorio

```text
SynapseQ/
├── Makefile                           # Automatización integral (build, init, down, test, lint, audit, deploy)
├── .env.example                       # Plantilla única de variables de entorno (sin secretos ni datos reales)
├── contracts/                         # Smart Contracts (Foundry / Solidity 0.8.24)
│   ├── foundry.toml                   # Configuración EVM ("paris") y RPC Diana Testnet (9800)
│   ├── src/
│   │   └── SynapseVaultRegistry.sol   # Contrato unificado: Acceso Efímero + Kill-Switch + HBOM + PKI ML-KEM-1024
│   ├── test/
│   │   └── SynapseVaultRegistry.t.sol # 14 tests unitarios, timelocks (vm.warp), PKI y fuzz testing
│   └── script/
│       └── DeploySynapseVault.s.sol   # Script de despliegue para fork local o Diana Testnet
├── sdk/                               # SDK Post-Cuántico Browser-Safe (TypeScript + Viem + @qorechain/rdk)
│   ├── package.json
│   └── src/
│       ├── pqc.ts                     # ML-KEM-1024, ML-DSA-87, SHAKE-256 y AES-256-GCM
│       ├── storage.ts                 # Clientes cifrados Pinata IPFS y fallback local/enclave
│       ├── storageStrategy.ts         # SynapseStorageRouter (QoreChain DA vs Pinata IPFS vs Memory Fallback)
│       ├── rdkDa.ts                   # Integración nativa con @qorechain/rdk (Sovereign Rollup & Native DA)
│       ├── abi.ts                     # ABI tipado completo de SynapseVaultRegistry
│       └── demo.ts                    # Demo end-to-end contra QoreChain (9800)
├── frontend/                          # Frontend Post-Quantum Bio-HUD (Vite + React 19 + Tailwind CSS v4)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/                # Mapa vectorial táctico GPS (TacticalGpsBackground)
│   │   │   ├── patient/               # Vista 1: Portal Paciente & Bóveda Efímera
│   │   │   ├── hbom/                  # Vista 2: Catálogo Ciber-Humano HBOM & Firmware ML-DSA-87
│   │   │   └── specialist/            # Vista 3: Portal Especialista Minimalista (Rebecca Glass Edition)
│   │   └── hooks/
│   │       └── useSynapseVault.ts     # Hook Web3 de interacción con SynapseVaultRegistry.sol
└── .stitch/designs/                   # Diseños UI/UX exportados desde Stitch MCP
```

---

## 🛠️ Stack Tecnológico

### Smart Contracts & Blockchain (QoreChain)
* **Red Objetivo:** QoreChain Diana Testnet — EVM Lane (`Chain ID: 9800`, RPC: `https://evm-testnet.qore.host`).
* **Smart Contracts:** Solidity `0.8.24` compilado, probado y desplegado con **Foundry** (`forge`, `cast`, `anvil`).
* **Seguridad On-Chain:** Storage privado (`_grants`), Custom Errors, *timelocks* por bloque, verificación de propiedad HBOM y `emergencyRevokeAll()` (*Kill-Switch*).

### Criptografía Post-Cuántica (100% Browser-Safe)
* **Encapsulamiento de Claves (KEM):** `@noble/post-quantum/ml-kem` — **NIST FIPS 203 (`ML-KEM-1024`)**.
* **Firmas Post-Cuánticas:** `@noble/post-quantum/ml-dsa` — **NIST FIPS 204 (`ML-DSA-87`)**.
* **Hashing Nativo:** `@noble/hashes/sha3` — **SHAKE-256** (32 bytes).
* **Cifrado de Documentos:** **Web Crypto API (`AES-256-GCM`)**, acelerado por hardware en navegadores modernos y compatible con Node.js.
* **Auditoría CBOM:** `qorescan` CLI para reporte CycloneDX post-cuántico.

### Integración Web3 & Frontend
* **Cliente EVM:** `viem`, `wagmi`, `@qorechain/react`, QoreX Wallet.
* **Almacenamiento Cifrado:** IPFS / Pinata a través del Key-Release Gateway (el `PINATA_JWT` solo vive en el servidor; en desarrollo sin JWT el gateway guarda el blob en `gateway/data/`).

---

## 📜 Especificación de `SynapseVaultRegistry.sol`

### Módulo 1: Acceso Efímero Post-Cuántico
* `grantTimedAccess(salt, contentHash, envelopeHash, linkedPartId, specialist, domain, durationInSeconds) → recordId`: Emite un pase temporal. Solo guarda compromisos; `recordId = computeRecordId(msg.sender, salt)`.
* `extendAccess(recordId, extraSeconds)`: Extiende un pase **activo** (no revive pases vencidos, revocados o apagados por Kill-Switch).
* `revokeAccess(recordId)`: Revoca instantáneamente un pase específico.
* `emergencyRevokeAll()`: **Kill-Switch** O(1): sube la época del paciente e invalida todos sus pases anteriores.
* `isAccessValid(recordId)` / `getGrantMetadata(recordId)`: Política consultada por el Key-Release Gateway (solo hashes, nunca el sobre ni el CID).

### Módulo 2: Registro HBOM & Firmware Biónico
* `registerBionicPart(bearer, zone, modelName, serialNumber, firmwareHash, calibrationHash, pqcSignature) → partId`: Lo llama el fabricante (`msg.sender`); `partId = computePartId(fabricante, serial)`. Guarda `keccak256` de la firma `ML-DSA-87` y emite la firma completa en `FirmwareAttestation`.
* `logFirmwareUpdate(partId, newFirmwareHash, newCalibrationHash, pqcSignature)`: Parches de firmware (solo el fabricante).
* `updatePartStatus(partId, newStatus)`: Cambia el estado operativo; `DECOMMISSIONED` es terminal.
* **Verificación on-chain de la firma `ML-DSA-87` (`pqcVerify`):** `registerBionicPart` y `logFirmwareUpdate` obtienen la clave registrada del fabricante con el precompilado `pqcKeyStatus(msg.sender)` (`0x…0a02`) y verifican la firma con `pqcVerify` (`0x…0a01`). El mensaje firmado es `firmwareAttestationMessage(partId, version, firmwareHash, calibrationHash)`, ligado a chain ID, contrato, pieza y versión (no se puede reutilizar). Si el precompilado no responde (Anvil sin mock, mainnet), el contrato **falla cerrado** (`PqcUnavailable`). `requirePossessionProof` (constructor, `REQUIRE_PQC_POSSESSION`) exige además prueba de posesión de la clave.

#### Herramienta OEM (`sdk/src/oemCli.ts`)
La wallet web no puede firmar con ML-DSA, así que el fabricante firma con su **clave canónica** (la misma que registra QoreX, `deriveCanonicalPqKey`):
```bash
cd sdk
OEM_MNEMONIC="<mnemónico de testnet del fabricante>" QORECHAIN_RPC_URL=https://evm-testnet.qore.host \
SYNAPSE_VAULT_ADDRESS=<contrato> npm run oem -- status
OEM_MNEMONIC=… SYNAPSE_VAULT_ADDRESS=… npm run oem -- register --serial SN-1 --model "NeuroLink-X9" \
  --bearer 0x<portador> --zone 0 --firmware ./fw.bin --calibration "perfil-v1"
OEM_MNEMONIC=… SYNAPSE_VAULT_ADDRESS=… npm run oem -- update --part 0x<partId> --firmware ./fw-v2.bin
```
La cuenta del fabricante necesita en Diana su clave ML-DSA-87 registrada y una **ventana EVM abierta** (QoreX → Ajustes → Seguridad → Ventana de acceso EVM; idealmente restringida al contrato con `--allowed-targets`).

#### Pruebas locales y forks
Anvil (incluido `anvil --fork-url https://evm-testnet.qore.host`) **no ejecuta los precompilados nativos de QoreChain**: en un fork `pqcKeyStatus` devuelve `0x` y el contrato revierte con `PqcUnavailable`. Para desarrollo local, `make init` ejecuta `make dev-pqc-mock`, que coloca `MockQorePqc` (**solo dev**) en `0x…0a01/0a02`; la herramienta OEM verifica la firma ML-DSA-87 fuera de la cadena y aprueba en el mock solo esa terna exacta (clave, firma, mensaje). La verificación real solo ocurre en Diana; se comprobó por `eth_call` que el precompilado de Diana acepta las firmas de `pqSign` y rechaza un mensaje alterado.
* `getBionicPart(partId)` / `getPartsByBearer(bearer)` / `getFirmwareHistory(partId)`: Consultas completas del inventario corporal y su auditoría histórica.

### Módulo 3: Directorio On-Chain de Claves Públicas `ML-KEM-1024` (QoreChain PKI)
* `registerKemPublicKey(bytes calldata pubKey)`: Publica on-chain la clave pública `ML-KEM-1024` (`1,568 bytes` NIST FIPS 203) del médico o bio-ingeniero para que el paciente pueda encapsular sin depender de servidores centralizados.
* `getKemPublicKey(address account)` / `hasKemPublicKey(address account)`: Resuelve directamente desde QoreChain la llave pública post-cuántica de cualquier especialista.

---

## ⚡ Automatización con `Makefile` (Instalación, Inicio, Detenido y Pruebas)

El proyecto cuenta con un [Makefile](Makefile) unificado que automatiza todo el ciclo de vida del stack (contratos Foundry, nodo local Anvil, SDK Post-Cuántico y Frontend React + Tailwind v4).

### Tabla de Comandos `make`
Ejecuta `make` o `make help` en la raíz del repositorio para listar todos los comandos disponibles:

| Comando | Descripción |
| :--- | :--- |
| `make build` | ⚙️ **Primera vez:** instala `forge-std`, compila los contratos Solidity en Foundry, instala dependencias en `sdk/` y `frontend/`, y verifica el build de producción. |
| `make init` | 🚀 **Levantar el stack local:** inicia en background el nodo EVM **Anvil (`Chain ID 9800`)** en `:8545`, despliega automáticamente `SynapseVaultRegistry.sol`, levanta el **Frontend Bio-HUD** en `:5173` y verifica con healthcheck HTTP que ambos respondan. |
| `make down` | 🛑 **Detener el stack local:** finaliza los procesos en background (`Anvil` y `Vite`) y libera los puertos `:8545` y `:5173`. |
| `make test` | 🧪 **Suite completa acumulada:** ejecuta en orden `make lint` + `make test-contracts` + `make test-sdk` + `make test-front`. |
| `make test-contracts` | ⛓️ Ejecuta los 14 tests unitarios, *timelocks* (`vm.warp`), *Kill-Switch*, HBOM, PKI y *fuzzing* en Foundry (`forge test -vvv`). |
| `make test-sdk` | 🔐 Valida el tipado estricto (`tsc --noEmit`) y linting (`eslint`) sobre `ML-KEM-1024`, `ML-DSA-87`, `SHAKE-256`, `rdkDa` y `SynapseStorageRouter`. |
| `make test-front` | ⚛️ Valida el tipado estricto y la compilación de producción (`vite build`) del Frontend. |
| `make lint` | 🔍 Verificación de formato y tipos en todo el monorepo (`forge fmt --check` + `eslint` + `tsc`). |
| `make audit` | 🛡️ Auditoría de seguridad de dependencias (`npm audit`) en `sdk/` y `frontend/`. |
| `make demo` | 🎯 Ejecuta la demo end-to-end post-cuántica (`sdk/src/demo.ts`) contra el nodo local activo. |
| `make deploy-local` | 📦 Despliega `SynapseVaultRegistry.sol` en el nodo Anvil local (`:8545`). |
| `make deploy-diana` | 🌐 Despliega `SynapseVaultRegistry.sol` en **QoreChain Diana Testnet real (`Chain ID 9800`)** usando las variables de `.env`. |
| `make clean` | 🗑️ Detiene el stack activo y limpia artefactos de compilación, cachés, PIDs y logs temporales (`/tmp/synapseq-*`). |

### Flujo Rápido Recomendado con `make`
```bash
# 1. Clonar el repositorio y crear el archivo .env desde la plantilla
git clone https://github.com/Oriojas/SynapseQ.git
cd SynapseQ
cp .env.example .env

# 2. Instalar dependencias y compilar todo el proyecto (primera vez)
make build

# 3. Levantar todo el entorno local (Anvil 9800 + Deploy Contrato + Frontend en http://localhost:5173)
make init

# 4. Ejecutar la suite completa de calidad y tests
make test

# 5. Ejecutar la demo criptográfica de 6 pasos contra el nodo local
make demo

# 6. Detener todos los servicios y liberar puertos
make down
```

---

## 🔧 Ejecución Manual Paso a Paso (Alternativa sin `make`)

### 1. Clonar e instalar dependencias de Smart Contracts (Foundry)
```bash
git clone https://github.com/Oriojas/SynapseQ.git
cd SynapseQ/contracts

# Instalar forge-std (si es la primera vez tras clonar)
forge install foundry-rs/forge-std --no-git

# Ejecutar los 11 tests (timelocks con vm.warp, Kill-Switch, HBOM y fuzzing)
forge test -vvv
```

### 2. Levantar un Fork Local de QoreChain Diana Testnet (`Chain ID 9800`)
En una terminal:
```bash
anvil --fork-url https://evm-testnet.qore.host --port 8545 --host 127.0.0.1
```

### 3. Desplegar el contrato en el Fork Local
En otra terminal:
```bash
cd SynapseQ/contracts
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/DeploySynapseVault.s.sol:DeploySynapseVault \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

### 4. Ejecutar la Demo End-to-End Post-Cuántica (Cifrado Real + QoreChain)
```bash
cd ../sdk
npm install

# Opcional: pasar la dirección impresa en el paso anterior si cambia
SYNAPSE_VAULT_ADDRESS="<DIRECCION_DESPLEGADA>" npm run demo
```
La demo ejecuta automáticamente los 6 pasos reales: generación de llaves `ML-KEM-1024` y `ML-DSA-87` → firma y registro de implante BCI en HBOM → cifrado `AES-256-GCM` + sellado `ML-KEM-1024` → pase efímero on-chain → descifrado en memoria y verificación `SHAKE-256` → **Kill-Switch** y rechazo on-chain.

### 5. Despliegue a QoreChain Diana Testnet Real (`Chain ID 9800`)
```bash
cd ../contracts
cp .env.example .env
# Configura DEPLOYER_PRIVATE_KEY con tu wallet fondeada en el faucet de Diana
source .env
forge script script/DeploySynapseVault.s.sol:DeploySynapseVault \
  --rpc-url "$QORECHAIN_RPC_URL" \
  --broadcast
```

---

## 👥 Equipo de Desarrollo

| Integrante | GitHub | Rol Principal | Enfoque en SynapseQ |
| :--- | :--- | :--- | :--- |
| **Oscar Riojas** | [@Oriojas](https://github.com/Oriojas) | **Tech Lead, PQC Cryptography & Storage** | Criptografía `ML-KEM-1024` / `ML-DSA-87` (`QoreSeal` / `QoreSign`), integración con IPFS para expedientes y telemetría biónica, y generación de auditoría CBOM con `qorescan`. |
| **Luis Felipe Marín** | [@LuisFelipe09](https://github.com/LuisFelipe09) | **Smart Contracts & Blockchain Engineer** | Arquitectura y desarrollo de `SynapseVaultRegistry.sol` (Clínico + HBOM + Kill-Switch) en **Foundry**, pruebas de seguridad/fuzzing, SDK PQC/Viem y despliegue en QoreChain Diana Testnet (`Chain ID 9800`). |
| **Jhon Tejada** | [@tejada95](https://github.com/tejada95) | **Frontend, UX & Backend Integration** | Interfaz en Next.js/Tailwind para el Portal Paciente/Ciber-Humano y Portal Especialista, integración de wallets con `@qorechain/react` & QoreX, y API Node.js/PostgreSQL para catalogación off-chain. |

---

## 🔗 Enlaces del Ecosistema QoreChain

* **Hackathon Build Before Q-Day:** https://build.qorechain.io/es/projects
* **Documentación Oficial QoreChain:** https://docs.qorechain.io/es/introduction
* **RPC Oficial Diana Testnet (Chain ID 9800):** `https://evm-testnet.qore.host`
* **Faucet Oficial Diana Testnet:** https://dashboard.qorechain.io/faucet

---

## 📄 Licencia

Distribuido bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más información.

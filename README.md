# 🧬⚙️ SynapseQ: Post-Quantum Ephemeral Health & Cyber-Human Augmentation Vault

[![Hackathon](https://img.shields.io/badge/QoreChain-Build%20Before%20Q--Day-6E56CF?style=for-the-badge)](https://build.qorechain.io/es/projects)
[![Network](https://img.shields.io/badge/Network-QoreChain%20Diana%20(Chain%20ID%209800)-00D1B2?style=for-the-badge)](https://dashboard.qorechain.io/faucet)
[![PQC](https://img.shields.io/badge/PQC-ML--KEM--1024%20%2B%20ML--DSA--87-FF3860?style=for-the-badge)](https://build.qorechain.io/es/kits)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-F59E0B?style=for-the-badge)](https://book.getfoundry.sh/)
[![CBOM](https://img.shields.io/badge/CycloneDX-CBOM%20v1.6%20Verified-A8F0C6?style=for-the-badge)](./cbom-report.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **"Protegiendo la biología humana del presente y asegurando la trazabilidad biónica de los ciber-humanos del mañana frente a la era cuántica."**

---

## 🌐 Visión Dual: De la Medicina Actual a la Era Ciber-Humana

**SynapseQ** nace como una bóveda descentralizada de datos biomédicos con resistencia post-cuántica y control de acceso efímero (*ephemeral access*). Sin embargo, su arquitectura está diseñada para trascender el expediente clínico tradicional y convertirse en el **estándar criptográfico de catalogación y trazabilidad de piezas biónicas, neuro-prótesis y órganos sintéticos para los futuros ciber-humanos**.

### 1. El Presente: Soberanía de Datos Clínicos e Imágenes Médicas
Los registros médicos actuales (estudios DICOM, resonancias magnéticas, perfiles genómicos e historiales clínicos) requieren una confidencialidad superior a **50-70 años**. A diferencia de una clave bancaria, tu ADN y tu historial médico no se pueden rotar ni revocar tras una filtración.
* **Defensa contra ataques *Harvest Now, Decrypt Later* (HNDL):** Los adversarios ya interceptan tráfico médico cifrado con algoritmos clásicos (RSA/ECC) esperando ordenadores cuánticos capaces de ejecutar el algoritmo de Shor.
* **Acceso Efímero Auto-Soberano:** Inspirado en la sinapsis neuronal, el paciente otorga pases temporales de lectura a médicos especialistas. Al expirar el contador o activarse la revocación manual (*Kill-Switch* $O(1)$), el contrato inteligente extingue el acceso de forma inmutable y el **Zero-Trust Key-Release Gateway** niega cualquier nueva liberación del sobre post-cuántico.

### 2. El Futuro: Catalogación y Trazabilidad de Piezas para Ciber-Humanos (HBOM)
A medida que la humanidad integra interfaces cerebro-computadora (BCI), extremidades biónicas, exoesqueletos, implantes cocleares/retinianos y órganos bio-impresos, **el cuerpo humano pasa a tener una Cadena de Suministro y una Lista de Materiales (*Human Bill of Materials* - HBOM)**.
* **Vulnerabilidad Cuántica en Cuerpo Humano:** Si un ordenador cuántico vulnera la firma criptográfica de un marcapasos, un brazo biónico o un implante neural, el riesgo deja de ser una filtración de privacidad y pasa a ser el **secuestro físico o alteración de una parte del cuerpo humano**.
* **Catalogación Universal de Piezas Humanas:** SynapseQ registra cada componente implantado como un activo único auditable on-chain: fabricante OEM (`partId = keccak256(fabricante, serial)`), zona anatómica, modelo, número de serie, versión monotónica de firmware, hash de calibración y firma **ML-DSA-87 (NIST FIPS 204)**.
* **Trazabilidad del Ciclo de Vida Biónico:** Desde el implante inicial, pasando por actualizaciones de firmware firmadas exclusivamente por el fabricante con `ML-DSA-87` y estados operativos (`ACTIVE`, `MAINTENANCE`, y estado terminal `DECOMMISSIONED`), hasta su reemplazo.
* **Pases Efímeros para Bio-Ingenieros:** Un ciber-humano puede otorgar acceso temporal (ej. 2 horas) ligado a una pieza `partId` específica para diagnosticar telemetría sin ceder control permanente de su hardware corporal.

---

## 🏗️ Arquitectura del Sistema (Contrato v2 + Key-Release Gateway + Map-First Tactical HUD)

SynapseQ combina cifrado post-cuántico en cliente (100% compatible con navegador), custodia Zero-Trust de sobres fuera de calldata público, almacenamiento descentralizado cifrado y gobernanza inmutable en **QoreChain Diana Testnet (`Chain ID 9800`)**:

```text
+-------------------------------------------------------------------------------------------------------------+
|                                  ARQUITECTURA INTEGRADA SYNAPSEQ (BIO + CYBER)                              |
+-------------------------------------------------------------------------------------------------------------+
|                                                                                                             |
|  [ 1. CLIENTE / SDK PQC (sdk/src/pqc.ts — Browser-Safe TypeScript) ]                                        |
|       |                                                                                                     |
|       +---> Cifrado simétrico local (Web Crypto AES-256-GCM) + Hash de integridad (SHAKE-256 del cifrado):  |
|       |     • Datos Clínicos: Resonancias (DICOM), laboratorios, genómica.                                  |
|       |     • Telemetría Ciber-Humana: Logs de implantes BCI, calibración, diagnósticos biónicos.           |
|       |     Blob cifrado (.enc) se sube vía Key-Release Gateway (Pinata server-side) ---> Obtiene CID       |
|       |                                                                                                     |
|       +---> Encapsulamiento Post-Cuántico (NIST FIPS 203 ML-KEM-1024):                                      |
|       |     Consulta getKemPublicKey(especialista) on-chain y encapsula la clave AES-256.                   |
|       |     Recuperación de emergencia soportada mediante Shamir Secret Sharing 2-de-3 (sdk/src/recovery.ts)|
|       |                                                                                                     |
|       +---> Firmas de Firmware y Certificación HBOM (NIST FIPS 204 ML-DSA-87):                              |
|       |     Firma inmutable de parches de firmware y especificaciones del fabricante OEM (4,627 bytes).     |
|       |                                                                                                     |
|  [ 2. SMART CONTRACT v2: SynapseVaultRegistry.sol (Foundry / QoreChain Diana Chain ID 9800) ]               |
|       |                                                                                                     |
|       +---> Solo compromisos on-chain: contentHash (SHAKE-256 del CIFRADO) y envelopeHash. El sobre y       |
|       |     el CID NUNCA van al contrato (storage y calldata EVM son públicos aunque digan `private`).      |
|       +---> Módulo Clínico / Efímero: grantTimedAccess, extendAccess, revokeAccess, emergencyRevokeAll.     |
|       |     recordId = keccak256(patient, salt); Kill-Switch O(1) por época (~45k gas constante).           |
|       +---> Módulo HBOM: el fabricante registra (partId = keccak256(fabricante, serial)); solo él publica   |
|       |     firmware; DECOMMISSIONED es terminal; el hash de la firma ML-DSA-87 se guarda en storage        |
|       |     y la firma completa se emite en el evento FirmwareAttestation (~442k gas).                      |
|       +---> Módulo PKI: registerKemPublicKey / getKemPublicKey / hasKemPublicKey (1,568 bytes ML-KEM-1024). |
|       |                                                                                                     |
|  [ 3. ZERO-TRUST KEY-RELEASE GATEWAY (gateway/) ]                                                           |
|       |                                                                                                     |
|       +---> Custodia el sobre ML-KEM-1024 y el CID. Lo entrega solo si la wallet del especialista firma un  |
|       |     reto ligado a Chain ID 9800 + nonce de un uso + recordId y getGrantMetadata(recordId).isActive. |
|       +---> Verifica que el sobre coincida con envelopeHash on-chain; aplica cuotas de subida por wallet,   |
|       |     rate-limiting por IP, CORS estricto, tokens de descarga single-use y crypto-shredding.          |
|       |                                                                                                     |
|  [ 4. FRONTEND: MAP-FIRST TACTICAL HUD (Rebecca Glass Edition — Vite + React 19 + Tailwind v4) ]            |
|       |                                                                                                     |
|       +---> Mapa vectorial táctico GPS en pantalla completa con corredor central despejado, riel lateral    |
|       |     flotante de cristal esmerilado y cajón flotante inferior derecho para inspección en RAM.        |
|       +---> El especialista sincroniza sus pases desde la cadena (getGrantsBySpecialist), solicita el       |
|       |     sobre al gateway, verifica envelopeHash y contentHash contra QoreChain y descifra en memoria.   |
|                                                                                                             |
+-------------------------------------------------------------------------------------------------------------+
```

> **Escalabilidad Institucional (Roadmap `x/rdk`):** El campo `contentHash` (`SHAKE-256`) del contrato y el módulo `sdk/src/rdkDa.ts` están diseñados para soportar tanto compromisos de integridad sobre **IPFS** (archivos médicos de 50-70 años) como futuros blobs efímeros en un **Sovereign Rollup (`x/rdk`, perfil `enterprise`)** de QoreChain con poda automática para telemetría biónica de alta frecuencia.

---

## 🎨 Interfaz Visual: Map-First Tactical HUD (Paleta Rebecca Glass)

El frontend (`frontend/`) implementa la arquitectura visual **Map-First Tactical HUD** diseñada con **Stitch MCP**, inspirada en la paleta cromática *Rebecca (Cyberpunk: Edgerunners)* (`#0B100E` obsidiana verdosa, `#A8F0C6` menta pastel, `#F4729B` rosa coral, `#3B66E8` azul cobalto y `#FACC15` amarillo ácido):

* **Mapa Vectorial Táctico GPS en Tiempo Real (`TacticalGpsBackground.tsx`):** Curvas topográficas, cuadrícula urbana por sectores (`SECTOR-09 // WEST LATTICE`), anillos de radar concéntricos (`1.0 km` a `4.0 km`) y ruta vectorial conectando `ENCLAVE NODE [DIANA-9800]` con `PATIENT BEACON [#EQ-9042]`.
* **Riel HUD Flotante Izquierdo + Corredor Central Despejado + Drawer Inferior Derecho:** Las 3 vistas (*Patient Vault*, *Cyber-Human HBOM* y *Specialist Portal*) utilizan tarjetas de cristal translúcido (`backdrop-blur-md`) en los bordes para mantener el corredor central del mapa táctico 100% visible.
* **Transparencia Honesta On-Chain vs Demo Local:** La interfaz distingue explícitamente entre pases/implantes reales anclados **ON-CHAIN** y datos de **DEMO LOCAL / EJEMPLO**, simulando cada transacción antes de firmar y verificando `receipt.status === "success"`.

---

## 📁 Estructura del Repositorio

```text
SynapseQ/
├── Makefile                           # Automatización integral (build, init, down, test, lint, audit, cbom, deploy)
├── .env.example                       # Plantilla única de variables de entorno (sin secretos ni datos reales)
├── cbom-report.json                   # Reporte CycloneDX v1.6 Cryptography Bill of Materials (NIST Cat 5 PQC)
├── contracts/                         # Smart Contracts v2 (Foundry / Solidity 0.8.24)
│   ├── foundry.toml                   # Configuración EVM ("paris") y RPC Diana Testnet (9800)
│   ├── src/
│   │   └── SynapseVaultRegistry.sol   # Contrato v2: Compromisos Efímeros + Kill-Switch O(1) + HBOM + PKI ML-KEM
│   ├── test/
│   │   └── SynapseVaultRegistry.t.sol # 24 tests unitarios, regresiones de seguridad, gas real y fuzzing
│   └── script/
│       └── DeploySynapseVault.s.sol   # Script de despliegue para nodo local o QoreChain Diana Testnet
├── gateway/                           # Zero-Trust Key-Release Gateway & Pinata Proxy (TypeScript / Node.js)
│   ├── src/
│   │   ├── server.ts                  # Custodia de sobres ML-KEM-1024, cuotas, tokens single-use y shredding
│   │   ├── auth.ts                    # Retos firmados por wallet ligados a Chain ID 9800 y nonces de un uso
│   │   ├── chain.ts                   # Verificación en vivo de getGrantMetadata / isAccessValid en QoreChain
│   │   ├── store.ts                   # Almacenamiento aislado de sobres y blobs cifrados
│   │   └── test.ts                    # 3 suites de pruebas (Shamir 2-de-3, release condicionado y límites)
├── sdk/                               # SDK Post-Cuántico Browser-Safe (TypeScript + Viem + @qorechain/rdk)
│   ├── src/
│   │   ├── pqc.ts                     # ML-KEM-1024, ML-DSA-87, SHAKE-256, AES-256-GCM y derivación por wallet
│   │   ├── recovery.ts                # Partición Shamir Secret Sharing 2-de-3 en GF(256) para llaves ML-KEM
│   │   ├── gatewayClient.ts           # Cliente tipado para autenticación, pin, custodia y liberación en Gateway
│   │   ├── storage.ts                 # Clientes cifrados Pinata IPFS y fallback local/enclave
│   │   ├── storageStrategy.ts         # SynapseStorageRouter (QoreChain DA vs Pinata IPFS vs Memory Fallback)
│   │   ├── rdkDa.ts                   # Integración con @qorechain/rdk (Sovereign Rollup & Native DA)
│   │   ├── quantumDefenseSim.ts       # Simulación ejecutable de 5 vectores de ataque post-cuántico (Q-Day)
│   │   ├── abi.ts                     # ABI tipado completo de SynapseVaultRegistry v2
│   │   └── demo.ts                    # Demo end-to-end de 7 pasos contra nodo local + Key-Release Gateway
├── frontend/                          # Frontend Map-First Tactical HUD (Vite + React 19 + Tailwind CSS v4)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/                # Mapa vectorial táctico GPS (TacticalGpsBackground)
│   │   │   ├── patient/               # Vista 1: Portal Paciente & Bóveda Efímera (Tactical HUD)
│   │   │   ├── hbom/                  # Vista 2: Catálogo Ciber-Humano HBOM & Firmware ML-DSA-87 (Tactical HUD)
│   │   │   └── specialist/            # Vista 3: Portal Especialista & Decryption Drawer (Tactical HUD)
│   │   └── hooks/
│   │       └── useSynapseVault.ts     # Hook Web3 con simulateContract, verificación de recibos y escaneo on-chain
├── .stitch/designs/                   # Diseños UI/UX y variantes minimalistas exportadas desde Stitch MCP
└── docs/
    ├── synapseq-plan-hackathon-v2.md  # Planificación estratégica del sprint
    └── informe-revision-key-release-gateway.md # Auditoría interna de seguridad (13/13 hallazgos corregidos)
```

---

## 🛠️ Stack Tecnológico

### Smart Contracts & Blockchain (QoreChain)
* **Red Objetivo:** QoreChain Diana Testnet — EVM Lane (`Chain ID: 9800`, RPC: `https://evm-testnet.qore.host`).
* **Smart Contracts:** Solidity `0.8.24` compilado, probado y desplegado con **Foundry** (`forge`, `cast`, `anvil`).
* **Seguridad On-Chain v2:** Solo hashes/compromisos on-chain (`contentHash` sobre texto cifrado y `envelopeHash`), `recordId = keccak256(patient, salt)`, `partId = keccak256(manufacturer, serial)`, `DECOMMISSIONED` terminal y `emergencyRevokeAll()` (*Kill-Switch* $O(1)$ por época en ~45k gas).

### Criptografía Post-Cuántica (100% Browser-Safe) & Recuperación
* **Encapsulamiento de Claves (KEM):** `@noble/post-quantum/ml-kem` — **NIST FIPS 203 (`ML-KEM-1024`)**, con derivación determinista firmada por la wallet del especialista (`deriveKemKeyPairFromSignature`).
* **Recuperación de Emergencia:** **Shamir Secret Sharing 2-de-3** sobre $\text{GF}(256)$ (`sdk/src/recovery.ts`) para dividir la semilla de `ML-KEM-1024` entre Paciente, Custodio Clínico y Enclave Hardware.
* **Firmas Post-Cuánticas:** `@noble/post-quantum/ml-dsa` — **NIST FIPS 204 (`ML-DSA-87`)** (`4,627 bytes`).
* **Hashing Nativo:** `@noble/hashes/sha3` — **SHAKE-256** (32 bytes).
* **Cifrado de Documentos:** **Web Crypto API (`AES-256-GCM`)**, acelerado por hardware en navegadores modernos.
* **Auditoría CBOM:** Reporte estándar **CycloneDX v1.6** ([cbom-report.json](cbom-report.json)) verificable con `make cbom`.

---

## 📜 Especificación de `SynapseVaultRegistry.sol` (Contrato v2)

### Módulo 1: Acceso Efímero Post-Cuántico (Solo Compromisos)
* `grantTimedAccess(salt, contentHash, envelopeHash, linkedPartId, specialist, domain, durationInSeconds) → recordId`: Emite un pase temporal guardando únicamente compromisos criptográficos (`228 bytes` de calldata; ~201k gas).
* `extendAccess(recordId, extraSeconds)`: Extiende un pase **activo** (no revive pases vencidos, revocados o apagados por Kill-Switch).
* `revokeAccess(recordId)`: Revoca instantáneamente un pase específico.
* `emergencyRevokeAll()`: **Kill-Switch** $O(1)$ que incrementa la época del paciente e invalida instantáneamente todos sus pases previos (~45k gas sin importar cuántos pases existan).
* `isAccessValid(recordId)` / `getGrantMetadata(recordId)` / `getGrantsBySpecialist(specialist)`: Consultadas por el Key-Release Gateway y por la bandeja on-chain del especialista.

### Módulo 2: Registro HBOM & Firmware Biónico
* `registerBionicPart(bearer, zone, modelName, serialNumber, firmwareHash, calibrationHash, pqcSignature) → partId`: Ejecutado por el fabricante OEM (`msg.sender`); calcula `partId = computePartId(fabricante, serial)`, almacena el `keccak256` de la firma `ML-DSA-87` en storage y emite la firma completa en el evento `FirmwareAttestation` (~442k gas).
* `logFirmwareUpdate(partId, newFirmwareHash, newCalibrationHash, pqcSignature)`: Registra parches monotónicos de firmware (exclusivo del fabricante OEM).
* `updatePartStatus(partId, newStatus)`: Cambia el estado operativo (`ACTIVE`, `MAINTENANCE`, `DECOMMISSIONED`); `DECOMMISSIONED` es un estado terminal irreversible.
* `getBionicPart(partId)` / `getPartsByBearer(bearer)` / `getFirmwareHistory(partId)`: Consultas completas del inventario corporal y su auditoría histórica.

### Módulo 3: Directorio On-Chain de Claves Públicas `ML-KEM-1024` (QoreChain PKI)
* `registerKemPublicKey(bytes calldata pubKey)`: Publica on-chain la clave pública `ML-KEM-1024` (`1,568 bytes` NIST FIPS 203) del médico o bio-ingeniero.
* `getKemPublicKey(address account)` / `hasKemPublicKey(address account)`: Resuelve directamente desde QoreChain la llave pública post-cuántica de cualquier especialista antes de cifrar.

---

## ⚡ Automatización con `Makefile` (Instalación, Inicio, Detenido y Pruebas)

El proyecto cuenta con un [Makefile](Makefile) unificado que automatiza todo el ciclo de vida del stack (contratos Foundry, nodo local Anvil, Key-Release Gateway, SDK Post-Cuántico y Frontend React + Tailwind v4).

### Tabla de Comandos `make`
Ejecuta `make` o `make help` en la raíz del repositorio para listar todos los comandos disponibles:

| Comando | Descripción |
| :--- | :--- |
| `make build` | ⚙️ **Primera vez:** instala `forge-std`, compila los contratos Solidity en Foundry, instala dependencias en `sdk/`, `gateway/` y `frontend/`, y verifica el build de producción. |
| `make init` | 🚀 **Levantar el stack local:** inicia en background el nodo EVM **Anvil (`Chain ID 9800`)** en `:8545`, despliega automáticamente `SynapseVaultRegistry.sol`, levanta el **Key-Release Gateway** en `:4000` y el **Frontend Bio-HUD** en `:5173`, verificando con healthcheck HTTP que todos respondan. |
| `make down` | 🛑 **Detener el stack local:** finaliza únicamente los procesos lanzados por `make init` mediante sus archivos PID (`Anvil`, `Gateway` y `Frontend`). |
| `make test` | 🧪 **Suite completa acumulada:** ejecuta en orden `make lint` + `make test-contracts` + `make test-sdk` + `make test-gateway` + `make test-front`. |
| `make test-contracts` | ⛓️ Ejecuta los **24 tests unitarios**, regresiones de seguridad, *timelocks* (`vm.warp`), *Kill-Switch* $O(1)$, HBOM, PKI y *fuzzing* en Foundry (`forge test -vvv`). |
| `make test-gateway` | 🛡️ Ejecuta las **3 suites de pruebas del Key-Release Gateway** (Shamir 2-de-3, custodia/liberación condicionada, tokens de descarga, cuotas, CORS y *crypto-shredding*). |
| `make test-sdk` | 🔐 Valida tipado (`tsc --noEmit`), linting (`eslint`) y ejecuta la simulación de 5 vectores de defensa post-cuántica. |
| `make test-quantum` | 🛡️ Ejecuta `sdk/src/quantumDefenseSim.ts` probando los 5 vectores de ataque Q-Day (HNDL, Tampering de 1 bit, SHAKE-256 mismatch, falsificación `ML-DSA-87` y `SynapseStorageRouter`). |
| `make cbom` | 📋 Audita y valida el reporte **CycloneDX CBOM v1.6** ([cbom-report.json](cbom-report.json)). |
| `make test-front` | ⚛️ Valida el tipado estricto y la compilación de producción (`vite build`) del Frontend. |
| `make lint` | 🔍 Verificación de formato y tipos en todo el monorepo (`forge fmt --check` + `eslint` + `tsc` en `sdk`, `gateway` y `frontend`). |
| `make audit` | 🛡️ Auditoría de seguridad de dependencias (`npm audit`) en `sdk/`, `gateway/` y `frontend/`. |
| `make demo` | 🎯 Ejecuta la demo end-to-end post-cuántica de 7 pasos (`sdk/src/demo.ts`) contra el nodo local y el Key-Release Gateway activos. |
| `make deploy-local` | 📦 Despliega `SynapseVaultRegistry.sol` en el nodo Anvil local (`:8545`). |
| `make deploy-diana` | 🌐 Despliega `SynapseVaultRegistry.sol` en **QoreChain Diana Testnet real (`Chain ID 9800`)** usando las variables de `.env`. |
| `make clean` | 🗑️ Detiene el stack activo y limpia artefactos de compilación, cachés, PIDs y logs temporales (`/tmp/synapseq-*`). |

### Flujo Rápido Recomendado con `make`
```bash
# 1. Clonar el repositorio y crear el archivo .env (opcional para desarrollo local)
git clone https://github.com/Oriojas/SynapseQ.git
cd SynapseQ
cp .env.example .env

# 2. Instalar dependencias y compilar los 4 módulos (primera vez)
make build

# 3. Levantar todo el entorno local (Anvil :8545 + Deploy Contrato + Gateway :4000 + Frontend :5173)
make init

# 4. Ejecutar la demo criptográfica de 7 pasos contra el stack local activo
make demo

# 5. Ejecutar la suite completa de calidad, 24 tests Foundry, Gateway, Simulación Q-Day y CBOM
make test
make cbom

# 6. Detener los servicios de SynapseQ
make down
```

---

## 👥 Equipo de Desarrollo

| Integrante | GitHub | Rol Principal | Enfoque en SynapseQ |
| :--- | :--- | :--- | :--- |
| **Oscar Riojas** | [@Oriojas](https://github.com/Oriojas) | **Tech Lead, PQC Cryptography, Storage & UI/UX** | Criptografía `ML-KEM-1024` / `ML-DSA-87`, integración con IPFS, diseño UI/UX en Stitch MCP (*Map-First Tactical HUD — Rebecca Glass*), automatización `Makefile` y reporte CycloneDX CBOM (`cbom-report.json`). |
| **Luis Felipe Marín** | [@LuisFelipe09](https://github.com/LuisFelipe09) | **Smart Contracts, PQC Security & Blockchain Engineer** | Arquitectura de `SynapseVaultRegistry.sol` v2 (Compromisos + HBOM + Kill-Switch $O(1)$ + PKI) en **Foundry**, **Zero-Trust Key-Release Gateway**, recuperación Shamir 2-de-3, SDK `@qorechain/rdk` y auditoría de seguridad (24 tests). |
| **Jhon Tejada** | [@tejada95](https://github.com/tejada95) | **Frontend, UX & Backend Integration** | Componentes interactivos del Portal Paciente/Ciber-Humano y Portal Especialista, experiencia de usuario y flujos de integración Web3. |

---

## 🔗 Enlaces del Ecosistema QoreChain

* **Hackathon Build Before Q-Day:** https://build.qorechain.io/es/projects
* **Documentación Oficial QoreChain:** https://docs.qorechain.io/es/introduction
* **RPC Oficial Diana Testnet (Chain ID 9800):** `https://evm-testnet.qore.host`
* **Faucet Oficial Diana Testnet:** https://dashboard.qorechain.io/faucet

---

## 📄 Licencia

Distribuido bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más información.

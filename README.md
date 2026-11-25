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
|       |     Blob cifrado (.enc) enviado a IPFS (o almacenamiento local en desarrollo) ---> Obtiene CID      |
|       |                                                                                                     |
|       +---> Encapsulamiento Post-Cuántico (NIST FIPS 203 ML-KEM-1024):                                      |
|       |     Encapsula la clave AES-256 usando la clave pública ML-KEM-1024 del Médico o Bio-Ingeniero.      |
|       |                                                                                                     |
|       +---> Firmas de Firmware y Certificación HBOM (NIST FIPS 204 ML-DSA-87):                              |
|       |     Firma inmutable de parches de firmware y especificaciones del fabricante OEM.                   |
|       |                                                                                                     |
|  [ 2. SMART CONTRACT: SynapseVaultRegistry.sol (Foundry / QoreChain Diana Chain ID 9800) ]                  |
|       |                                                                                                     |
|       +---> Storage privado (_grants): nadie puede leer CID ni sobres saltándose las validaciones.          |
|       +---> Módulo Clínico / Efímero: grantTimedAccess, extendAccess, revokeAccess, emergencyRevokeAll.     |
|       +---> Módulo HBOM: registerBionicPart, logFirmwareUpdate, updatePartStatus, getFirmwareHistory.       |
|       +---> Valida estrictamente specialist == msg.sender, !revoked y block.timestamp <= validUntil.        |
|       |                                                                                                     |
|  [ 3. PORTAL ESPECIALISTA (Médico / Bio-Ingeniero) ]                                                        |
|       |                                                                                                     |
|       +---> Invoca getRecordForSpecialist(recordId) en QoreChain Diana Testnet.                             |
|       |     • Vigente: recibe (ipfsCID, contentHash, linkedPartId, encryptedKeyEnvelope, validUntil).       |
|       |     • Expirado o Revocado: RECHAZADO on-chain (AccessExpired / AccessAlreadyRevoked).               |
|       +---> Desencapsula ML-KEM-1024 localmente, descifra AES-256-GCM en memoria y verifica SHAKE-256.      |
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
├── contracts/                         # Smart Contracts (Foundry / Solidity 0.8.24)
│   ├── foundry.toml                   # Configuración EVM ("paris") y RPC Diana Testnet (9800)
│   ├── .env.example                   # Plantilla de RPC y clave privada de despliegue
│   ├── src/
│   │   └── SynapseVaultRegistry.sol   # Contrato unificado: Acceso Efímero + Kill-Switch + HBOM
│   ├── test/
│   │   └── SynapseVaultRegistry.t.sol # 11 tests unitarios, timelocks (vm.warp) y fuzz testing
│   └── script/
│       └── DeploySynapseVault.s.sol   # Script de despliegue para fork local o Diana Testnet
├── sdk/                               # SDK Post-Cuántico Browser-Safe (TypeScript + Viem)
│   ├── package.json
│   └── src/
│       ├── pqc.ts                     # ML-KEM-1024, ML-DSA-87, SHAKE-256 y AES-256-GCM
│       ├── abi.ts                     # ABI tipado de SynapseVaultRegistry para viem/wagmi
│       └── demo.ts                    # Demo end-to-end contra fork local de QoreChain (9800)
└── docs/
    └── synapseq-plan-hackathon-v2.md  # Planificación inicial del sprint
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
* **Almacenamiento Cifrado:** IPFS / Pinata (con fallback local `.local-ipfs/` para desarrollo y demos offline).

---

## 📜 Especificación de `SynapseVaultRegistry.sol`

### Módulo 1: Acceso Efímero Post-Cuántico
* `grantTimedAccess(recordId, ipfsCID, contentHash, linkedPartId, specialist, encryptedKeyEnvelope, domain, durationInSeconds)`: Emite un pase temporal clínico o ligado a una pieza biónica.
* `extendAccess(recordId, extraSeconds)`: Extiende la vigencia de un pase no revocado.
* `revokeAccess(recordId)`: Revoca instantáneamente un pase específico.
* `emergencyRevokeAll()`: **Kill-Switch** que extingue todos los pases activos del paciente/ciber-humano en una sola transacción.
* `getRecordForSpecialist(recordId)`: Retorna `(ipfsCID, contentHash, linkedPartId, encryptedKeyEnvelope, domain, validUntil)` únicamente si `specialist == msg.sender`, `!revoked` y `block.timestamp <= validUntil`.
* `getGrantMetadata(recordId)`: Expone metadatos no sensibles para dashboards sin filtrar `ipfsCID` ni el sobre `ML-KEM-1024`.

### Módulo 2: Registro HBOM & Firmware Biónico
* `registerBionicPart(partId, manufacturer, zone, modelName, serialNumber, firmwareHash, calibrationHash, pqcSignature)`: Registra una pieza ciber-humana con atestación `ML-DSA-87`.
* `logFirmwareUpdate(partId, newFirmwareHash, newCalibrationHash, pqcSignature)`: Registra parches de firmware inmutables (solo portador o fabricante OEM).
* `updatePartStatus(partId, newStatus)`: Cambia el estado operativo (`ACTIVE`, `MAINTENANCE`, `DECOMMISSIONED`).
* `getBionicPart(partId)` / `getPartsByBearer(bearer)` / `getFirmwareHistory(partId)`: Consultas completas del inventario corporal y su auditoría histórica.

---

## 🚀 Instalación, Fork Local y Pruebas

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

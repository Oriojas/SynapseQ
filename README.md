# 🧬⚙️ SynapseQ: Post-Quantum Ephemeral Health & Cyber-Human Augmentation Vault

[![Hackathon](https://img.shields.io/badge/QoreChain-Build%20Before%20Q--Day-6E56CF?style=for-the-badge)](https://build.qorechain.io/es/projects)
[![Network](https://img.shields.io/badge/Network-QoreChain%20Diana%20(Chain%20ID%209800)-00D1B2?style=for-the-badge)](https://dashboard.qorechain.io/faucet)
[![PQC](https://img.shields.io/badge/PQC-ML--KEM--1024%20%2B%20ML--DSA--87-FF3860?style=for-the-badge)](https://build.qorechain.io/es/kits)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **"Protegiendo la biología humana del presente y asegurando la trazabilidad biónica de los ciber-humanos del mañana frente a la era cuántica."**

---

## 🌐 Visión Dual: De la Medicina Actual a la Era Ciber-Humana

**SynapseQ** nace como una bóveda descentralizada de datos biomédicos con resistencia post-cuántica y control de acceso efímero (*ephemeral access*). Sin embargo, su arquitectura está diseñada para trascender el expediente clínico tradicional y convertirse en el **estándar criptográfico de catalogación y trazabilidad de piezas biónicas, neuro-prótesis y órganos sintéticos para los futuros ciber-humanos**.

### 1. El Presente: Soberanía de Datos Clínicos e Imágenes Médicas
Los registros médicos actuales (estudios DICOM, resonancias magnéticas, perfiles genómicos e historiales clínicos) requieren una confidencialidad superior a **50-70 años**. A diferencia de una clave bancaria, tu ADN y tu historial médico no se pueden rotar ni revocar tras una filtración.
* **Defensa contra ataques *Harvest Now, Decrypt Later* (HNDL):** Los adversarios ya interceptan tráfico médico cifrado con algoritmos clásicos (RSA/ECC) esperando ordenadores cuánticos capaces de ejecutar el algoritmo de Shor.
* **Acceso Efímero Auto-Soberano:** Inspirado en la sinapsis neuronal, el paciente otorga pases temporales de lectura a médicos especialistas. Al expirar el contador o revocarse manualmente, el contrato inteligente extingue el acceso de forma inmutable.

### 2. El Futuro: Catalogación y Trazabilidad de Piezas para Ciber-Humanos
A medida que la humanidad integra interfaces cerebro-computadora (BCI), extremidades biónicas, exoesqueletos, implantes cocleares/retinianos y órganos bio-impresos, **el cuerpo humano pasa a tener una Cadena de Suministro y una Lista de Materiales (*Human Bill of Materials* - HBOM)**.
* **Vulnerabilidad Cuántica en Cuerpo Humano:** Si un ordenador cuántico vulnera la firma criptográfica de un marcapasos cuántico, un brazo biónico o un implante neural, el riesgo deja de ser una simple filtración de privacidad y pasa a ser el **secuestro físico o alteración de una parte del cuerpo humano**.
* **Catalogación Universal de Piezas Humanas:** SynapseQ permite registrar cada componente biónico o biológico implantado como un activo único auditable: fabricante, lote, modelo, especificaciones de biocompatibilidad, versión de firmware y hash de calibración.
* **Trazabilidad del Ciclo de Vida Biónico:** Desde la manufactura del implante y el quirófano de ensamblaje, pasando por mantenimientos preventivos, parches de firmware firmados con `ML-DSA-87`, hasta el reemplazo o reciclaje de la pieza humana.
* **Pases Efímeros para Bio-Ingenieros:** Un ciber-humano puede otorgar acceso temporal (ej. 2 horas) a un técnico biomecánico o cirujano biónico para diagnosticar la telemetría de su prótesis o auditar el historial de su implante sin entregar el control permanente de su hardware corporal.

---

## 🏗️ Arquitectura del Sistema (Flujo Híbrido Tripartito)

SynapseQ articula almacenamiento descentralizado para archivos pesados (estudios DICOM y planos/telemetría biónica), gobernanza on-chain en **QoreChain Diana Testnet** y un motor relacional off-chain para indexación rápida sin exponer datos sensibles:

```text
+-------------------------------------------------------------------------------------------------------------+
|                                  ARQUITECTURA INTEGRADA SYNAPSEQ (BIO + CYBER)                              |
+-------------------------------------------------------------------------------------------------------------+
|                                                                                                             |
|  [ 1. FRONTEND: PORTAL PACIENTE / CIBER-HUMANO ]                                                            |
|       |                                                                                                     |
|       +---> Cifrado simétrico local en navegador (AES-256-GCM):                                             |
|       |     • Datos Clínicos: Resonancias (DICOM), laboratorios, genómica.                                  |
|       |     • Catálogo Ciber-Humano: Telemetría de prótesis, logs de implantes BCI, planos CAD/firmware.    |
|       |     Blob cifrado enviado a IPFS (Storage descentralizado) -------------------> Obtiene CID          |
|       |                                                                                                     |
|       +---> Encapsulamiento Post-Cuántico con QoreSeal (ML-KEM-1024):                                       |
|       |     Encapsula la clave AES usando la clave pública post-cuántica del Médico o Bio-Ingeniero.        |
|       |                                                                                                     |
|       +---> Backend Off-Chain (Node.js + PostgreSQL):                                                       |
|       |     Indexa metadatos no sensibles: catálogo de piezas biónicas, número de serie, especialidad, cita.|
|       |                                                                                                     |
|       +---> Transacción On-Chain en QoreChain Diana (EVM Chain ID 9800):                                    |
|             Firma híbrida secp256k1 + ML-DSA-87 (QoreSign / QoreX Wallet).                                  |
|             Registra trazabilidad de la pieza humana o invoca grantTimedAccess(...)                         |
|                                                                                                             |
|  [ 2. SMART CONTRACT: SynapseVaultRegistry.sol (QoreChain Diana Testnet) ]                                  |
|       |                                                                                                     |
|       +---> Custodia pases temporales: recordId => { ipfsCID, specialist, envelope, validUntil, revoked }   |
|       +---> Registro de Trazabilidad Biónica: partId => { manufacturer, firmwareHash, implantDate, status } |
|       +---> Valida marcas de tiempo (block.timestamp <= validUntil) y estado de revocación inmutable.       |
|                                                                                                             |
|  [ 3. FRONTEND: PORTAL DOCTOR / BIO-INGENIERO ]                                                             |
|       |                                                                                                     |
|       +---> Autenticación Web3 con Wallet QoreX.                                                            |
|       +---> Consulta catálogo de piezas implantadas o expedientes clínicos asignados.                       |
|       +---> Smart Contract verifica vigencia del pase temporal:                                             |
|       |     - Si block.timestamp <= validUntil: entrega sobre post-cuántico ML-KEM-1024.                    |
|       |     - Si expiró o fue revocado: RECHAZA la llamada y bloquea el acceso en cadena.                   |
|       +---> Desencapsulamiento local en memoria con la clave privada del especialista.                      |
|       +---> Descifra desde IPFS y visualiza el estudio DICOM o el gemelo digital de la pieza ciber-humana.  |
|                                                                                                             |
+-------------------------------------------------------------------------------------------------------------+
```

---

## 🦾 Módulo de Catalogación y Trazabilidad Ciber-Humana (HBOM)

Para responder a los desafíos de la aumentación humana, SynapseQ estructura el inventario corporal mediante cuatro pilares de trazabilidad post-cuántica:

| Dimensión | Aplicación en Salud Biológica Actual | Aplicación en Catalogación Ciber-Humana (Futuro) |
| :--- | :--- | :--- |
| **Activo Custodiado** | Imágenes DICOM, análisis de sangre, recetas, biopsias, historial genético. | Neuro-implantes, prótesis robóticas, órganos sintéticos, sensores subdérmicos, córneas biónicas. |
| **Identificador Único** | Hash SHA-3 del expediente médico + CID en IPFS. | **Cyber-Part ID (DID):** Serial de fábrica + Hash de firmware (`ML-DSA-87`) + Zona anatómica de implante. |
| **Trazabilidad On-Chain** | Registro de quién accedió al estudio clínico y durante qué ventana de tiempo. | Cadena de custodia completa: *Fabricante OEM ➔ Clínica de Implante ➔ Actualizaciones de Firmware ➔ Auditoría de Mantenimiento*. |
| **Control Efímero** | Pase de 24h a un médico para segunda opinión diagnóstica. | Pase de 1h a un laboratorio bio-mecánico para leer telemetría de desgaste articular y calibrar servomotores o enlaces neurales. |

---

## 🛠️ Stack Tecnológico

### Criptografía Post-Cuántica y Blockchain (Ecosistema QoreChain)
* **Red de Despliegue:** QoreChain Diana Testnet (Lane EVM, Chain ID `9800`).
* **Encapsulamiento de Claves (KEM):** `qorechain-qoreseal` implementando el estándar NIST **ML-KEM-1024** (FIPS 203).
* **Firmas Digitales Híbridas:** `qorechain-qoresign` y `qorechain-sdk` implementando **secp256k1 + ML-DSA-87** (FIPS 204) para transacciones de consentimiento médico y certificación de firmware biónico.
* **Smart Contracts:** Solidity `^0.8.20` gestionado y probado con **Hardhat**.
* **Auditoría Criptográfica (CBOM):** `qorescan` CLI para generación de reportes CycloneDX que certifican la ausencia de primitivas vulnerables al Día Q (*Q-Day*).

### Almacenamiento y Persistencia Híbrida
* **Almacenamiento Descentralizado (IPFS):** Nodos IPFS / Pinata Gateway para alojar blobs pre-cifrados (AES-256-GCM en cliente) de estudios clínicos pesados y manuales/telemetría de piezas biónicas.
* **Base de Datos Relacional Off-Chain (PostgreSQL + Node.js / Express):**
  * Indexa el **Catálogo de Piezas Humanas** (compatibilidad biológica, fabricante, modelo, versión de hardware, métricas operativas sin datos personales en texto plano).
  * Gestiona el directorio de médicos, bio-ingenieros y logs de auditoría de cumplimiento.

### Frontend & Experiencia de Usuario
* **Framework:** Next.js (App Router) + React + TypeScript.
* **Interfaz y Diseño:** Tailwind CSS + Lucide React Icons (Dashboard dual: *Modo Clínico* y *Modo Inventario Ciber-Humano*).
* **Conectividad Web3:** `@qorechain/react`, `@qorechain/qorex-rainbowkit`, `wagmi`, `viem`.

---

## 📜 Especificación On-Chain y Modelo de Datos

### Smart Contract (`SynapseVaultRegistry.sol`)
El contrato inteligente actúa como el guardián temporal de las claves encapsuladas y como registro inmutable de eventos médicos y biónicos:
* `grantTimedAccess(bytes32 recordId, string ipfsCID, address doctor, bytes encryptedKeyEnvelope, uint256 durationInSeconds)`: Registra un pase temporal hacia un expediente médico o ficha técnica de un implante ciber-humano.
* `revokeAccess(bytes32 recordId)`: Interruptor de emergencia (*Kill-Switch*) firmado por el paciente/ciber-humano para cortar instantáneamente el acceso a su información o telemetría corporal.
* `getRecordForDoctor(bytes32 recordId)`: Valida estrictamente en la EVM que `block.timestamp <= validUntil` y `!revoked` antes de retornar el sobre post-cuántico `ML-KEM-1024`.

### Esquema Off-Chain de Catalogación y Metadatos (PostgreSQL)
Además de las tablas operativas de usuarios (`users`), expedientes clínicos (`clinical_records_metadata`) y auditoría (`access_audit_logs`), la arquitectura contempla el catálogo de componentes humanos:
* **Catálogo de Piezas Ciber-Humanas (`cyber_human_parts_catalog`):** Registra identificador del componente (`part_hash`), billetera del portador, categoría anatómica (*Neural*, *Ocular*, *Cardiovascular*, *Locomotor*), fabricante certificado, versión de firmware verificada con `ML-DSA-87`, fecha de acoplamiento e historial de mantenimiento.

---

## ⚙️ Configuración y Variables de Entorno

Siguiendo estrictas prácticas de seguridad, ninguna credencial, clave privada ni endpoint sensible se encuentra hardcodeado en el código fuente. Para desplegar el proyecto localmente, copia el archivo `.env.example` a `.env` y configura tus variables de entorno:

```bash
# Red QoreChain Diana Testnet
NEXT_PUBLIC_QORECHAIN_RPC_URL="<TU_RPC_URL_DIANA_TESTNET>"
NEXT_PUBLIC_QORECHAIN_CHAIN_ID="9800"
NEXT_PUBLIC_SYNAPSE_VAULT_CONTRACT_ADDRESS="<DIRECCION_DEL_CONTRATO_DESPLEGADO>"

# Despliegue Hardhat (NUNCA subir claves reales al repositorio)
DEPLOYER_PRIVATE_KEY="<TU_CLAVE_PRIVADA_DE_TESTNET>"

# Almacenamiento Descentralizado IPFS
NEXT_PUBLIC_IPFS_GATEWAY_URL="<URL_GATEWAY_IPFS>"
IPFS_API_KEY="<TU_API_KEY_IPFS>"
IPFS_API_SECRET="<TU_API_SECRET_IPFS>"

# Base de Datos Off-Chain (PostgreSQL)
DATABASE_URL="postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:<DB_PORT>/<DB_NAME>"
PORT="4000"
```

---

## 🚀 Instalación y Uso Rápido

```bash
# 1. Clonar el repositorio
git clone https://github.com/Oriojas/SynapseQ.git
cd SynapseQ

# 2. Instalar dependencias
npm install

# 3. Compilar y probar el Smart Contract en Hardhat
npx hardhat compile
npx hardhat test

# 4. Auditar inventario criptográfico post-cuántico (CBOM)
qorescan --output cbom-report.json

# 5. Iniciar entorno de desarrollo
npm run dev
```

---

## 👥 Equipo de Desarrollo

| Integrante | GitHub | Rol Principal | Enfoque en SynapseQ |
| :--- | :--- | :--- | :--- |
| **Oscar Riojas** | [@Oriojas](https://github.com/Oriojas) | **Tech Lead, PQC Cryptography & Storage** | Implementación de `QoreSeal` (`ML-KEM-1024`), firmas híbridas `QoreSign` (`ML-DSA-87`), integración con IPFS para expedientes y telemetría biónica, y generación de auditoría CBOM con `qorescan`. |
| **Luis Felipe Marín** | [@LuisFelipe09](https://github.com/LuisFelipe09) | **Smart Contracts & Blockchain Engineer** | Desarrollo y pruebas de seguridad de `SynapseVaultRegistry.sol` en Hardhat, validación de *timelocks* on-chain, revocación inmutable y despliegue en QoreChain Diana Testnet (`Chain ID 9800`). |
| **Jhon Tejada** | [@tejada95](https://github.com/tejada95) | **Frontend, UX & Backend Integration** | Interfaz en Next.js/Tailwind para el Portal Paciente/Ciber-Humano y Portal Especialista, integración de wallets con `@qorechain/react` & QoreX, y API Node.js/PostgreSQL para catalogación off-chain. |

---

## 🔗 Enlaces del Ecosistema QoreChain

* **Hackathon Build Before Q-Day:** https://build.qorechain.io/es/projects
* **Documentación y Kits PQC:** https://build.qorechain.io/es/kits
* **Faucet Oficial Diana Testnet (Chain ID 9800):** https://dashboard.qorechain.io/faucet

---

## 📄 Licencia

Distribuido bajo la licencia **MIT**. Consulta el archivo `LICENSE` para más información.

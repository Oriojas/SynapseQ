# SynapseQ: Plan Estratégico, Arquitectura y Hoja de Ruta de Desarrollo

> **Hackathon:** Build Before Q-Day (QoreChain)  
> **Proyecto:** SynapseQ — Post-Quantum Ephemeral Health Data Vault  
> **Repositorio Oficial:** Oriojas / SynapseQ  
> **Licencia:** MIT (Open Source)  
> **Categoría Principal:** Post-Quantum dApp (Premios: $10,000 USD 1er lugar / $750 USD 2do lugar / $500 USD 3er lugar en stablecoin + grants en QOR)  
> **Categoría Secundaria:** Encrypted Apps (Elegibilidad dual por cifrado ML-KEM-1024)  
> **Premio Comunitario:** People's Choice (Votación descentralizada con wallets QoreX: 6 al 15 de diciembre)  
> **Red de Despliegue:** QoreChain Diana Testnet (EVM Lane, Chain ID 9800)  
> **Fecha Límite de Entrega:** 2 de diciembre de 2026 (Sprint de 5 Días)  

---

## 1. Visión del Producto y Justificación Técnica

### 1.1. Definición del Problema
Los registros médicos, historiales clínicos, resultados de laboratorio, consentimientos informados e imágenes diagnósticas de alta resolución (como resonancias magnéticas y tomografías en formato DICOM) poseen una vida útil de confidencialidad legal y personal superior a **50 a 70 años**. A diferencia de una tarjeta de crédito o una clave financiera convencional, la información genética y biomédica de una persona **no se puede rotar ni revocar** tras una filtración.

En la actualidad, estos datos enfrentan dos vulnerabilidades críticas en el entorno digital:
1. **Ataques "Harvest Now, Decrypt Later" (HNDL):** Adversarios interceptan y almacenan tráfico cifrado hoy con algoritmos clásicos (RSA, curvas elípticas secp256k1) a la espera de ordenadores cuánticos comerciales capaces de ejecutar el algoritmo de Shor y romper el cifrado en segundos.
2. **Sobre-exposición y pérdida de soberanía:** Cuando un paciente comparte un estudio clínico con un médico especialista o en una consulta de telemedicina de emergencia, pierde el control sobre la copia digital de su información indefinidamente, sin posibilidad de extinguir el acceso una vez concluida la atención.

### 1.2. La Solución: SynapseQ
**SynapseQ** es una aplicación descentralizada de custodia médica auto-soberana con resistencia post-cuántica y control de acceso temporal (*ephemeral access*). Inspirada en la sinapsis biológica (la unión y transmisión precisa y transitoria de información entre dos células), SynapseQ permite al paciente otorgar pases de consulta temporal a profesionales de la salud.

Al vencer el tiempo pactado (ej. 24 horas, 48 horas o 7 días) o mediante una orden de revocación manual firmada con criptografía híbrida (`ML-DSA-87`), el contrato inteligente extingue el acceso de manera inmutable, asegurando que nadie pueda volver a descifrar el archivo médico.

---

## 2. Arquitectura del Sistema (Flujo Híbrido Tripartito)

El sistema combina almacenamiento distribuido inmutable, una capa de datos operacionales off-chain y gobernanza post-cuántica on-chain:

```
+---------------------------------------------------------------------------------------------------------+
|                                      ARQUITECTURA INTEGRADA SYNAPSEQ                                    |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  [ 1. FRONTEND: PORTAL PACIENTE ]                                                                       |
|       |                                                                                                 |
|       +---> Cifrado simétrico local en navegador: Archivo médico pesado -> AES-256-GCM                  |
|       |     Blob cifrado enviado a IPFS (Storage descentralizado) ---------> Obtiene CID                |
|       |                                                                                                 |
|       +---> Encapsulamiento post-cuántico con QoreSeal (ML-KEM-1024):                                   |
|       |     Encapsula la clave simétrica usando la clave pública post-cuántica del Doctor               |
|       |                                                                                                 |
|       +---> Backend Off-Chain (Node.js + PostgreSQL):                                                   |
|       |     Registra metadatos descriptivos sin datos sensibles (nombre de estudio, especialidad, cita) |
|       |                                                                                                 |
|       +---> Transacción On-Chain en QoreChain Diana (EVM 9800):                                         |
|             Firma híbrida secp256k1 + ML-DSA-87 (QoreSign / QoreX)                                      |
|             Llama a grantTimedAccess(recordId, ipfsCID, doctorAddress, envelope, duration)              |
|                                                                                                         |
|  [ 2. SMART CONTRACT: SynapseVaultRegistry.sol (Hardhat / Solidity en Diana Testnet) ]                  |
|       |                                                                                                 |
|       +---> Almacena mapping inmutable: recordId => { ipfsCID, doctor, envelope, validUntil, revoked }  |
|       +---> Valida marcas de tiempo (block.timestamp <= validUntil) y no revocación                     |
|                                                                                                         |
|  [ 3. FRONTEND: PORTAL DOCTOR ]                                                                         |
|       |                                                                                                 |
|       +---> Autenticación con Wallet QoreX / Web3                                                       |
|       +---> Backend Node.js/PostgreSQL lista citas y metadatos clínicos asignados                       |
|       +---> Smart Contract verifica vigencia del pase temporal:                                         |
|       |     - Si block.timestamp <= validUntil: entrega sobre ML-KEM-1024                               |
|       |     - Si expiró o fue revocado: RECHAZA la llamada y bloquea la entrega                         |
|       +---> Desencapsulamiento local en memoria con la clave privada del Doctor                         |
|       +---> Descarga blob de IPFS, descifra en memoria y visualiza estudio clínico (DICOM/PDF)          |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
```

---

## 3. Asignación de Roles y Matriz de Responsabilidades (Equipo de 3)

La división del trabajo capitaliza la experiencia previa de los tres integrantes, acordada formalmente en la llamada de alineación:

| Integrante | Identificador GitHub | Rol Principal | Responsabilidades Específicas |
| :--- | :--- | :--- | :--- |
| **Oscar Riojas** | Oriojas | **Tech Lead, Criptografía PQC & Storage** | • Implementación de `QoreSeal` (ML-KEM-1024) para encapsulamiento en cliente.<br>• Integración de almacenamiento descentralizado en IPFS (reutilización de arquitectura de `SciFile-IPFS`).<br>• Configuración de firmas híbridas `secp256k1 + ML-DSA-87` con `QoreSign` y `qorechain-sdk`.<br>• Generación del reporte CBOM CycloneDX con `qorescan` CLI.<br>• Creación del script de prueba para demostrar el fallo de ataque cuántico en el video pitch. |
| **Luis Felipe Marín** | LuisFelipe09 | **Smart Contracts & Blockchain Engineer** | • Diseño y desarrollo del contrato `SynapseVaultRegistry.sol` en Solidity.<br>• Configuración del entorno de desarrollo y testing con **Hardhat**.<br>• Despliegue y verificación en la red **QoreChain Diana Testnet** (Chain ID `9800`).<br>• Pruebas unitarias de seguridad: validación de timelocks, expiración automática y funciones de revocación inmutable del paciente. |
| **Jhon Tejada** | tejada95 | **Frontend, UX & Backend Integration** | • Maquetación interactiva en **Next.js / React** con **Tailwind CSS** y **Lucide Icons**.<br>• Prototipado y experiencia de usuario: Vista Paciente (Drag & Drop, selector de tiempo) y Vista Doctor (cuenta regresiva en tiempo real, visor de imágenes médicas/PDF).<br>• Conexión Web3 con `@qorechain/react`, RainbowKit y QoreX Wallet.<br>• Implementación de la API en **Node.js/Express** con **PostgreSQL** para metadatos off-chain.<br>• Apoyo en la presentación visual y estética minimalista para la entrega. |

---

## 4. Stack Tecnológico Detallado

### 4.1. Criptografía y Blockchain (Ecosistema Oficial QoreChain)
* **Red de Despliegue:** QoreChain Diana Testnet (Lane EVM, Chain ID `9800`, RPC oficial Diana).
* **Cifrado y Encapsulamiento Post-Cuántica:** `qorechain-qoreseal` (algoritmo estandarizado **ML-KEM-1024**).
* **Firmas Híbridas y Autenticación:** `qorechain-qoresign` y `qorechain-sdk` (algoritmo **secp256k1 + ML-DSA-87**).
* **Entorno de Smart Contracts:** Solidity `^0.8.20` desarrollado y compilado con **Hardhat**.
* **Auditoría Criptográfica:** Herramienta CLI `qorescan` para exportación de CBOM (CycloneDX).

### 4.2. Almacenamiento y Persistencia
* **Almacenamiento Descentralizado (Blobs Pesados):** IPFS (nodos IPFS / Pinata Gateway) para alojar imágenes médicas y reportes clínicos pre-cifrados.
* **Base de Datos Relacional Off-Chain (Metadatos Operativos):** **PostgreSQL** administrada mediante API REST en **Node.js / Express**.
  * *Justificación de Arquitectura:* Almacena nombres de profesionales, directorios de especialidades, identificadores de pacientes y registros de auditoría de consulta sin almacenar datos médicos en texto plano ni congestionar la blockchain con transacciones superfluas.

### 4.3. Frontend & Librerías de Interfaz
* **Framework:** Next.js (App Router) o React con TypeScript.
* **Estilos y Componentes:** Tailwind CSS, Lucide React Icons.
* **Integración Web3:** `@qorechain/react`, `@qorechain/qorex-rainbowkit`, `wagmi`, `viem`.

---

## 5. Especificación del Smart Contract (`SynapseVaultRegistry.sol`)

El contrato inteligente reside en la EVM de QoreChain y gestiona las autorizaciones y la caducidad temporal:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SynapseVaultRegistry
 * @notice Registro descentralizado de pases medicos temporales con seguridad post-cuantica.
 * @dev Desarrollado para la hackathon Build Before Q-Day en QoreChain Diana Testnet (Chain ID 9800).
 */
contract SynapseVaultRegistry {
    struct AccessGrant {
        string ipfsCID;            // CID de IPFS con el archivo clinico cifrado (AES-256)
        address patient;            // Billetera del paciente (propietario)
        address doctor;             // Billetera del profesional autorizado
        bytes encryptedKeyEnvelope; // Clave simetrica encapsulada con ML-KEM-1024 (QoreSeal)
        uint256 validUntil;         // Marca de tiempo Unix de caducidad
        bool revoked;               // Estado de revocacion manual por el paciente
        uint256 createdAt;          // Fecha de creacion del pase
    }

    // Identificador del registro medico -> Informacion del pase
    mapping(bytes32 => AccessGrant) public grants;
    
    // Indice de consultas por medico: direccion del medico -> arreglo de recordIds
    mapping(address => bytes32[]) private doctorGrants;
    
    // Indice de consultas por paciente: direccion del paciente -> arreglo de recordIds
    mapping(address => bytes32[]) private patientGrants;

    // Eventos emitidos para sincronizacion con frontend e indexadores
    event AccessGranted(
        bytes32 indexed recordId,
        address indexed patient,
        address indexed doctor,
        uint256 validUntil,
        string ipfsCID
    );
    event AccessRevoked(bytes32 indexed recordId, address indexed patient, uint256 revokedAt);

    modifier onlyPatient(bytes32 recordId) {
        require(grants[recordId].patient == msg.sender, "SynapseQ: Solo el paciente puede ejecutar esta operacion");
        _;
    }

    /**
     * @notice Otorga un pase temporal de acceso al doctor especificado.
     * @param recordId Identificador unico generado en frontend (hash de expediente)
     * @param ipfsCID Hash de IPFS del blob cifrado
     * @param doctor Direccion de la billetera del doctor
     * @param encryptedKeyEnvelope Sobre post-cuantico ML-KEM-1024 con la clave de descifrado
     * @param durationInSeconds Duracion de la vigencia del pase (ej. 86400 para 24 horas)
     */
    function grantTimedAccess(
        bytes32 recordId,
        string calldata ipfsCID,
        address doctor,
        bytes calldata encryptedKeyEnvelope,
        uint256 durationInSeconds
    ) external {
        require(doctor != address(0), "SynapseQ: Direccion de doctor invalida");
        require(durationInSeconds > 0, "SynapseQ: La duracion debe ser mayor a 0");
        require(grants[recordId].createdAt == 0, "SynapseQ: El registro ya existe");

        uint256 expiry = block.timestamp + durationInSeconds;

        grants[recordId] = AccessGrant({
            ipfsCID: ipfsCID,
            patient: msg.sender,
            doctor: doctor,
            encryptedKeyEnvelope: encryptedKeyEnvelope,
            validUntil: expiry,
            revoked: false,
            createdAt: block.timestamp
        });

        doctorGrants[doctor].push(recordId);
        patientGrants[msg.sender].push(recordId);

        emit AccessGranted(recordId, msg.sender, doctor, expiry, ipfsCID);
    }

    /**
     * @notice Permite al paciente revocar de forma inmediata el acceso al estudio antes de que expire el tiempo.
     */
    function revokeAccess(bytes32 recordId) external onlyPatient(recordId) {
        require(!grants[recordId].revoked, "SynapseQ: El registro ya fue revocado previamente");
        grants[recordId].revoked = true;
        emit AccessRevoked(recordId, msg.sender, block.timestamp);
    }

    /**
     * @notice Funcion consultada por el doctor para obtener el sobre cifrado y el CID de IPFS.
     * @dev Revisa estrictamente que no este revocado y que el bloque actual no supere validUntil.
     */
    function getRecordForDoctor(bytes32 recordId) external view returns (
        string memory ipfsCID,
        bytes memory encryptedKeyEnvelope,
        uint256 validUntil
    ) {
        AccessGrant memory grant = grants[recordId];
        require(grant.doctor == msg.sender, "SynapseQ: Cuenta no autorizada para este registro");
        require(!grant.revoked, "SynapseQ: El acceso a este estudio fue revocado por el paciente");
        require(block.timestamp <= grant.validUntil, "SynapseQ: El pase temporal de consulta ha expirado");

        return (grant.ipfsCID, grant.encryptedKeyEnvelope, grant.validUntil);
    }

    function isAccessValid(bytes32 recordId) external view returns (bool) {
        AccessGrant memory grant = grants[recordId];
        return (!grant.revoked && block.timestamp <= grant.validUntil && grant.createdAt != 0);
    }

    function getGrantsByDoctor(address doctor) external view returns (bytes32[] memory) {
        return doctorGrants[doctor];
    }

    function getGrantsByPatient(address patient) external view returns (bytes32[] memory) {
        return patientGrants[patient];
    }
}
```

---

## 6. Modelo de Datos Off-Chain (PostgreSQL)

Para complementar la dApp sin cargar información operacional en los bloques, la API en Node.js gestionará las siguientes tablas relacionales:

```sql
-- Tabla de Perfiles Médicos y Pacientes (Metadatos no sensibles)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor')),
    full_name VARCHAR(150),
    institution_or_specialty VARCHAR(150),
    pq_public_key TEXT, -- Clave publica ML-KEM-1024 registrada
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Registros y Citas (Metadatos de visualizacion)
CREATE TABLE clinical_records_metadata (
    id SERIAL PRIMARY KEY,
    record_id_hash VARCHAR(66) UNIQUE NOT NULL, -- bytes32 en hexadecimal
    patient_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
    title VARCHAR(200) NOT NULL, -- ej. "Resonancia Magnetica Lumbar T2"
    modality VARCHAR(50) NOT NULL, -- DICOM, PDF_LAB, CONSENTIMIENTO
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Auditoría de Consultas (Logs de Compliance e Integridad)
CREATE TABLE access_audit_logs (
    id SERIAL PRIMARY KEY,
    record_id_hash VARCHAR(66) NOT NULL,
    doctor_wallet VARCHAR(42) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'VIEW_ATTEMPT', 'SUCCESSFUL_DECRYPT', 'EXPIRED_ATTEMPT'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. Cronograma de Desarrollo Día a Día (Fecha Límite: 2 de Diciembre)

El sprint comprende 5 días de trabajo intensivo con entregables diarios sincronizados:

```
DÍA 1 (25 de Noviembre): Inicialización, Entornos y Fondeo
+-------------------------------------------------------------------------------------------------+
| • Todos: Obtención de tokens QOR de prueba en el faucet oficial (Chain ID 9800).               |
| • Oscar: Configuración de scripts de derivación de claves QoreSeal (ML-KEM-1024) y QoreSign.   |
| • Luis Felipe: Inicialización del proyecto Hardhat, configuración del RPC de Diana y testnet.   |
| • Jhon: Inicialización del frontend en Next.js con Tailwind, layout base y configuración Wagmi.|
| HITO DÍA 1: Entornos locales configurados, wallets con gas y repositorio sincronizado.          |
+-------------------------------------------------------------------------------------------------+

DÍA 2 (26 de Noviembre): Smart Contracts, Criptografía y Backend
+-------------------------------------------------------------------------------------------------+
| • Luis Felipe: Escritura de SynapseVaultRegistry.sol, tests unitarios de timelock en Hardhat.  |
| • Oscar: Pipeline de cifrado local en memoria (AES-GCM) + encapsulamiento de clave en ML-KEM.  |
| • Jhon: API Node.js/Express + esquema PostgreSQL para metadatos de médicos y expedientes.      |
| HITO DÍA 2: Contrato listo para despliegue y función criptográfica de empaquetado validada.    |
+-------------------------------------------------------------------------------------------------+

DÍA 3 (27 de Noviembre): Despliegue en Diana Testnet y Vistas Frontend
+-------------------------------------------------------------------------------------------------+
| • Luis Felipe: Despliegue formal de SynapseVaultRegistry.sol en QoreChain Diana (Chain ID 9800)|
| • Jhon: Maquetación de la Vista Paciente (Drag & Drop de archivos, selector de horas/días).    |
| • Oscar: Integración de subida de archivos pre-cifrados a IPFS y retorno del CID.              |
| HITO DÍA 3: Contrato verificado on-chain y primer registro médico cargado en IPFS y testnet.   |
+-------------------------------------------------------------------------------------------------+

DÍA 4 (28 de Noviembre): Integración End-to-End y Vista Doctor
+-------------------------------------------------------------------------------------------------+
| • Jhon: Maquetación de la Vista Doctor (listado de expedientes activos, cuenta atrás temporal).|
| • Oscar & Jhon: Integración del desencapsulamiento con la clave privada del Doctor en browser. |
| • Luis Felipe: Pruebas de borde en testnet (expiración automática y revocación manual).         |
| • Oscar: Ejecución de qorescan CLI para generar el reporte de auditoría criptográfica CBOM.   |
| HITO DÍA 4: Flujo completo paciente-doctor operativo y verificado en la Testnet Diana.         |
+-------------------------------------------------------------------------------------------------+

DÍA 5 (29 de Noviembre - 1 de Diciembre): Estabilización, Documentación y Video Pitch
+-------------------------------------------------------------------------------------------------+
| • Todos: Pruebas de estrés y despliegue del frontend en Vercel o Cloudflare Pages.              |
| • Jhon & Oscar: Grabación y edición del video de demostración (máximo 3 minutos).               |
| • Oscar: Redacción final del README.md técnico y preparación del paquete de submission.         |
| • Luis Felipe: Documentación de direcciones de contratos verificados y hashes de despliegue.    |
| • 2 DE DICIEMBRE: Envío formal del proyecto en la plataforma oficial de proyectos de QoreChain. |
| HITO FINAL: Proyecto 100% entregado antes del deadline oficial.                                 |
+-------------------------------------------------------------------------------------------------+
```

---

## 8. Guión del Video de Demostración (3 Minutos para el Jurado)

1. **0:00 - 0:45 | La Amenaza Invisible (Introducción y Problema):**
   * Planteamiento del ataque *Harvest Now, Decrypt Later*. Por qué los datos médicos exigen criptografía post-cuántica hoy mismo y no en diez años.
2. **0:45 - 1:45 | Flujo del Paciente (Cifrado y Gobernanza Cuántica):**
   * El paciente conecta su wallet QoreX a la Testnet Diana (Chain ID 9800).
   * Carga una resonancia médica (DICOM/PDF). La dApp la cifra localmente y genera el sobre **ML-KEM-1024** con `QoreSeal`.
   * El paciente fija un pase temporal de 24 horas para su médico y firma la transacción híbrida **ML-DSA-87**.
3. **1:45 - 2:30 | Flujo del Doctor y Expiración Inmutable:**
   * El doctor conecta su wallet autorizada. Visualiza el expediente activo con la cuenta regresiva en pantalla.
   * Abre y visualiza el estudio médico descifrado en memoria.
   * Se muestra la prueba de expiración/revocación: el contrato inteligente rechaza llamadas una vez superado el tiempo o tras revocación manual.
4. **2:30 - 3:00 | Verificación On-Chain y Cumplimiento:**
   * Visualización de las transacciones en el explorador de QoreChain Diana.
   * Exhibición del reporte CBOM de `qorescan` certificando cumplimiento de estándares post-cuánticos del NIST.

---

## 9. Enlaces Oficiales y Recursos del Ecosistema

* **Plataforma de la Hackathon:** https://build.qorechain.io/es/projects
* **Premios de la Competencia:** https://build.qorechain.io/es/prizes
* **Reglamento Oficial:** https://build.qorechain.io/es/rules
* **Directorio de Kits y SDKs:** https://build.qorechain.io/es/kits
* **Faucet Oficial de Testnet (Diana - Chain ID 9800):** https://dashboard.qorechain.io/faucet

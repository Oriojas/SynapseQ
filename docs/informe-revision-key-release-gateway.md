# Informe de revisión y pruebas: rama `feat/key-release-gateway`

**Fecha:** 25 de noviembre de 2026
**Rama:** `feat/key-release-gateway`, con los cambios sin commitear: `gateway/`, `sdk/src/gatewayClient.ts`, `sdk/src/recovery.ts` y las variables de entorno del frontend.
**Entorno de pruebas:** Anvil local (chain ID 9800) con el contrato desplegado en `0x5FbDB2315678afecb367f032d93F642f64180aa3`, gateway en `:4000` y frontend Vite en `:5173`. Node v18.12.1 y Foundry 1.6.0-nightly.

---

## 0. Estado tras las correcciones (25 de noviembre, segunda pasada)

Los hallazgos de las secciones 3 a 5 se corrigieron en la misma rama, **sin commitear**. Todo se volvió a verificar en local: tests, script de ataque re-ejecutado y flujo completo en el navegador.

### Verificación

| Prueba | Antes | Después |
|---|---|---|
| Tests de contratos | 14/14 | ✅ **24/24**: incluye regresiones de cada hallazgo y gas con tamaños reales |
| Tests del gateway | 2 suites | ✅ **3 suites**: compromisos, token de descarga, cadena distinta, cuotas, CORS, error 503 |
| Lint y typecheck de SDK, gateway y frontend | ✅ | ✅ |
| Build del frontend | bundle de 3.4 MB | ✅ **728 KB** (`@qorechain/rdk` en un chunk que se carga bajo demanda) |
| Demo end-to-end (`make demo`) | ✅ pero con falsos positivos | ✅ 7 pasos que **fallan si algo revierte**: el sobre no está en el calldata; tras el Kill-Switch el gateway responde 403 |
| Script de ataque re-ejecutado | 11 de 11 vulnerables | ✅ **13 de 13 comprobaciones "FIXED"** |
| Navegador (wallet simulada contra Anvil) | éxitos falsos | ✅ ver la tabla siguiente |

**Pruebas en el navegador después de las correcciones:**
- Pase con una pieza de ejemplo → error claro *"es de ejemplo y no existe on-chain"*, sin enviar ninguna transacción.
- Seal & Grant → transacción real con `status=true`, **228 bytes de calldata** (solo hashes) y 177k de gas.
- El especialista descifra a través del gateway → muestra el JSON real subido por el paciente, con "1. QoreChain ✓" y la etiqueta *"Gateway release + verificación on-chain"*.
- Pase de ejemplo → error *"Pase de ejemplo: no tiene datos cifrados reales"*, sin datos sintéticos.
- Revocar → confirmado on-chain.
- Registro HBOM → `status=true`, **442k de gas** (antes 6.86M).
- Consola: 0 errores (antes había 6 de CORS).

### Qué se cambió, por hallazgo

| Hallazgo | Corrección |
|---|---|
| C1, C2, A4 | El contrato v2 solo guarda `contentHash` y `envelopeHash`. Se eliminó `getRecordForSpecialist`. El sobre y el CID viven en el gateway, que comprueba `keccak256(sobre) == envelopeHash` al guardar y el estado on-chain al entregar. |
| C3 | El frontend usa el gateway para subir el blob (`PIN`), guardar el sobre (`STORE`), liberarlo (`RELEASE`) y descargarlo con token. Se eliminó `VITE_PINATA_JWT`. |
| A1 | `contentHash` = SHAKE-256 del **texto cifrado**, verificado *antes* de descifrar. |
| A2 | El fabricante registra la pieza (`partId = keccak256(fabricante, serial)`). Solo el fabricante publica firmware. DECOMMISSIONED es terminal. Se rechazan firmas vacías. |
| A3 | `recordId = keccak256(paciente, salt)`. |
| A4 (Kill-Switch) | `emergencyRevokeAll` pasa a ser O(1) por época (~46k de gas, sin importar cuántos pases haya). `extendAccess` ya no revive pases vencidos. |
| M1 a M6 | Cuota de subida por wallet, token de descarga de un solo uso, límite de nonces pendientes por dirección y global, límite por IP, error 503 cuando la cadena no responde, mensaje firmado ligado al chain ID, lista de orígenes CORS permitidos (se rechaza `*`), carga de `.env` y rechazo de una dirección de contrato vacía. |
| N1, N2, N6 | `useSynapseVault` simula cada transacción antes de enviarla, exige `receipt.status === "success"` y muestra el error del contrato por nombre. Ya no hay estado optimista ni `catch {}` vacíos. Ya no aparece una wallet ficticia. El badge PKI refleja la cadena. La interfaz indica **ON-CHAIN** o **DEMO LOCAL**. |
| N5 | Se eliminó el descifrado sintético. Al cambiar de pase se borra el texto descifrado anterior (bug encontrado y corregido durante esta verificación). |
| Claves del especialista | La clave ML-KEM-1024 se deriva de la firma de la wallet (`deriveKemKeyPairFromSignature`), así que se puede recuperar. El paciente cifra con la clave publicada **on-chain**. |
| Demo, Makefile, CI | El demo valida cada recibo. `make init` levanta el gateway. `make down` solo detiene sus propios procesos (por PID). Se agregaron `make test-gateway`, los jobs de CI `gateway` y `frontend`, y CI corre también en `feat/**`. |

### Qué queda pendiente (no se resolvió aquí)

- **QoreSeal y el registro nativo `qorechain.pqc.v1`.** La categoría *Encrypted Apps* los pide, junto con la vinculación con ML-DSA. El proyecto sigue usando `@noble/post-quantum` y su propio directorio en el contrato. Integrarlos es una decisión del equipo.
- **`registerKemPublicKey` cuesta ~1.16M de gas**, porque guarda la clave de 1568 bytes. El registro nativo de QoreChain lo resolvería.
- **La EVM no verifica ML-DSA-87.** La firma se guarda como hash, la firma completa va en un evento y la verificación es fuera de la cadena. Si eligen *Post-Quantum dApp*, deberían usar `pqcVerify`.
- **El gateway es un custodio de confianza:** un solo proceso, almacén en JSON, límites en memoria que se reinician con cada arranque. Sirve para el hackathon, no para producción.
- **✅ RESUELTO (PR #7): Bandeja On-Chain del Especialista (`getGrantsBySpecialist`).** El Portal Especialista ahora sincroniza automáticamente los pases otorgados a la wallet conectada directamente desde el contrato en QoreChain (`refreshSpecialistGrants` en `App.tsx`).
- **✅ RESUELTO: Interfaz Minimalista Map-First Tactical HUD (Paleta Rebecca Glass).** Las 3 vistas (*Patient Vault*, *Cyber-Human HBOM* y *Specialist Portal*) fueron rediseñadas desde Stitch MCP con un riel lateral flotante, corredor central de mapa táctico GPS despejado y cajón flotante inferior derecho.
- **No se probó** con QoreX ni MetaMask reales en Diana Testnet aún: la wallet fue simulada sobre Anvil local (`Chain ID 9800`).
- **La revocación no recupera** lo que el especialista ya descifró. Está documentado en la interfaz y en el README.

---

## 1. Resumen ejecutivo (revisión original, antes de las correcciones)

| Área | Resultado |
|---|---|
| Tests de contratos (Foundry) | ✅ 14/14 pasan (incluye fuzzing) · `forge fmt` limpio |
| SDK: typecheck y ESLint | ✅ sin errores |
| Gateway: typecheck, ESLint y `npm test` | ✅ sin errores · 2/2 suites pasan |
| Frontend: typecheck y build | ✅ compila · ⚠️ bundle de 3.4 MB (764 KB gzip) |
| `npm audit` (sdk, gateway, frontend) | ✅ 0 vulnerabilidades |
| Demo end-to-end (`npm run demo`) contra Anvil | ✅ completa los 6 pasos |
| PoC de seguridad contra el stack local | ❌ 11 hallazgos confirmados (sección 3) |
| Pruebas en el navegador | ❌ la interfaz informa éxito cuando la transacción revirtió (sección 4) |

**Conclusión:** el código compila y sus tests pasan, pero **los tests no cubren lo importante**. Lo más grave:

1. **El gateway "Zero-Trust" no está integrado.** El frontend no lo usa en ningún lugar, y el sobre ML-KEM y el CID se siguen enviando a la cadena dentro del calldata de `grantTimedAccess`. La promesa del gateway (que el sobre nunca esté en la cadena) no se cumple en la aplicación real.
2. **La revocación y el Kill-Switch no impiden descifrar.** Se demostró descifrado completo *después* del Kill-Switch usando solo datos públicos de la cadena.
3. **La interfaz muestra éxito aunque la transacción revierta.** "Pase anclado on-chain" y "Pase revocado on-chain" aparecen con transacciones fallidas (`status = false`).
4. **El Portal Especialista muestra un descifrado simulado.** Si no hay datos en caché, genera telemetría sintética, la cifra, la descifra localmente y marca "1. QoreChain ✓".

---

## 2. Qué se ejecutó

```bash
cd contracts && forge test && forge fmt --check
cd sdk && npm run typecheck && npm run lint
cd gateway && npm run typecheck && npm run lint && npm test
cd frontend && npm run typecheck && npm run build
npm audit   # en sdk, gateway y frontend
# Stack local: anvil --chain-id 9800 · forge script DeploySynapseVault · gateway · vite
cd sdk && QORECHAIN_RPC_URL=http://127.0.0.1:8545 SYNAPSE_VAULT_ADDRESS=0x5FbD... npm run demo
npx tsx poc.mts   # script de ataques (sección 3)
```

Para el navegador se inyectó en la página un `window.ethereum` simulado que reenvía las llamadas a Anvil, con cuentas desbloqueadas. Así se ejercitó el hook `useSynapseVault` con transacciones reales.

---

## 3. Hallazgos de seguridad confirmados con PoC

Todos se ejecutaron contra el stack local. Resultado del script:

```
VULNERABLE | 1. eth_call con from=especialista (sin firma) devuelve sobre+CID
VULNERABLE | 2. Tras Kill-Switch el sobre y CID siguen legibles en el calldata | getRecordForSpecialist bloqueado=true
VULNERABLE | 3. Descifrado completo DESPUÉS de la revocación usando solo datos públicos
VULNERABLE | 4. Storage 'private' legible con eth_getStorageAt (slot especialista)
VULNERABLE | 5. contentHash público permite confirmar adivinanzas del contenido
VULNERABLE | 6. Registro de pieza con firma ML-DSA basura (0x1234) y fabricante arbitrario aceptado
VULNERABLE | 7. Pieza DECOMMISSIONED puede reactivarse a ACTIVE
VULNERABLE | 8. recordId ocupado por un tercero -> grant del paciente revierte (RecordAlreadyExists)
VULNERABLE | 9. Gateway acepta PIN_BLOB de 1 MiB de una wallet cualquiera
VULNERABLE | 10. GET /api/storage/blobs/:cid sin autenticación
VULNERABLE | 11. 2000 nonces emitidos sin rate-limit | 548 ms
```

### 🔴 Críticos

**C1. `getRecordForSpecialist` no autentica a nadie.** [`SynapseVaultRegistry.sol:338`](../contracts/src/SynapseVaultRegistry.sol)
- En una función `view`, `msg.sender` es el campo `from` de la llamada `eth_call`, y cualquiera puede ponerlo. El propio `sdk/src/demo.ts` lo hace con `account: specialistAccount.address`, sin tener la clave privada.
- El comentario de la línea 128 ("*Private so expired/revoked envelopes and CIDs cannot be read*") es falso. Prueba 4: `private` no oculta nada del storage.
- **Corrección:** no guardar `encryptedKeyEnvelope` ni `ipfsCID` en el contrato. Guardar solo `keccak256(envelope)` y dejar que el gateway entregue el sobre tras verificar la firma de la wallet y el resultado de `isAccessValid`. Ese es justo el diseño que el gateway ya implementa.

**C2. La revocación no impide descifrar** (pruebas 2 y 3).
- El sobre y el CID quedan para siempre en el calldata de la transacción `grantTimedAccess`.
- Un especialista revocado, o cualquiera con su clave ML-KEM, reconstruye todo desde el historial y descifra.
- En la demo y el pitch, "REJECTED ON-CHAIN" solo es cierto para clientes honestos.
- **Corrección:** igual que C1, el sobre y el CID no deben pasar por la cadena. Aun así, lo que ya se entregó no se puede recuperar. Díganlo así en el pitch: revocar corta *nuevas* entregas, no borra copias.

**C3. El gateway no está conectado al frontend.**
- `env.gatewayUrl` se define pero no se usa en ningún archivo.
- `App.tsx:125` llama a `grantTimedAccessOnChain` con `ipfsCID` y `encryptedKeyEnvelope` reales.
- `PatientVaultView` sube a Pinata directamente con `VITE_PINATA_JWT`. Ese JWT queda en el bundle del navegador, y cualquiera con la URL puede usar la cuenta de Pinata.
- **Corrección:** en el flujo del paciente, llamar a `pinEncryptedBlobViaGateway`, luego `grantTimedAccess` con CID vacío y sobre `0x` (solo `contentHash`), y después `storeProtectedEnvelope`. En el del especialista, llamar a `releaseProtectedEnvelope`. Eliminar `VITE_PINATA_JWT`.

### 🟠 Altos

**A1. Confirmación de contenido mediante `contentHash`** (prueba 5).
- Es el SHAKE-256 del *texto plano* y es público. Para documentos de baja entropía (plantillas JSON, resultados positivo/negativo) se puede confirmar una adivinanza.
- **Corrección:** hacer el hash sobre el *texto cifrado*, o usar un HMAC con una clave derivada de la DEK.

**A2. HBOM sin verificación de origen** (pruebas 6 y 7).
- `registerBionicPart` acepta cualquier `partId`, cualquier `manufacturer` y cualquier `pqcSignature`. El contrato nunca verifica la firma ML-DSA.
- Un atacante puede ocupar el `partId` de un serial real antes que su dueño.
- `logFirmwareUpdate` permite al portador subir firmware sin firma del fabricante.
- `updatePartStatus` permite pasar de DECOMMISSIONED a ACTIVE.
- **Corrección mínima:** que solo el `manufacturer` pueda registrar (y luego transferir al portador), que DECOMMISSIONED sea terminal y que se verifique la firma fuera de la cadena. Si eligen la categoría Post-Quantum dApp, usen `pqcVerify`.

**A3. Ocupación de `recordId`** (prueba 8).
- El `recordId` es global. Cualquiera que vea la transacción pendiente puede usarlo primero y hacer revertir la del paciente.
- **Corrección:** guardar con la clave `keccak256(abi.encode(msg.sender, recordId))`.

**A4. Costo de gas real ignorado por los tests.**
- Los tests usan sobres y firmas de 16 bytes. En el navegador, registrar una pieza con una firma ML-DSA-87 real (4627 bytes, guardada dos veces) **consumió 6 860 918 de gas**.
- Un grant con un sobre real (1628 bytes) ronda 1M de gas.
- En Diana eso puede superar el límite de gas del bloque o ser caro.
- **Corrección:** guardar solo hashes de las firmas y sobres, y emitir los bytes en eventos. Agregar un test con tamaños reales.

### 🟡 Medios (gateway)

- **M1.** `POST /api/storage/pin` acepta subidas de 25 MiB de *cualquier* wallet con una firma válida, sin relación con ningún registro. Eso permite abusar de la cuota de Pinata o llenar el disco (prueba 9).
- **M2.** `GET /api/storage/blobs/:cid` no requiere autenticación (prueba 10). Los blobs están cifrados, pero así se pierde el control de acceso al archivo.
- **M3.** `GET /api/auth/nonce` no tiene límite de peticiones y los nonces solo se limpian al emitir uno nuevo. Hay riesgo de agotar la memoria (prueba 11).
- **M4.** `ChainPolicyVerifier.getGrantPolicy` captura *cualquier* error y devuelve `null`. Un RPC caído o una dirección de contrato errónea (el valor por defecto es `0x000…0`) aparecen como "Record policy not found" (404).
- **M5.** El mensaje firmado no es SIWE real: no incluye dominio, chain ID ni URI. El nonce mitiga la reutilización, pero el texto "SIWE-style" sobrevende la protección.
- **M6.** CORS: el valor por defecto de `index.ts` es `*`. El `.env.example` usa `http://127.0.0.1:5173`, pero `make init` imprime `http://localhost:5173`, que es otro origen y quedaría bloqueado. El gateway tampoco carga `.env` por sí solo.

---

## 4. Hallazgos de las pruebas en el navegador

| # | Prueba | Esperado | Observado |
|---|---|---|---|
| N1 | Seal & Grant con la pieza por defecto (`0x4b7f…c18a`, un dato de prueba que no existe en la cadena) | Error visible | Banner **"Pase #EQ-1226 anclado on-chain • Tx: 0xb03c…"**. La transacción tiene `status=false` y revierte con `PartNotFound()` (`0xb93bedbc`). |
| N2 | Revocar ese pase | Error visible | Banner **"Pase #EQ-1226 revocado on-chain • Tx: 0xddb6…"**. La transacción tiene `status=false` y revierte con `RecordNotFound()` (`0x3e07f1a1`). |
| N3 | Publicar la clave ML-KEM con la wallet conectada | Transacción exitosa | ✅ `registerKemPublicKey` se ejecutó. |
| N4 | Registrar una pieza HBOM con la wallet | Transacción exitosa | ✅ `status=true`, pero con **6.86M de gas** (ver A4). |
| N5 | "Unseal in memory" en un pase de ejemplo | Consulta a la cadena o al gateway | Muestra un JSON **sintético** generado localmente, con "1. QoreChain ✓" y "Decapsulated & Verified in 14.3 ms". No hubo ninguna llamada RPC. |
| N6 | Cargar la página sin wallet | Indicar "no conectado" | Muestra una wallet ficticia `0x71c...b9F4` y el badge **"ON-CHAIN PKI REGISTERED"** (`isKeyPublishedOnChain` empieza en `true`). |
| N7 | Consola al cargar | Sin errores | 6 errores de CORS contra `https://api-testnet.qore.host/qorechain/rdk/v1/params` y `/rollups`. El REST de QoreChain no permite llamadas desde el navegador. |

**Causas en el código:**
- `useSynapseVault.ts` espera `waitForTransactionReceipt` pero **nunca revisa `receipt.status`**. Además, no simula la transacción antes de enviarla (`simulateContract`).
- `App.tsx` actualiza el estado local *antes* de la transacción y tiene `catch {}` vacíos que convierten cualquier fallo en un banner de éxito (líneas 141, 172, 196, 219, 256, 303, 333). Con la wallet desconectada, `handlePublishKemKeyOnChain` igual marca la clave como publicada (línea 374).
- `SpecialistPortalView.tsx:200-228`: si falla el descifrado real o no hay caché, se descifra un documento generado en el momento.
- El paciente cifra con el par de claves *local* del especialista (`App.tsx:536`), no con la clave registrada en la cadena. `queryKemPublicKeyOnChain` existe, pero no se usa en ningún lugar. Además, el par de claves se regenera en cada recarga, así que cualquier pase real deja de poder descifrarse.

**Riesgo para el hackathon:** si el jurado conecta una wallet en Diana y algo falla, la interfaz dirá que funcionó. Si mira el Portal Especialista con detenimiento, verá que el descifrado no viene de la cadena.

---

## 5. Otros hallazgos (calidad y operación)

- **`demo.ts:201-212`:** el `try/catch` también atrapa su propio `throw new Error("Expected specialist access to be revoked!")`. La demo imprime "REJECTED ON-CHAIN" pase lo que pase.
- **`demo.ts:133`:** el mensaje habla de `.local-ipfs/…enc`, pero `storage.ts` ya no escribe a disco (solo guarda en memoria).
- **`make init`** no levanta el gateway, y **`make down`** ejecuta `pkill -9 -f vite`, que mata *cualquier* proceso Vite de la máquina, no solo el de este proyecto.
- **CI** (`.github/workflows/ci.yml`) solo cubre contratos y SDK. No ejecuta los tests del gateway ni el typecheck o build del frontend, y no corre sobre `feat/*`.
- **Bundle de 3.4 MB:** `@qorechain/rdk` arrastra `@cosmjs` al navegador solo para `getLiveRdkStatus`, que además falla por CORS. Conviene moverlo al gateway o cargarlo con `import()` dinámico.
- **`emergencyRevokeAll`** recorre un arreglo sin límite. Con muchos pases, el Kill-Switch puede quedarse sin gas justo cuando más se necesita. Conviene paginarlo o usar un contador de época por paciente.
- **`extendAccess`** puede revivir un pase ya vencido. Si es intencional, documéntenlo.
- **Requisitos de la categoría Encrypted Apps:** el proyecto usa `@noble/post-quantum` y su propio registro de claves (`registerKemPublicKey`), no QoreSeal ni el registro nativo `qorechain.pqc.v1`. Tampoco existe la vinculación con ML-DSA (recipient card) que la categoría exige.
- **Fortalezas:** la librería de Shamir 2-de-3 (`recovery.ts`) y su test son correctos. El empaquetado de structs del contrato está bien hecho. El gateway tiene una buena base: nonce de un solo uso, verificación de la firma de la wallet y comprobación de `isAccessValid` en el momento de entregar el sobre.

---

## 6. Prioridades sugeridas antes del 2 de diciembre

1. **Integrar el gateway en el frontend** y quitar el sobre y el CID de la cadena (corrige C1, C2 y C3, y elimina el JWT del navegador).
2. **Revisar `receipt.status` y mostrar los errores** en `useSynapseVault` y `App.tsx` (N1, N2 y N6).
3. **Eliminar el descifrado sintético** del Portal Especialista, o rotularlo claramente como "modo demo" (N5).
4. **Cifrar con la clave ML-KEM registrada en la cadena** para el especialista, y guardar su par de claves de forma persistente (el código de recuperación con Shamir ya existe).
5. **Cambios de contrato baratos:** `recordId` ligado a `msg.sender`, DECOMMISSIONED terminal y solo hashes de firmas y sobres (A2, A3 y A4).
6. **Agregar a CI** los tests del gateway y el build del frontend.

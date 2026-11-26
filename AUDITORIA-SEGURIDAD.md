# Auditoría de seguridad de SynapseQ

| Campo | Valor |
|---|---|
| Fecha | 2026-11-26 |
| Rama / commit | `master` @ `fa10612`, árbol limpio |
| Metodología | Skill `security-audit` (Cloudflare), modo **auditoría completa**, perfil `standard`, alcance: todo el repositorio |
| Ejecución | Revisión de código fuente y pruebas locales en sandbox (bwrap sin red, entorno vacío, código objetivo en solo lectura, límites de CPU, memoria y procesos). No se contactó ningún endpoint desplegado, ni la red QoreChain Diana, ni Pinata. Solo se usaron claves y datos ficticios. |
| Agentes | 52: 4 de reconocimiento, 14 cazadores, 4 críticos de cobertura, 16 verificadores de candidatos y 14 verificadores finales independientes |
| Artefactos completos | `~/security-audit-skill/SynapseQ/run-1/` (`findings.json`, `coverage-ledger.json`, `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md` y las pruebas de cada agente) |

> Las rutas y líneas citadas corresponden al commit `fa10612`. La auditoría no modificó ningún archivo del repositorio salvo este informe.

---

## 1. Resumen ejecutivo

El modelo de control de acceso **on-chain** del contrato `SynapseVaultRegistry` se mantiene sólido: solo el paciente puede revocar, el kill-switch de emergencia funciona, los `partId` están ligados a `msg.sender` y la prueba de posesión ML-DSA-87 está activada por defecto.

La mayoría de los problemas están en el **Key-Release Gateway** off-chain (`gateway/src`):

- El `ipfsCID` de un sobre no queda ligado a la wallet que subió el blob. Esto permite que un paciente **borre o despinee el blob cifrado de otro paciente**. Es el único hallazgo **alto**.
- Los límites anti-abuso usan identidades que el atacante controla: la dirección declarada sin autenticar, o wallets autogeneradas gratis.
- La persistencia del almacén de sobres no es atómica y descarta en silencio un archivo corrupto.

| Veredicto | Cantidad |
|---|---|
| Confirmados | **10**: 1 alto, 5 medios y 4 bajos |
| Pendientes de validación (sin severidad) | 4 |
| Rechazados | 2 |

No se encontraron hallazgos críticos. Tampoco hay ejecución de código remota, robo de claves privadas ni lectura de texto plano de historiales médicos sin una condición previa.

---

## 2. Tabla de hallazgos confirmados

| # | Severidad | Hallazgo | Ubicación principal |
|---|---|---|---|
| H-1 | 🔴 **Alta** | El `ipfsCID` no está ligado a su propietario: cualquier EOA puede borrar, despinear o volver a descargar el blob de otro paciente | `gateway/src/server.ts:210`, `gateway/src/store.ts:53` |
| M-1 | 🟠 Media | Bloqueo de cualquier wallet en el gateway llenando su cupo de nonces pendientes | `gateway/src/auth.ts:40-50`, `gateway/src/server.ts:190` |
| M-2 | 🟠 Media | El cupo de pin es solo por wallet: con wallets gratuitas se puede llenar el disco o la cuenta Pinata sin límite | `gateway/src/server.ts:329-374` |
| M-3 | 🟠 Media | Clave secreta ML-KEM-1024 del especialista derivada de una firma sobre un mensaje fijo y sin origen; no se puede rotar | `sdk/src/pqc.ts:112-118` |
| M-4 | 🟠 Media | En modo Pinata, el gateway retiene cada blob subido en una caché de memoria sin límite | `sdk/src/storage.ts:38,86` |
| M-5 | 🟠 Media | La reescritura no atómica de `envelopes.json` y el descarte silencioso del archivo corrupto borran todos los sobres | `gateway/src/store.ts:104-120` |
| L-1 | 🟡 Baja | Cualquier cuenta con clave PQC puede atribuir implantes a un bearer arbitrario sin su consentimiento | `contracts/src/SynapseVaultRegistry.sol:447` |
| L-2 | 🟡 Baja | Path traversal en el crypto-shred: borra archivos `*.enc` fuera del directorio de blobs | `gateway/src/store.ts:53-57` |
| L-3 | 🟡 Baja | El crypto-shred borra el registro antes de despinear y pierde el CID si el unpin falla, sin posibilidad de reintentar | `gateway/src/server.ts:296-326` |
| L-4 | 🟡 Baja | `make init` y `deploy-local` firman con la `DEPLOYER_PRIVATE_KEY` real usando el chain id 9800 y la envían a cualquier proceso que escuche en el puerto local | `Makefile:52-63,196-204` |

---

## 3. Detalle de los hallazgos confirmados

### H-1 🔴 ALTA: el `ipfsCID` no está ligado a la wallet que subió el blob

**Qué ocurre.** `POST /api/envelopes` acepta cualquier `ipfsCID` de 1 a 200 caracteres (`gateway/src/server.ts:210-212`) y lo guarda tal cual (`server.ts:245`). La ruta de pin (`server.ts:356-373`) no registra qué wallet es dueña de cada CID, y el contrato no almacena CIDs. Cualquier EOA puede:

1. Crear su propio grant on-chain siendo paciente y especialista a la vez. `grantTimedAccess` solo rechaza `specialist == address(0)`.
2. Guardar un sobre para ese registro que apunte al CID de **otro paciente**. Todo especialista actual o pasado conoce ese CID, porque la respuesta de `release` se lo entrega.
3. Con `DELETE /api/envelopes/:id` sobre su propio registro, el gateway:
   - hace `unlinkSync` del blob local de la víctima (`store.ts:56`), o
   - llama a `unpinFromPinata` con el `PINATA_JWT` del servidor (`server.ts:317-319`).
4. Con `release` sobre su propio registro, obtiene un token nuevo para descargar el blob de la víctima, aunque esta ya le haya revocado el acceso.

**Reproducción local (sandbox).** Se usó un gateway real con un verificador on-chain simulado. Un especialista revocado guardó un sobre que apuntaba al CID de la víctima, lo liberó y descargó el blob. Después ejecutó `DELETE` y el archivo de la víctima desapareció. La variante `bafy-gw-/../../canary` borró un archivo fuera de `blobs/`.

**Impacto.** Destrucción permanente e irrecuperable de historiales cifrados de otro paciente. Lo que se filtra es texto cifrado. Solo alguien que ya tenga la clave del registro podría descifrarlo.

**Corrección mínima.**
- Registrar el propietario de cada CID devuelto por `/api/storage/pin`.
- En `POST /api/envelopes`, exigir un CID bien formado (`/^bafy-gw-[a-f0-9]{32}$/` o un CIDv0/v1 real) cuyo propietario sea el firmante.
- En `shred`, aplicar la misma regex y comprobar que la ruta resuelta queda dentro de `blobsDir`. Borrar o despinear solo si el firmante es el dueño y ningún otro sobre referencia ese CID.
- Ligar los tokens de blob al `recordId` además de al CID.
- Prueba de regresión: una segunda wallet que guarde y destruya un sobre con el CID ajeno debe recibir un 400 o un 403, y el blob debe seguir intacto.

---

### M-1 🟠 MEDIA: bloqueo de wallets por agotamiento del cupo de nonces

**Qué ocurre.** `GET /api/auth/nonce?address=X` no requiere autenticación. El límite de 5 nonces pendientes se cuenta por la dirección **declarada** (`gateway/src/auth.ts:40-42,50`). Un tercero que haga 5 peticiones por minuto con la dirección pública de la víctima consume su cupo.

**Reproducción.** 5 peticiones del atacante devolvieron 200. La de la víctima devolvió `429 Too many pending nonces for this address`. Una dirección de control recibió 200.

**Impacto.** Denegación de servicio dirigida y sostenida de todas las operaciones del gateway para esa wallet, incluidas la liberación de claves al especialista y el crypto-shred del paciente. Las acciones on-chain (revocar, kill-switch) no se ven afectadas.

**Corrección.** Limitar los nonces por solicitante (IP o conexión) en lugar de por dirección destino, manteniendo solo el tope global para proteger la memoria. Otra opción es usar nonces sin estado (`HMAC(serverKey, address|expiry|random)`) con un conjunto corto de nonces ya consumidos. **No** expulsar el nonce más antiguo, porque eso mantiene la denegación.

---

### M-2 🟠 MEDIA: el cupo de pin por wallet no limita el almacenamiento total

**Qué ocurre.** El cupo de `POST /api/storage/pin` se aplica por dirección firmante, y esa identidad es autogenerada y gratuita. No hay tope agregado, y los blobs no se ligan a un grant ni caducan. Los blobs huérfanos nunca se borran.

**Reproducción.** Con un cupo de 1 pin por wallet, la segunda subida de la wallet A recibió 429. En cambio, 5 wallets nuevas subieron un blob cada una y los 5 archivos quedaron persistidos en `blobs/`.

**Impacto.** Llenar el disco del gateway rompe la escritura de sobres y blobs para todos los usuarios. En modo Pinata, consume la cuota de la cuenta del operador. No se recupera solo.

**Corrección.** Añadir un tope global de bytes y de número de pins. Exigir que cada pin esté ligado a un grant existente o a una reserva de subida de corta duración. Recolectar y borrar (o despinear) los blobs que ningún sobre referencie pasado un TTL.

---

### M-3 🟠 MEDIA: clave ML-KEM del especialista derivada de una firma sin contexto

**Qué ocurre.** `deriveKemKeyPairFromSignature` (`sdk/src/pqc.ts:116-118`) usa como única semilla una firma ECDSA `personal_sign` sobre la cadena fija `KEM_DERIVATION_MESSAGE` (`pqc.ts:112-113`). El mensaje no lleva dominio, origen, chain id, contrato ni versión, así que cualquier sitio web puede pedir al especialista que firme el mismo texto. La firma determinista reproduce la misma clave secreta.

**Reproducción.** La misma firma pedida dos veces dio la misma clave pública que la dApp publicaría, y con ella se descifró un registro ficticio. La clave de otra cuenta no pudo descifrarlo.

**Impacto.** Si además el atacante obtiene sobres y blobs, por ejemplo como operador del gateway o con una segunda firma de `release` conseguida por phishing, compromete **todos** los historiales sellados para ese especialista. Esto rompe la promesa de que "el gateway nunca ve texto plano", y la dApp no ofrece forma de rotar la clave.

**Corrección.** Opción preferida: generar una semilla KEM aleatoria, protegerla con la recuperación Shamir o passkey que ya existe (`sdk/src/recovery.ts`) y permitir volver a registrarla. Si se mantiene la derivación por firma, usar un mensaje EIP-4361 (SIWE), cuyo dominio verifica la wallet, que incluya el chain id, el contrato, la cuenta y un contador de versión on-chain para poder rotar.

---

### M-4 🟠 MEDIA: caché de blobs en memoria sin límite en el proxy Pinata

**Qué ocurre.** `uploadEncryptedBlobToPinata` ejecuta `memoryBlobCache.set(cid, blob)` (`sdk/src/storage.ts:86`) sobre un `Map` global sin límite ni TTL (`storage.ts:38`). El gateway reutiliza esa función como servicio multiusuario (`gateway/src/server.ts:363`), así que retiene en memoria cada blob subido.

**Reproducción.** Con Pinata simulado en proceso, 3 wallets nuevas subieron 5 blobs de 4 MiB cada una. La memoria `arrayBuffers` creció unos 4 MiB por pin y no se liberó tras el GC.

**Impacto.** Agotamiento de memoria o caída del gateway, con lo que la liberación de claves queda bloqueada para todos hasta que se reinicie. Solo afecta a la disponibilidad.

**Corrección.** Quitar `memoryBlobCache.set` de la función de subida a Pinata, o hacer la caché opcional y no usarla en el gateway. Prueba: N pins en modo Pinata y comprobar que la memoria retenida se mantiene constante.

---

### M-5 🟠 MEDIA: pérdida total de sobres por escritura no atómica y carga silenciosa

**Qué ocurre.** `persistToDisk` (`gateway/src/store.ts:116-120`) reescribe `envelopes.json` en el mismo archivo con `writeFileSync`. `loadFromDisk` (`store.ts:104-114`) captura cualquier error de lectura y arranca con el mapa vacío. Si una escritura falla después de truncar el archivo (disco lleno, `EIO`, caída del proceso), al reiniciar el gateway arranca vacío. La siguiente escritura sobrescribe el archivo corrupto con un conjunto reducido.

**Reproducción.** Se sembraron 3 sobres y se simuló un disco lleno con `ulimit -f`. Tras reiniciar y hacer un nuevo `put`, el archivo solo contenía el último sobre.

**Impacto.** Pérdida silenciosa y permanente de las claves envueltas de **todos** los pacientes, que en modo live solo existen ahí. Se combina con M-2, que permite llenar el disco a propósito.

**Corrección.** Escribir en `envelopes.json.tmp`, hacer `fsync`, renombrar y hacer `fsync` del directorio. Persistir antes de mutar el mapa, o revertir el cambio si falla. Si el archivo existe pero no se puede parsear, negarse a arrancar o moverlo aparte. Guardar los blobs en otro volumen o con su propia cuota.

---

### L-1 🟡 BAJA: atribución de implantes a un bearer sin su consentimiento

`registerBionicPart` (`contracts/src/SynapseVaultRegistry.sol:447`) acepta un `bearer` que nadie autentica, y la atestación ML-DSA no lo incluye. Cualquier cuenta con clave PQC registrada puede añadir para siempre partes falsas al inventario público de otra dirección, que no tiene forma de borrarlas. No da acceso a grants ni a datos.
**Corrección.** Flujo en dos pasos (`acceptPart(partId)` firmado por el bearer) o una firma EIP-712 de consentimiento. Opcionalmente, incluir `bearer`, `zone` y `modelName` en el mensaje de atestación.

### L-2 🟡 BAJA: path traversal en el crypto-shred

`store.shred` solo comprueba `startsWith("bafy-gw-")` y luego hace `join(blobsDir, cid + ".enc")` (`gateway/src/store.ts:53-57`). Con un CID como `bafy-gw-/../../ruta/objetivo`, borra cualquier archivo `.enc` accesible por el proceso. Es solo un borrado, sin lectura ni escritura, y comparte causa raíz con H-1. `getLocalBlob` (`store.ts:94`) sí aplica la regex estricta.
**Corrección.** Validar el CID con `/^bafy-gw-[a-f0-9]{32}$/` al guardar y al borrar, y comprobar con `resolve`/`dirname` que la ruta queda dentro de `blobsDir`.

### L-3 🟡 BAJA: el crypto-shred no se puede reintentar si falla el unpin

`store.shred` borra la entrada y la persiste (`store.ts:50-51`) **antes** de intentar el unpin en Pinata (`server.ts:316-323`), que traga los errores. Si Pinata falla, el texto cifrado queda pinneado y cualquier reintento recibe un 404. El paciente obtiene `200` igualmente, con `unpinnedFromPinata:false`.
**Corrección.** Guardar una marca de unpin pendiente (tombstone) antes de borrar, devolver `202 {pendingUnpin:true}` y permitir reintentos. Un 404 de Pinata cuenta como despineado.

### L-4 🟡 BAJA: `make init` / `deploy-local` firman con la clave real hacia un RPC sin verificar

El probe de arranque (`Makefile:56-63`) acepta cualquier HTTP 200 sin comprobar el PID de anvil ni el `eth_chainId`, y no aborta si se agota el tiempo. `deploy-local` (`Makefile:196-204`) prefiere `DEPLOYER_PRIVATE_KEY` sobre una cadena local cuyo chain id por defecto es el 9800 real. Si otro proceso local ocupa antes el puerto 8545, obtiene una transacción de despliegue firmada que se puede reenviar en Diana: gasta fondos de testnet y consume el nonce del desplegador. La clave privada no se filtra.
**Corrección.** Usar un chain id local distinto (p. ej. `LOCAL_CHAIN_ID=31337`) y una clave local separada. En el probe, exigir que el PID siga vivo y que `eth_chainId` sea el esperado, y hacer `exit 1` si se agota el tiempo. Opcionalmente, añadir `require(block.chainid == EXPECTED_CHAIN_ID)` en `DeploySynapseVault.s.sol`.

---

## 4. Pendientes de validación (sin severidad)

Son hipótesis con base en el código que dependen de un dato ausente del repositorio. **No son vulnerabilidades confirmadas.**

| Lead | Traza | Dato que falta | Cómo validarlo sin tráfico de auditoría |
|---|---|---|---|
| El rate-limit por IP usa `req.socket.remoteAddress`: detrás de un proxy, un solo cliente agota el cupo compartido de 300 req/min | `gateway/src/index.ts:63`, `server.ts` (limitador) | Cómo llega el tráfico público a `127.0.0.1:GATEWAY_PORT` (nginx, Caddy, túnel) y si el proxy aplica sus propios límites por cliente. El mecanismo ya se demostró en local. | Revisar la configuración del proxy. Si existe, confiar en `X-Forwarded-For` solo cuando venga del proxy de confianza. |
| `POST /api/storage/pin` almacena y parsea hasta 25 MiB **antes** de autenticar, sin límite de concurrencia | `gateway/src/server.ts:329` | Límites de tamaño, buffering y conexiones del proxy, memoria del host y política de reinicio. En local, 4 peticiones de 20 MiB generaron unos 2× de buffer en el servidor. | Revisar `client_max_body_size` o equivalente. Mover la autenticación a cabeceras o a una reserva previa. |
| `make down` / `clean` se fían de archivos PID predecibles en `/tmp` y matan cualquier PID que otro usuario haya plantado | `Makefile:3-8,116-119` | Si el Makefile se ejecuta en hosts multiusuario o con sudo, y el valor de `fs.protected_regular`. Con un mismo uid ya se reprodujo. | Prueba en una VM desechable con dos cuentas. Corrección: directorio por usuario `0700` (`$XDG_RUNTIME_DIR`) y verificar el propietario y el cmdline del PID. |
| Cualquiera puede inundar el inbox on-chain de un especialista (`getGrantsBySpecialist` sin paginar) | `contracts/src/SynapseVaultRegistry.sol:292,335` | El límite de gas de `eth_call` del RPC de Diana o del proveedor de la wallet. Medido en local: unos 2,4k de gas por entrada (unas 10k entradas para un tope de 25M). | Consultar el límite del RPC. Corrección: paginación y consentimiento o límite por especialista. |

**Rechazados tras la verificación** (no son hallazgos):
- `gateway/auth.ts:issueNonce:global-pending-cap-lockout`: el tope global de 10.000 nonces pendientes se puede llenar en local, pero el ataque remoto necesita unas 34 direcciones de origen distintas, y los controles visibles en el código lo impiden. Queda como nota de hardening junto a M-1.
- `gateway/server.ts:blob-download:token-not-revalidated-after-revocation`: el comportamiento existe, pero no cruza ninguna frontera de seguridad. El especialista ya recibió legítimamente el sobre antes de la revocación, y la revocación solo promete denegar liberaciones nuevas (README.md:22), cosa que el gateway sí aplica.

---

## 5. Recomendaciones de hardening (no son vulnerabilidades)

**Cadena de suministro y CI**
- Fijar `forge-std` a un tag o commit en `Makefile:36` y `.github/workflows/ci.yml:24`. Se ejecuta con `DEPLOYER_PRIVATE_KEY` en el entorno (`make deploy-diana`).
- Añadir `permissions: contents: read` al workflow de CI y fijar las actions por SHA (`actions/checkout`, `setup-node`, `foundry-toolchain`) junto con la versión de Foundry.
- Usar `npm ci` en lugar de `npm install` en el target `build` del Makefile.

**Makefile**
- Usar un directorio por usuario `0700` en lugar de `/tmp/synapseq-*.{pid,log}`.
- No leer la clave de anvil desde un log en `/tmp`.
- Filtrar los caracteres de control al mostrar logs (`tail ... | cat -v`) y entrecomillar `$$pidf` y las variables.

**Gateway**
- Añadir a los mensajes de autenticación del gateway dominio, URI y expiración (estilo EIP-4361), para que las wallets avisen ante peticiones de otros sitios.
- Mover el token de blob de la query string a una cabecera o un POST, para que no quede en los logs, y volver a comprobar la política al descargar.
- Hacer que `put` y `shred` reviertan el mapa en memoria si falla la persistencia, y crear `envelopes.json` con permisos `0600`.
- Unificar la salida en vacío del EVM-window proxy y hacer persistentes las cuotas entre reinicios.

**Frontend y SDK**
- Definir CSP y `frame-ancestors 'none'` en el hosting.
- Codificar el CID con `encodeURIComponent` y validar su formato en `fetchEncryptedBlobFromIpfs`.
- Antes de descifrar, comparar la clave KEM recién derivada con la publicada on-chain (por las wallets de firma no determinista).
- Corregir la etiqueta del botón "Sign with ML-DSA-87 & Register (on-chain)", porque el navegador siempre rechaza esa escritura.
- `sdk/src/oem.ts`: recalcular localmente `firmwareAttestationMessage` en lugar de confiar en el RPC, y activar el modo mock solo con `chainId 31337`.
- Hacer que `sdk/src/demo.ts` se niegue a usar las claves públicas de Anvil fuera de `chainId 31337`.

**Contrato**
- `registerKemPublicKey` solo acepta 1568 bytes, mientras que el README menciona la clave híbrida de 1720 bytes. Es una incoherencia funcional.
- Paginar `getGrantsByPatient`, `getPartsByBearer` y `getFirmwareHistory`.

La lista completa (55 notas) está en `~/security-audit-skill/SynapseQ/run-1/REPORT.md`, sección 6.

---

## 6. Cobertura

| Métrica | Valor |
|---|---|
| Unidades de cobertura | 25: 9 cubiertas sin hallazgos y 16 con candidatos, todos con disposición final |
| Bloqueadas, diferidas o fuera de alcance | 0 |
| Críticos de cobertura | 3 olas de caza. El crítico posterior a la ola y el crítico final limpio no encontraron trabajo pendiente |
| Verificación | Cada candidato pasó por un verificador independiente (Fase 3) y cada registro final por otro verificador nuevo (Fase 5). No hubo reemplazos. |
| Ejecuciones previas | Ninguna. No existía un ledger previo. |

**Fuera del alcance de la evidencia:**
- Comportamiento real de los precompiles PQC `0x0a01`/`0x0a02` en QoreChain Diana (se usó `MockQorePqc`).
- Configuración del proxy y del hosting.
- Políticas de la cuenta Pinata.
- Comportamiento en hosts multiusuario.

Una sola ejecución no agota el objetivo.

---

## 7. Prioridad de remediación sugerida

1. **H-1 + L-2**: ligar el CID a su propietario y validar su formato al guardar y al borrar. Una sola corrección cubre ambos.
2. **M-5 + M-2**: escritura atómica del almacén, tope global de pins y recolección de huérfanos. Juntos evitan el escenario de llenar el disco y perder todos los sobres.
3. **M-1**: nonces limitados por solicitante o sin estado.
4. **M-4**: quitar la caché de memoria del camino del servidor.
5. **M-3**: semilla KEM aleatoria con recuperación, o mensaje SIWE versionado con rotación.
6. **L-3, L-4, L-1** y el hardening.

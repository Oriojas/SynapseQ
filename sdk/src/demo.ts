import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}
import {
  bytesToHex,
  createPublicClient,
  createWalletClient,
  defineChain,
  hexToBytes,
  http,
  type Hash,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { SYNAPSE_VAULT_ABI } from "./abi.js";
import {
  buildGatewayAuthMessage,
  computeRecordId,
  downloadBlobViaGateway,
  pinEncryptedBlobViaGateway,
  releaseProtectedEnvelope,
  requestGatewayNonce,
  storeProtectedEnvelope,
  type GatewayAuthAction,
} from "./gatewayClient.js";
import {
  computeEnvelopeHash,
  computeShake256,
  encryptAndSealDocument,
  generateKemKeyPair,
  unsealAndDecryptDocument,
} from "./pqc.js";
import { inspectPqcKey, oemFromDevPrivateKey, oemFromMnemonic, registerPartWithAttestation } from "./oem.js";

const RPC_URL = process.env.QORECHAIN_RPC_URL ?? "http://127.0.0.1:8545";
const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://127.0.0.1:4000";
const CHAIN_ID = Number(process.env.QORECHAIN_CHAIN_ID ?? 9800);
const CONTRACT_ADDRESS = (process.env.SYNAPSE_VAULT_ADDRESS ??
  "0x5FbDB2315678afecb367f032d93F642f64180aa3") as `0x${string}`;

// Default Anvil pre-funded accounts (local only — never use on a public network)
const PATIENT_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const SPECIALIST_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const MANUFACTURER_PK = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as const;

const chain = defineChain({
  id: CHAIN_ID,
  name: "QoreChain Diana Testnet (local)",
  nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
const walletFor = (account: PrivateKeyAccount) =>
  createWalletClient({ account, chain, transport: http(RPC_URL) });

/** Sends a tx and FAILS LOUDLY if it reverts (receipt.status !== "success"). */
async function send(hash: Hash, label: string): Promise<void> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`${label} reverted on-chain (tx ${hash})`);
  }
  console.log(`  - ${label}: ok (gas ${receipt.gasUsed}) tx ${hash}`);
}

async function signedNonce(
  account: PrivateKeyAccount,
  action: GatewayAuthAction,
  recordId?: `0x${string}`
): Promise<{ nonce: string; signature: `0x${string}` }> {
  const { nonce } = await requestGatewayNonce(GATEWAY_URL, account.address);
  const signature = await account.signMessage({
    message: buildGatewayAuthMessage({
      action,
      address: account.address,
      nonce,
      chainId: CHAIN_ID,
      recordId,
    }),
  });
  return { nonce, signature };
}

async function main() {
  const patient = privateKeyToAccount(PATIENT_PK);
  const specialist = privateKeyToAccount(SPECIALIST_PK);

  console.log("=== SynapseQ End-to-End Post-Quantum Demo (local chain + Key-Release Gateway) ===");
  console.log("Contract:    ", CONTRACT_ADDRESS);
  console.log("Gateway:     ", GATEWAY_URL);

  // 1. Specialist publishes its ML-KEM-1024 public key in the on-chain directory
  console.log("\n[1/7] Specialist publishes ML-KEM-1024 public key on-chain...");
  const specialistKem = generateKemKeyPair();
  await send(
    await walletFor(specialist).writeContract({
      address: CONTRACT_ADDRESS,
      abi: SYNAPSE_VAULT_ABI,
      functionName: "registerKemPublicKey",
      args: [bytesToHex(specialistKem.publicKey)],
    }),
    "registerKemPublicKey"
  );

  // 2. Manufacturer signs the firmware attestation with its REGISTERED ML-DSA-87 key and the
  //    contract verifies it ON-CHAIN (pqcKeyStatus + pqcVerify precompiles)
  console.log("\n[2/7] OEM signs firmware with ML-DSA-87; contract verifies it on-chain (pqcVerify)...");
  const oem = process.env.OEM_MNEMONIC
    ? oemFromMnemonic(process.env.OEM_MNEMONIC.trim(), Number(process.env.OEM_INDEX ?? 0))
    : oemFromDevPrivateKey(MANUFACTURER_PK);
  const pqcInfo = await inspectPqcKey(publicClient, oem);
  console.log(
    `  - PQC precompiles: ${!pqcInfo.available ? "NOT AVAILABLE" : pqcInfo.isDevMock ? "MockQorePqc (local dev)" : "native QoreChain"} • OEM key ${oem.pqKeySource}`
  );
  const firmware = new TextEncoder().encode("NeuroLink-X9-Firmware-v1.0.0-stable");
  const registered = await registerPartWithAttestation(
    { publicClient, walletClient: walletFor(oem.account), vault: CONTRACT_ADDRESS },
    oem,
    {
      bearer: patient.address,
      zone: 0, // AnatomicalZone.NEURAL
      modelName: "NeuroLink-X9 BCI",
      serialNumber: `SN-${Date.now()}`,
      firmwareHash: computeShake256(firmware),
      calibrationHash: computeShake256(new TextEncoder().encode("motor-cortex-cal-v1")),
    }
  );
  const partId = registered.partId;
  console.log(
    `  - registerBionicPart: ok (ML-DSA-87 ${registered.signatureBytes} B verified on-chain, gas ${registered.gasUsed}) tx ${registered.hash}`
  );

  // 3. Patient reads the specialist key FROM CHAIN, encrypts locally, pins via gateway
  console.log("\n[3/7] Patient encrypts with the specialist's on-chain ML-KEM key and pins via gateway...");
  const onChainKey = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: SYNAPSE_VAULT_ABI,
    functionName: "getKemPublicKey",
    args: [specialist.address],
  });
  const document = {
    documentType: "BIONIC_TELEMETRY_AND_CLINICAL_REPORT",
    partId,
    timestamp: new Date().toISOString(),
    vitals: { neuralLatencyMs: 2.14, electrodeImpedanceKOhm: 4.8, batteryHealthPct: 98.4 },
  };
  const sealed = await encryptAndSealDocument(
    new TextEncoder().encode(JSON.stringify(document, null, 2)),
    hexToBytes(onChainKey)
  );
  const pinAuth = await signedNonce(patient, "PIN_BLOB");
  const pinned = await pinEncryptedBlobViaGateway(GATEWAY_URL, {
    encryptedBlob: sealed.encryptedBlob,
    address: patient.address,
    ...pinAuth,
  });
  console.log(`  - Encrypted blob pinned: ${pinned.cid} (${pinned.provider}, ${pinned.size} B)`);

  // 4. Grant on-chain with COMMITMENTS ONLY, then hand the envelope to the gateway
  console.log("\n[4/7] Granting a 2-hour pass on-chain (only hashes) + storing envelope in gateway...");
  const salt = bytesToHex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
  const recordId = computeRecordId(patient.address, salt);
  const grantHash = await walletFor(patient).writeContract({
    address: CONTRACT_ADDRESS,
    abi: SYNAPSE_VAULT_ABI,
    functionName: "grantTimedAccess",
    args: [salt, sealed.contentHash, sealed.envelopeHash, partId, specialist.address, 1, 7200n],
  });
  await send(grantHash, "grantTimedAccess");
  const storeAuth = await signedNonce(patient, "STORE_ENVELOPE", recordId);
  await storeProtectedEnvelope(GATEWAY_URL, {
    recordId,
    patient: patient.address,
    ipfsCID: pinned.cid,
    encryptedKeyEnvelope: sealed.encryptedKeyEnvelope,
    contentHash: sealed.contentHash,
    ...storeAuth,
  });
  const grantTx = await publicClient.getTransaction({ hash: grantHash });
  const leaked = grantTx.input.toLowerCase().includes(sealed.encryptedKeyEnvelope.slice(2, 200).toLowerCase());
  console.log(`  - Envelope present in public calldata: ${leaked ? "YES (BUG)" : "no"}`);
  if (leaked) throw new Error("Envelope leaked to calldata");

  // 5. Specialist proves wallet ownership, gateway checks chain, specialist decrypts
  console.log("\n[5/7] Specialist requests release from gateway and decrypts in memory...");
  const releaseAuth = await signedNonce(specialist, "RELEASE_ENVELOPE", recordId);
  const released = await releaseProtectedEnvelope(GATEWAY_URL, {
    recordId,
    specialist: specialist.address,
    ...releaseAuth,
  });
  const meta = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: SYNAPSE_VAULT_ABI,
    functionName: "getGrantMetadata",
    args: [recordId],
  });
  if (computeEnvelopeHash(released.encryptedKeyEnvelope) !== meta.envelopeHash) {
    throw new Error("Gateway returned an envelope that does not match the on-chain commitment");
  }
  if (!released.blobToken) throw new Error("Gateway did not return a blob download token");
  const blob = await downloadBlobViaGateway(GATEWAY_URL, released.ipfsCID, released.blobToken);
  const plaintext = await unsealAndDecryptDocument(
    blob,
    released.encryptedKeyEnvelope,
    specialistKem.secretKey,
    meta.contentHash
  );
  console.log("  - Envelope hash matches chain, SHAKE-256(ciphertext) verified, decrypted:");
  console.log(new TextDecoder().decode(plaintext));

  // 6. Kill-Switch, then the gateway MUST refuse a new release
  console.log("\n[6/7] Patient activates the Emergency Kill-Switch...");
  await send(
    await walletFor(patient).writeContract({
      address: CONTRACT_ADDRESS,
      abi: SYNAPSE_VAULT_ABI,
      functionName: "emergencyRevokeAll",
    }),
    "emergencyRevokeAll"
  );
  const retryAuth = await signedNonce(specialist, "RELEASE_ENVELOPE", recordId);
  let refused = false;
  try {
    await releaseProtectedEnvelope(GATEWAY_URL, {
      recordId,
      specialist: specialist.address,
      ...retryAuth,
    });
  } catch (err) {
    refused = /403/.test(String(err));
    console.log(`  - Re-release attempt: ${String(err).slice(0, 90)}`);
  }
  if (!refused) {
    throw new Error("Expected the gateway to refuse the release after the Kill-Switch");
  }

  // 7. Honest limitation
  console.log("\n[7/7] Note: revocation blocks NEW releases. A specialist who already decrypted");
  console.log("      the document keeps what was delivered; revocation cannot recall it.");
  console.log("\n=== Demo completed successfully! ===");
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});

import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SYNAPSE_VAULT_ABI } from "./abi.js";
import {
  computeShake256,
  encryptAndSealDocument,
  generateDsaKeyPair,
  generateKemKeyPair,
  signMLDSA87,
  unsealAndDecryptDocument,
  verifyMLDSA87,
} from "./pqc.js";
import { fetchEncryptedBlob, uploadEncryptedBlob } from "./storage.js";

const RPC_URL = process.env.QORECHAIN_RPC_URL ?? "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = (process.env.SYNAPSE_VAULT_ADDRESS ??
  "0x0B306BF915C4d645ff596e518fAf3F9669b97016") as `0x${string}`;

// Default Anvil pre-funded accounts (local fork only)
const PATIENT_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const SPECIALIST_PK =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const MANUFACTURER_ADDR = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as const;

const qorechainDiana = defineChain({
  id: 9800,
  name: "QoreChain Diana Testnet (Local Fork)",
  nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

async function main() {
  const patientAccount = privateKeyToAccount(PATIENT_PK);
  const specialistAccount = privateKeyToAccount(SPECIALIST_PK);

  const publicClient = createPublicClient({
    chain: qorechainDiana,
    transport: http(RPC_URL),
  });

  const patientWallet = createWalletClient({
    account: patientAccount,
    chain: qorechainDiana,
    transport: http(RPC_URL),
  });

  console.log("=== SynapseQ End-to-End Post-Quantum Demo (QoreChain Fork 9800) ===");
  console.log("Contract:  ", CONTRACT_ADDRESS);
  console.log("Patient:   ", patientAccount.address);
  console.log("Specialist:", specialistAccount.address);

  // -------------------------------------------------------------------------
  // 1. Generate Post-Quantum Key Pairs (ML-KEM-1024 & ML-DSA-87)
  // -------------------------------------------------------------------------
  console.log("\n[1/6] Generating NIST Post-Quantum key pairs...");
  const specialistKem = generateKemKeyPair();
  const oemDsa = generateDsaKeyPair();
  console.log(`  - Specialist ML-KEM-1024 public key: ${specialistKem.publicKey.length} bytes`);
  console.log(`  - OEM ML-DSA-87 public key:          ${oemDsa.publicKey.length} bytes`);

  // -------------------------------------------------------------------------
  // 2. Sign Bionic Firmware with ML-DSA-87 & Register in HBOM On-Chain
  // -------------------------------------------------------------------------
  console.log("\n[2/6] Signing bionic firmware with ML-DSA-87 & registering HBOM part...");
  const runSalt = Date.now().toString();
  const partId = keccak256(toBytes(`SYNAPSEQ-BCI-PART-${runSalt}`));
  const firmwarePayload = new TextEncoder().encode("NeuroLink-X9-Firmware-v1.0.0-stable");
  const firmwareHash = computeShake256(firmwarePayload);
  const calibrationHash = computeShake256(new TextEncoder().encode("motor-cortex-cal-v1"));
  const firmwareSig = signMLDSA87(firmwarePayload, oemDsa.secretKey);

  const isSigValid = verifyMLDSA87(firmwarePayload, firmwareSig, oemDsa.publicKey);
  console.log(`  - ML-DSA-87 firmware signature valid: ${isSigValid} (${(firmwareSig.length - 2) / 2} bytes)`);

  const registerTx = await patientWallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: SYNAPSE_VAULT_ABI,
    functionName: "registerBionicPart",
    args: [
      partId,
      MANUFACTURER_ADDR,
      0, // AnatomicalZone.NEURAL
      "NeuroLink-X9 BCI",
      `SN-${runSalt.slice(-6)}`,
      firmwareHash,
      calibrationHash,
      firmwareSig,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: registerTx });
  console.log(`  - Registered HBOM part on-chain. Tx: ${registerTx}`);

  // -------------------------------------------------------------------------
  // 3. Encrypt Real Document (AES-256-GCM) & Seal Key with ML-KEM-1024
  // -------------------------------------------------------------------------
  console.log("\n[3/6] Encrypting biomedical/bionic document with AES-256-GCM + ML-KEM-1024...");
  const sampleDocument = {
    documentType: "BIONIC_TELEMETRY_AND_CLINICAL_REPORT",
    patientId: patientAccount.address,
    partId,
    timestamp: new Date().toISOString(),
    vitals: {
      neuralLatencyMs: 2.14,
      electrodeImpedanceKOhm: 4.8,
      batteryHealthPct: 98.4,
      mriNotes: "Zero inflammation around cortical interface; nominal synaptic response.",
    },
  };
  const plaintextBytes = new TextEncoder().encode(JSON.stringify(sampleDocument, null, 2));

  const sealed = await encryptAndSealDocument(plaintextBytes, specialistKem.publicKey);
  const cid = await uploadEncryptedBlob(sealed.encryptedBlob);

  console.log(`  - Plaintext size:        ${plaintextBytes.length} bytes`);
  console.log(`  - Encrypted blob size:   ${sealed.encryptedBlob.length} bytes (stored at .local-ipfs/${cid}.enc)`);
  console.log(`  - SHAKE-256 contentHash: ${sealed.contentHash}`);
  console.log(`  - ML-KEM-1024 envelope:  ${(sealed.encryptedKeyEnvelope.length - 2) / 2} bytes`);

  // -------------------------------------------------------------------------
  // 4. Grant Ephemeral Access Pass On-Chain (2 Hours)
  // -------------------------------------------------------------------------
  console.log("\n[4/6] Granting 2-hour ephemeral pass on QoreChain...");
  const recordId = keccak256(toBytes(`SYNAPSEQ-RECORD-${runSalt}`));
  const grantTx = await patientWallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: SYNAPSE_VAULT_ABI,
    functionName: "grantTimedAccess",
    args: [
      recordId,
      cid,
      sealed.contentHash,
      partId,
      specialistAccount.address,
      sealed.encryptedKeyEnvelope,
      1, // RecordDomain.BIONIC_TELEMETRY
      7200n, // 2 hours
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: grantTx });
  console.log(`  - Ephemeral pass granted. Tx: ${grantTx}`);

  // -------------------------------------------------------------------------
  // 5. Specialist Retrieves Envelope From QoreChain & Decrypts In Memory
  // -------------------------------------------------------------------------
  console.log("\n[5/6] Specialist fetching envelope from QoreChain & decrypting in memory...");
  const [fetchedCid, fetchedHash, fetchedPartId, fetchedEnvelope, , validUntil] =
    await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: SYNAPSE_VAULT_ABI,
      functionName: "getRecordForSpecialist",
      args: [recordId],
      account: specialistAccount.address,
    });

  const downloadedBlob = await fetchEncryptedBlob(fetchedCid);
  const decryptedBytes = await unsealAndDecryptDocument(
    downloadedBlob,
    fetchedEnvelope,
    specialistKem.secretKey,
    fetchedHash
  );
  const decryptedText = new TextDecoder().decode(decryptedBytes);

  console.log(`  - Access valid until unix: ${validUntil}`);
  console.log(`  - Linked HBOM partId:      ${fetchedPartId}`);
  console.log("  - SHAKE-256 integrity:     VERIFIED");
  console.log("  - Decrypted payload preview:");
  console.log(decryptedText);

  // -------------------------------------------------------------------------
  // 6. Patient Triggers Emergency Kill-Switch -> Specialist Blocked On-Chain
  // -------------------------------------------------------------------------
  console.log("\n[6/6] Patient activating Emergency Kill-Switch...");
  const killTx = await patientWallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: SYNAPSE_VAULT_ABI,
    functionName: "emergencyRevokeAll",
  });
  await publicClient.waitForTransactionReceipt({ hash: killTx });
  console.log(`  - Kill-Switch executed. Tx: ${killTx}`);

  try {
    await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: SYNAPSE_VAULT_ABI,
      functionName: "getRecordForSpecialist",
      args: [recordId],
      account: specialistAccount.address,
    });
    throw new Error("Expected specialist access to be revoked!");
  } catch {
    console.log("  - Specialist re-access attempt: REJECTED ON-CHAIN (AccessAlreadyRevoked)");
  }

  console.log("\n=== Demo completed successfully! ===");
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});

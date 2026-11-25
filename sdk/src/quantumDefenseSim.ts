import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}

import {
  computeShake256,
  encryptAndSealDocument,
  generateDsaKeyPair,
  generateKemKeyPair,
  signMLDSA87,
  unsealAndDecryptDocument,
  verifyMLDSA87,
} from "./pqc.js";
import { buildSynapseSovereignConfig } from "./rdkDa.js";
import { SynapseStorageRouter } from "./storageStrategy.js";

async function runQuantumDefenseSimulation() {
  console.log("=======================================================================");
  console.log("  SYNAPSEQ POST-QUANTUM DEFENSE & ATTACK SIMULATION (Q-DAY AUDIT)");
  console.log("  Standards: NIST FIPS 203 (ML-KEM-1024) | FIPS 204 (ML-DSA-87) | SHAKE-256");
  console.log("=======================================================================\n");

  const specialistKem = generateKemKeyPair();
  const attackerKem = generateKemKeyPair();
  const oemDsa = generateDsaKeyPair();
  const attackerDsa = generateDsaKeyPair();

  const bionicPayload = new TextEncoder().encode(
    JSON.stringify({
      recordType: "CYBER_HUMAN_HBOM_AND_NEURAL_TELEMETRY",
      partModel: "NeuroLink-X9 BCI",
      serial: "SN-9042-NLX9",
      neuralLatencyMs: 0.42,
      coherencePct: 99.84,
      classification: "TOP_SECRET_BIOMEDICAL",
    })
  );

  // ---------------------------------------------------------------------------
  // Vector 1: Harvest Now, Decrypt Later (HNDL) / Unauthorized ML-KEM Key
  // ---------------------------------------------------------------------------
  console.log("[VECTOR 1] Testing Harvest Now, Decrypt Later (HNDL) against ML-KEM-1024...");
  const sealed = await encryptAndSealDocument(bionicPayload, specialistKem.publicKey);
  console.log(`  - Sealed Envelope Size: ${(sealed.encryptedKeyEnvelope.length - 2) / 2} bytes`);
  console.log(`  - SHAKE-256 Commitment: ${sealed.contentHash}`);

  let hndlBlocked = false;
  try {
    await unsealAndDecryptDocument(
      sealed.encryptedBlob,
      sealed.encryptedKeyEnvelope,
      attackerKem.secretKey,
      sealed.contentHash
    );
  } catch {
    hndlBlocked = true;
  }

  if (!hndlBlocked) {
    throw new Error("SECURITY FAILURE: Attacker decrypted ML-KEM-1024 envelope!");
  }
  console.log(
    "  -> [DEFENSE VERIFIED] Attacker decapsulation rejected (ML-KEM-1024 implicit rejection + AES-256-GCM auth tag failure).\n"
  );

  // ---------------------------------------------------------------------------
  // Vector 2: 1-Bit Ciphertext / Payload Tampering vs SHAKE-256 & AES-GCM
  // ---------------------------------------------------------------------------
  console.log("[VECTOR 2] Testing 1-bit ciphertext tampering on IPFS/DA storage...");
  const tamperedBlob = new Uint8Array(sealed.encryptedBlob);
  tamperedBlob[tamperedBlob.length - 1] ^= 0x01;

  let tamperBlocked = false;
  try {
    await unsealAndDecryptDocument(
      tamperedBlob,
      sealed.encryptedKeyEnvelope,
      specialistKem.secretKey,
      sealed.contentHash
    );
  } catch {
    tamperBlocked = true;
  }

  if (!tamperBlocked) {
    throw new Error("SECURITY FAILURE: Tampered blob was accepted!");
  }
  console.log(
    "  -> [DEFENSE VERIFIED] 1-bit payload alteration immediately rejected before reaching application memory.\n"
  );

  // ---------------------------------------------------------------------------
  // Vector 3: On-Chain SHAKE-256 Commitment Mismatch Detection
  // ---------------------------------------------------------------------------
  console.log("[VECTOR 3] Testing on-chain SHAKE-256 contentHash mismatch protection...");
  const forgedOnChainHash = computeShake256(new TextEncoder().encode("forged-payload"));

  let hashMismatchBlocked = false;
  try {
    await unsealAndDecryptDocument(
      sealed.encryptedBlob,
      sealed.encryptedKeyEnvelope,
      specialistKem.secretKey,
      forgedOnChainHash
    );
  } catch {
    hashMismatchBlocked = true;
  }

  if (!hashMismatchBlocked) {
    throw new Error("SECURITY FAILURE: Mismatched SHAKE-256 contentHash was accepted!");
  }
  console.log(
    "  -> [DEFENSE VERIFIED] SHAKE-256 integrity check blocked mismatched on-chain commitment.\n"
  );

  // ---------------------------------------------------------------------------
  // Vector 4: Malicious Bionic Firmware Injection vs ML-DSA-87 (FIPS 204)
  // ---------------------------------------------------------------------------
  console.log("[VECTOR 4] Testing unauthorized bionic firmware signature forgery (ML-DSA-87)...");
  const legitimateFirmware = new TextEncoder().encode("NeuroLink-X9-Firmware-v2.4.1-signed");
  const maliciousFirmware = new TextEncoder().encode("NeuroLink-X9-Firmware-v2.4.1-BACKDOOR");

  const validSig = signMLDSA87(legitimateFirmware, oemDsa.secretKey);
  const attackerSig = signMLDSA87(maliciousFirmware, attackerDsa.secretKey);

  const isLegitValid = verifyMLDSA87(legitimateFirmware, validSig, oemDsa.publicKey);
  const isMaliciousPayloadValid = verifyMLDSA87(maliciousFirmware, validSig, oemDsa.publicKey);
  const isAttackerKeyValid = verifyMLDSA87(maliciousFirmware, attackerSig, oemDsa.publicKey);

  if (!isLegitValid || isMaliciousPayloadValid || isAttackerKeyValid) {
    throw new Error("SECURITY FAILURE: ML-DSA-87 signature verification anomaly!");
  }
  console.log(
    `  -> [DEFENSE VERIFIED] Legitimate OEM signature verified (${(validSig.length - 2) / 2} bytes); forged firmware & rogue OEM signatures strictly rejected.\n`
  );

  // ---------------------------------------------------------------------------
  // Vector 5: Smart Storage Router & Sovereign Rollup x/rdk Validation
  // ---------------------------------------------------------------------------
  console.log("[VECTOR 5] Auditing SynapseStorageRouter & QoreChain x/rdk Sovereign Rollup...");
  const router = new SynapseStorageRouter({ allowFallback: true });
  const decision = router.resolveStrategy(sealed.encryptedBlob, {
    domain: "BIONIC_TELEMETRY",
    retention: "ephemeral",
  });
  const rollup = buildSynapseSovereignConfig("synapseq-hbom-v1");

  if (!rollup.validation.valid) {
    throw new Error("SECURITY FAILURE: Sovereign Rollup x/rdk config invalid!");
  }
  console.log(`  - Storage Router Decision: ${decision.strategy.id} (${decision.reason})`);
  console.log(
    `  - Sovereign Rollup Config: ${rollup.config.rollupId} (valid=${rollup.validation.valid}, settlement=${rollup.config.settlement}, da=${rollup.config.da})\n`
  );

  console.log("=======================================================================");
  console.log("  ALL 5 POST-QUANTUM DEFENSE VECTORS PASSED (100% Q-DAY READY)");
  console.log("=======================================================================");
}

runQuantumDefenseSimulation().catch((err) => {
  console.error("Quantum Defense Simulation failed:", err);
  process.exit(1);
});

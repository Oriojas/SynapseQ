import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildGatewayAuthMessage,
  combineShares,
  decodeRecoveryShare,
  encodeRecoveryShare,
  encryptAndSealDocument,
  generateKemKeyPair,
  pinEncryptedBlobViaGateway,
  releaseProtectedEnvelope,
  requestGatewayNonce,
  shredProtectedRecord,
  splitSecret,
  storeProtectedEnvelope,
  unsealAndDecryptDocument,
} from "../../sdk/src/index.js";
import type { ChainPolicyVerifier, OnChainGrantPolicy } from "./chain.js";
import { createGatewayServer } from "./server.js";
import { EnvelopeVaultStore } from "./store.js";

if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}

const PATIENT = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
);
const SPECIALIST = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
);
const ATTACKER = privateKeyToAccount(
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
);

async function testShamirRecovery(): Promise<void> {
  console.log("[Test 1] Shamir Secret Sharing 2-of-3 Recovery...");
  const originalSeed = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const shares = splitSecret(originalSeed, 3, 2);
  assert.equal(shares.length, 3);

  // Encode & decode QR/paper share strings
  const decoded = shares.map((s) => decodeRecoveryShare(encodeRecoveryShare(s)));

  // Every 2-of-3 pair must reconstruct the exact original 32-byte seed
  const pairs = [
    [decoded[0], decoded[1]],
    [decoded[0], decoded[2]],
    [decoded[1], decoded[2]],
  ];
  for (const pair of pairs) {
    const recovered = combineShares(pair);
    assert.deepEqual(recovered, originalSeed);
  }

  // Fewer than 2 shares must throw
  assert.throws(() => combineShares([decoded[0]]), /At least 2 shares/);
  console.log("  PASS: All 2-of-3 pairs reconstructed the exact 32-byte ML-KEM master seed.");
}

async function testKeyReleaseGateway(): Promise<void> {
  console.log("[Test 2] Zero-Trust Key-Release Gateway + SIWE + Kill-Switch + Crypto-Shredding...");

  const recordId = keccak256(toBytes("SYNAPSEQ-ZERO-LEAK-TEST-001"));
  let currentPolicy: OnChainGrantPolicy = {
    patient: PATIENT.address,
    specialist: SPECIALIST.address,
    validUntil: BigInt(Math.floor(Date.now() / 1000) + 3600),
    revoked: false,
    isActive: true,
  };

  const mockVerifier: ChainPolicyVerifier = {
    async getGrantPolicy(id) {
      if (id.toLowerCase() !== recordId.toLowerCase()) return null;
      return currentPolicy;
    },
  };

  const tempDir = mkdtempSync(join(tmpdir(), "synapseq-gw-test-"));
  const store = new EnvelopeVaultStore(tempDir);
  const server = createGatewayServer({ verifier: mockVerifier, store });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const gatewayUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Encrypt document client-side with AES-256-GCM + ML-KEM-1024
    const specialistKem = generateKemKeyPair();
    const plaintext = new TextEncoder().encode(
      JSON.stringify({ exam: "Cranial MRI", implant: "NeuroLink-X9", secret: "zero-leak" })
    );
    const sealed = await encryptAndSealDocument(plaintext, specialistKem.publicKey);

    // 2. Patient pins encrypted blob via Gateway (no PINATA_JWT in client)
    const { nonce: pinNonce } = await requestGatewayNonce(gatewayUrl, PATIENT.address);
    const pinSig = await PATIENT.signMessage({
      message: buildGatewayAuthMessage({
        action: "PIN_BLOB",
        address: PATIENT.address,
        nonce: pinNonce,
      }),
    });
    const pinned = await pinEncryptedBlobViaGateway(gatewayUrl, {
      encryptedBlob: sealed.encryptedBlob,
      address: PATIENT.address,
      nonce: pinNonce,
      signature: pinSig,
      fileName: "mri-test.enc",
    });
    assert.ok(pinned.cid.startsWith("bafy-gw-"));

    // 3. Patient stores ML-KEM-1024 envelope off-chain in Gateway
    const { nonce: storeNonce } = await requestGatewayNonce(gatewayUrl, PATIENT.address);
    const storeSig = await PATIENT.signMessage({
      message: buildGatewayAuthMessage({
        action: "STORE_ENVELOPE",
        address: PATIENT.address,
        nonce: storeNonce,
        recordId,
      }),
    });
    const storeRes = await storeProtectedEnvelope(gatewayUrl, {
      recordId,
      patient: PATIENT.address,
      ipfsCID: pinned.cid,
      encryptedKeyEnvelope: sealed.encryptedKeyEnvelope,
      contentHash: sealed.contentHash,
      nonce: storeNonce,
      signature: storeSig,
    });
    assert.equal(storeRes.stored, true);

    // 4. Replay attack with already-consumed nonce must fail (401)
    await assert.rejects(
      () =>
        storeProtectedEnvelope(gatewayUrl, {
          recordId,
          patient: PATIENT.address,
          ipfsCID: pinned.cid,
          encryptedKeyEnvelope: sealed.encryptedKeyEnvelope,
          contentHash: sealed.contentHash,
          nonce: storeNonce,
          signature: storeSig,
        }),
      /401/
    );

    // 5. Unauthorized attacker attempting release must fail (403)
    const { nonce: atkNonce } = await requestGatewayNonce(gatewayUrl, ATTACKER.address);
    const atkSig = await ATTACKER.signMessage({
      message: buildGatewayAuthMessage({
        action: "RELEASE_ENVELOPE",
        address: ATTACKER.address,
        nonce: atkNonce,
        recordId,
      }),
    });
    await assert.rejects(
      () =>
        releaseProtectedEnvelope(gatewayUrl, {
          recordId,
          specialist: ATTACKER.address,
          nonce: atkNonce,
          signature: atkSig,
        }),
      /403/
    );

    // 6. Authorized specialist authenticates via SIWE & decrypts in memory
    const { nonce: specNonce } = await requestGatewayNonce(gatewayUrl, SPECIALIST.address);
    const specSig = await SPECIALIST.signMessage({
      message: buildGatewayAuthMessage({
        action: "RELEASE_ENVELOPE",
        address: SPECIALIST.address,
        nonce: specNonce,
        recordId,
      }),
    });
    const released = await releaseProtectedEnvelope(gatewayUrl, {
      recordId,
      specialist: SPECIALIST.address,
      nonce: specNonce,
      signature: specSig,
    });
    assert.equal(released.ipfsCID, pinned.cid);

    const blobRes = await fetch(`${gatewayUrl}/api/storage/blobs/${released.ipfsCID}`);
    assert.equal(blobRes.status, 200);
    const downloadedBlob = new Uint8Array(await blobRes.arrayBuffer());
    const decrypted = await unsealAndDecryptDocument(
      downloadedBlob,
      released.encryptedKeyEnvelope,
      specialistKem.secretKey,
      released.contentHash
    );
    assert.deepEqual(decrypted, plaintext);

    // 7. After on-chain Kill-Switch, specialist is strictly blocked (403)
    currentPolicy = { ...currentPolicy, revoked: true, isActive: false };
    const { nonce: postKillNonce } = await requestGatewayNonce(gatewayUrl, SPECIALIST.address);
    const postKillSig = await SPECIALIST.signMessage({
      message: buildGatewayAuthMessage({
        action: "RELEASE_ENVELOPE",
        address: SPECIALIST.address,
        nonce: postKillNonce,
        recordId,
      }),
    });
    await assert.rejects(
      () =>
        releaseProtectedEnvelope(gatewayUrl, {
          recordId,
          specialist: SPECIALIST.address,
          nonce: postKillNonce,
          signature: postKillSig,
        }),
      /403/
    );

    // 8. Right to Erasure (Ley 1581 / GDPR): patient crypto-shreds record & local blob
    const { nonce: shredNonce } = await requestGatewayNonce(gatewayUrl, PATIENT.address);
    const shredSig = await PATIENT.signMessage({
      message: buildGatewayAuthMessage({
        action: "SHRED_RECORD",
        address: PATIENT.address,
        nonce: shredNonce,
        recordId,
      }),
    });
    const shredRes = await shredProtectedRecord(gatewayUrl, {
      recordId,
      patient: PATIENT.address,
      nonce: shredNonce,
      signature: shredSig,
    });
    assert.equal(shredRes.shredded, true);

    const deletedBlobRes = await fetch(`${gatewayUrl}/api/storage/blobs/${pinned.cid}`);
    assert.equal(deletedBlobRes.status, 404);

    console.log("  PASS: SIWE auth, zero-leak release, replay protection, Kill-Switch 403, and Crypto-Shredding all verified!");
  } finally {
    server.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  await testShamirRecovery();
  await testKeyReleaseGateway();
  console.log("\nAll Gateway & Recovery tests passed!");
}

main().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});

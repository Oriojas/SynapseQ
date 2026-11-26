import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  buildGatewayAuthMessage,
  combineShares,
  decodeRecoveryShare,
  downloadBlobViaGateway,
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
  type GatewayAuthAction,
} from "../../sdk/src/index.js";
import { ChainUnavailableError, type ChainPolicyVerifier, type OnChainGrantPolicy } from "./chain.js";
import { createGatewayServer, type GatewayServerOptions } from "./server.js";
import { EnvelopeVaultStore } from "./store.js";

if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}

const CHAIN_ID = 9800;
const PATIENT = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const SPECIALIST = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const ATTACKER = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");

async function auth(
  gatewayUrl: string,
  account: PrivateKeyAccount,
  action: GatewayAuthAction,
  recordId?: `0x${string}`
): Promise<{ nonce: string; signature: `0x${string}` }> {
  const { nonce, chainId } = await requestGatewayNonce(gatewayUrl, account.address);
  assert.equal(chainId, CHAIN_ID);
  const signature = await account.signMessage({
    message: buildGatewayAuthMessage({ action, address: account.address, nonce, chainId, recordId }),
  });
  return { nonce, signature };
}

async function startServer(
  overrides: Partial<GatewayServerOptions> & { verifier: ChainPolicyVerifier }
): Promise<{ url: string; server: Server; dir: string }> {
  const dir = mkdtempSync(join(tmpdir(), "synapseq-gw-test-"));
  const server = createGatewayServer({ store: new EnvelopeVaultStore(dir), ...overrides });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, server, dir };
}

async function testShamirRecovery(): Promise<void> {
  console.log("[Test 1] Shamir Secret Sharing 2-of-3 Recovery...");
  const originalSeed = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const decoded = splitSecret(originalSeed, 3, 2).map((s) => decodeRecoveryShare(encodeRecoveryShare(s)));
  for (const pair of [[decoded[0], decoded[1]], [decoded[0], decoded[2]], [decoded[1], decoded[2]]]) {
    assert.deepEqual(combineShares(pair), originalSeed);
  }
  assert.throws(() => combineShares([decoded[0]]), /At least 2 shares/);
  console.log("  PASS");
}

async function testKeyReleaseGateway(): Promise<void> {
  console.log("[Test 2] Key-Release Gateway: commitments, release, blob token, kill-switch, shredding...");

  const specialistKem = generateKemKeyPair();
  const plaintext = new TextEncoder().encode(JSON.stringify({ exam: "Cranial MRI", secret: "zero-leak" }));
  const sealed = await encryptAndSealDocument(plaintext, specialistKem.publicKey);
  const recordId = keccak256(toBytes("SYNAPSEQ-ZERO-LEAK-TEST-001"));

  let policy: OnChainGrantPolicy = {
    patient: PATIENT.address,
    specialist: SPECIALIST.address,
    validUntil: BigInt(Math.floor(Date.now() / 1000) + 3600),
    revoked: false,
    isActive: true,
    contentHash: sealed.contentHash,
    envelopeHash: sealed.envelopeHash,
  };
  const verifier: ChainPolicyVerifier = {
    chainId: CHAIN_ID,
    async getGrantPolicy(id) {
      return id.toLowerCase() === recordId.toLowerCase() ? policy : null;
    },
  };
  const { url, server, dir } = await startServer({ verifier });

  try {
    // Pin via gateway
    const pinned = await pinEncryptedBlobViaGateway(url, {
      encryptedBlob: sealed.encryptedBlob,
      address: PATIENT.address,
      ...(await auth(url, PATIENT, "PIN_BLOB")),
    });
    assert.ok(pinned.cid.startsWith("bafy-gw-"));

    // Regression M2: blob is not downloadable without a release token
    const anon = await fetch(`${url}/api/storage/blobs/${pinned.cid}`);
    assert.equal(anon.status, 401);

    // Envelope that does not match the on-chain commitment is rejected (409)
    const lastByte = sealed.encryptedKeyEnvelope.slice(-2);
    const tampered = (sealed.encryptedKeyEnvelope.slice(0, -2) +
      (lastByte === "00" ? "ff" : "00")) as `0x${string}`;
    await assert.rejects(
      async () =>
        storeProtectedEnvelope(url, {
          recordId,
          patient: PATIENT.address,
          ipfsCID: pinned.cid,
          encryptedKeyEnvelope: tampered,
          contentHash: sealed.contentHash,
          ...(await auth(url, PATIENT, "STORE_ENVELOPE", recordId)),
        }),
      /409/
    );

    // Valid store
    const storeAuth = await auth(url, PATIENT, "STORE_ENVELOPE", recordId);
    const storeBody = {
      recordId,
      patient: PATIENT.address,
      ipfsCID: pinned.cid,
      encryptedKeyEnvelope: sealed.encryptedKeyEnvelope,
      contentHash: sealed.contentHash,
      ...storeAuth,
    };
    assert.equal((await storeProtectedEnvelope(url, storeBody)).stored, true);

    // Replay with a consumed nonce fails (401)
    await assert.rejects(() => storeProtectedEnvelope(url, storeBody), /401/);

    // Attacker cannot release (403)
    await assert.rejects(
      async () =>
        releaseProtectedEnvelope(url, {
          recordId,
          specialist: ATTACKER.address,
          ...(await auth(url, ATTACKER, "RELEASE_ENVELOPE", recordId)),
        }),
      /403/
    );

    // Signature for a different chain is rejected (401)
    {
      const { nonce } = await requestGatewayNonce(url, SPECIALIST.address);
      const wrongChainSig = await SPECIALIST.signMessage({
        message: buildGatewayAuthMessage({
          action: "RELEASE_ENVELOPE",
          address: SPECIALIST.address,
          nonce,
          chainId: 1,
          recordId,
        }),
      });
      await assert.rejects(
        () => releaseProtectedEnvelope(url, { recordId, specialist: SPECIALIST.address, nonce, signature: wrongChainSig }),
        /401/
      );
    }

    // Authorized specialist: release + single-use token download + decrypt
    const released = await releaseProtectedEnvelope(url, {
      recordId,
      specialist: SPECIALIST.address,
      ...(await auth(url, SPECIALIST, "RELEASE_ENVELOPE", recordId)),
    });
    assert.ok(released.blobToken);
    const blob = await downloadBlobViaGateway(url, released.ipfsCID, released.blobToken);
    const decrypted = await unsealAndDecryptDocument(
      blob,
      released.encryptedKeyEnvelope,
      specialistKem.secretKey,
      policy.contentHash
    );
    assert.deepEqual(decrypted, plaintext);
    // Token is single-use
    await assert.rejects(() => downloadBlobViaGateway(url, released.ipfsCID, released.blobToken!), /401/);

    // Kill-switch: release refused (403)
    policy = { ...policy, revoked: true, isActive: false };
    await assert.rejects(
      async () =>
        releaseProtectedEnvelope(url, {
          recordId,
          specialist: SPECIALIST.address,
          ...(await auth(url, SPECIALIST, "RELEASE_ENVELOPE", recordId)),
        }),
      /403/
    );

    // Crypto-shredding by the patient
    const shred = await shredProtectedRecord(url, {
      recordId,
      patient: PATIENT.address,
      ...(await auth(url, PATIENT, "SHRED_RECORD", recordId)),
    });
    assert.equal(shred.shredded, true);
    console.log("  PASS");
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

async function testAbuseLimits(): Promise<void> {
  console.log("[Test 3] Abuse limits: CORS allowlist, nonce cap, pin quota, chain outage...");
  const verifier: ChainPolicyVerifier = {
    chainId: CHAIN_ID,
    async getGrantPolicy() {
      throw new ChainUnavailableError("RPC down");
    },
  };
  const { url, server, dir } = await startServer({
    verifier,
    pinQuota: { maxPins: 2, maxBytes: 10 * 1024 * 1024, windowMs: 60_000 },
  });
  try {
    // CORS: unknown origins get no Access-Control-Allow-Origin
    const evil = await fetch(`${url}/health`, { headers: { Origin: "https://evil.example" } });
    assert.equal(evil.headers.get("access-control-allow-origin"), null);
    const good = await fetch(`${url}/health`, { headers: { Origin: "http://localhost:5173" } });
    assert.equal(good.headers.get("access-control-allow-origin"), "http://localhost:5173");

    // Nonce cap per address (M3)
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      statuses.push((await fetch(`${url}/api/auth/nonce?address=${ATTACKER.address}`)).status);
    }
    assert.deepEqual(statuses.slice(0, 5), [200, 200, 200, 200, 200]);
    assert.equal(statuses[6], 429);

    // Pin quota per wallet (M1)
    const results: string[] = [];
    for (let i = 0; i < 3; i++) {
      try {
        await pinEncryptedBlobViaGateway(url, {
          encryptedBlob: new Uint8Array(1024),
          address: PATIENT.address,
          ...(await auth(url, PATIENT, "PIN_BLOB")),
        });
        results.push("ok");
      } catch (err) {
        results.push(String(err));
      }
    }
    assert.equal(results[0], "ok");
    assert.equal(results[1], "ok");
    assert.match(results[2], /429/);

    // Chain outage is a 503, not a misleading 404 (M4)
    const recordId = keccak256(toBytes("x"));
    await assert.rejects(
      async () =>
        releaseProtectedEnvelope(url, {
          recordId,
          specialist: SPECIALIST.address,
          ...(await auth(url, SPECIALIST, "RELEASE_ENVELOPE", recordId)),
        }),
      /503/
    );
    console.log("  PASS");
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  await testShamirRecovery();
  await testKeyReleaseGateway();
  await testAbuseLimits();
  console.log("\nAll Gateway & Recovery tests passed!");
}

main().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});

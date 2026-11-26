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
import {
  classifyEvmWindowRejection,
  parseEvmWindow,
  windowBlocksTarget,
} from "../../sdk/src/evmWindow.js";
import { toQorAddress } from "../../sdk/src/qoreRest.js";

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

async function testEvmWindow(): Promise<void> {
  console.log("[Test 4] EVM authorisation window: parsing, bounds, rejection classes, proxy...");
  const VAULT = "0x0f6c2bbbb4137e7809669c05b075616556a2c2d6";

  // Real Diana REST body (unbounded window opened by the team's deployer)
  const unbounded = parseEvmWindow({
    found: true, live: true, opened_height: "10761196", expiry_height: "10766196", max_txs: "50",
    used_txs: "1", max_value: "10000000", used_value: "145771", remaining_blocks: "4105",
    remaining_txs: "49", remaining_value: "9854229", native_only: false, allowed_targets: [],
  });
  assert.equal(unbounded.live, true);
  assert.equal(unbounded.remainingTxs, 49n);
  assert.equal(windowBlocksTarget(unbounded, VAULT), null);

  const bounded = parseEvmWindow({ found: true, live: true, remaining_txs: "5", allowed_targets: [VAULT.toUpperCase().replace("0X", "0x")] });
  assert.equal(windowBlocksTarget(bounded, VAULT), null);
  assert.equal(windowBlocksTarget(bounded, "0x000000000000000000000000000000000000dEaD"), "out-of-scope");
  assert.equal(windowBlocksTarget(parseEvmWindow({ found: false }), VAULT), "no-window");
  assert.equal(windowBlocksTarget(parseEvmWindow({ found: true, live: false }), VAULT), "exhausted");
  assert.equal(windowBlocksTarget(parseEvmWindow({ found: true, live: true, remaining_txs: "3", native_only: true }), VAULT), "out-of-scope");

  // Same text/code rules as @qorechain/sdk classifyEvmWindowRejection
  assert.equal(classifyEvmWindowRejection(new Error("account qor1x has no registered post-quantum key")), "no-pqc-key");
  assert.equal(classifyEvmWindowRejection({ shortMessage: "x", cause: { message: "no open EVM authorisation window for qor1x" } }), "no-window");
  assert.equal(classifyEvmWindowRejection({ message: "EVM authorisation window exhausted" }), "exhausted");
  assert.equal(classifyEvmWindowRejection({ codespace: "pqc", code: 28 }), "invalid");
  assert.equal(classifyEvmWindowRejection(new Error("execution reverted")), undefined);

  // 0x and qor1 are the same 20 bytes
  assert.equal(toQorAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"), "qor1wzvhjux9rqfdcwspp37srdgwp5tac7wglagw2y");

  // Gateway proxy endpoint
  const verifier: ChainPolicyVerifier = { chainId: CHAIN_ID, async getGrantPolicy() { return null; } };
  let reads = 0;
  const { url, server, dir } = await startServer({
    verifier,
    evmWindowReader: async () => {
      reads++;
      return bounded;
    },
  });
  try {
    const r1 = (await (await fetch(`${url}/api/qore/evm-window/${PATIENT.address}`)).json()) as Record<string, unknown>;
    assert.equal(r1.enforced, true);
    assert.equal(r1.live, true);
    assert.equal(r1.remainingTxs, "5");
    assert.deepEqual(r1.allowedTargets, [VAULT]);
    await fetch(`${url}/api/qore/evm-window/${PATIENT.address}`);
    assert.equal(reads, 1, "second read within 10 s must come from the cache");
    const bad = await fetch(`${url}/api/qore/evm-window/not-an-address`);
    assert.equal(bad.status, 404);
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }

  // Local chain (no reader): not enforced
  const local = await startServer({ verifier });
  try {
    const r = (await (await fetch(`${local.url}/api/qore/evm-window/${PATIENT.address}`)).json()) as Record<string, unknown>;
    assert.equal(r.enforced, false);
  } finally {
    local.server.close();
    rmSync(local.dir, { recursive: true, force: true });
  }
  console.log("  PASS");
}

async function main() {
  await testShamirRecovery();
  await testKeyReleaseGateway();
  await testAbuseLimits();
  await testEvmWindow();
  console.log("\nAll Gateway & Recovery tests passed!");
}

main().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});

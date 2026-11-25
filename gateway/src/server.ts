import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { GatewayAuthService } from "./auth.js";
import type { ChainPolicyVerifier } from "./chain.js";
import { EnvelopeVaultStore } from "./store.js";
import { unpinFromPinata, uploadEncryptedBlobToPinata } from "../../sdk/src/storage.js";

const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MiB cap for encrypted clinical/DICOM blobs

export interface GatewayServerOptions {
  readonly verifier: ChainPolicyVerifier;
  readonly store: EnvelopeVaultStore;
  readonly auth?: GatewayAuthService;
  readonly pinataJwt?: string;
  readonly corsOrigin?: string;
}

function sendJson(res: ServerResponse, status: number, body: unknown, corsOrigin: string): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error("Payload exceeds maximum allowed size (25 MiB).");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = await readRawBody(req);
  return JSON.parse(raw.toString("utf8")) as T;
}

/**
 * Creates the SynapseQ Zero-Trust Key-Release & Pinata Proxy HTTP server.
 */
export function createGatewayServer(options: GatewayServerOptions): Server {
  const auth = options.auth ?? new GatewayAuthService();
  const corsOrigin = options.corsOrigin ?? "*";

  return createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        sendJson(res, 400, { error: "Malformed request." }, corsOrigin);
        return;
      }

      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
      }

      const url = new URL(req.url, "http://127.0.0.1");
      const pathname = url.pathname;

      // 1. Health check
      if (req.method === "GET" && pathname === "/health") {
        sendJson(
          res,
          200,
          {
            status: "ok",
            service: "synapseq-key-release-gateway",
            pinataConfigured: Boolean(options.pinataJwt),
          },
          corsOrigin
        );
        return;
      }

      // 2. Issue single-use authentication nonce (60s TTL)
      if (req.method === "GET" && pathname === "/api/auth/nonce") {
        const address = url.searchParams.get("address");
        if (!address) {
          sendJson(res, 400, { error: "Missing required query parameter: address" }, corsOrigin);
          return;
        }
        const issued = auth.issueNonce(address);
        sendJson(res, 200, issued, corsOrigin);
        return;
      }

      // 3. Store ML-KEM-1024 envelope & IPFS CID off-chain (patient authenticated)
      if (req.method === "POST" && pathname === "/api/envelopes") {
        const body = await readJsonBody<{
          recordId: `0x${string}`;
          patient: `0x${string}`;
          ipfsCID: string;
          encryptedKeyEnvelope: `0x${string}`;
          contentHash: `0x${string}`;
          nonce: string;
          signature: `0x${string}`;
        }>(req);

        const signer = await auth.verifyAndConsume({
          action: "STORE_ENVELOPE",
          address: body.patient,
          nonce: body.nonce,
          signature: body.signature,
          recordId: body.recordId,
        });

        const policy = await options.verifier.getGrantPolicy(body.recordId);
        if (!policy) {
          sendJson(
            res,
            404,
            { error: "Record policy not found on QoreChain. Submit grantTimedAccess first." },
            corsOrigin
          );
          return;
        }
        if (policy.patient.toLowerCase() !== signer.toLowerCase()) {
          sendJson(res, 403, { error: "Only the on-chain record owner can store envelopes." }, corsOrigin);
          return;
        }

        options.store.put({
          recordId: body.recordId,
          patient: signer,
          ipfsCID: body.ipfsCID,
          encryptedKeyEnvelope: body.encryptedKeyEnvelope,
          contentHash: body.contentHash,
          storedAt: Date.now(),
        });

        sendJson(res, 201, { stored: true, recordId: body.recordId }, corsOrigin);
        return;
      }

      // 4. Conditional Key Release (specialist SIWE signature + live on-chain isAccessValid check)
      const releaseMatch = /^\/api\/envelopes\/(0x[a-fA-F0-9]{64})\/release$/.exec(pathname);
      if (req.method === "POST" && releaseMatch) {
        const recordId = releaseMatch[1] as `0x${string}`;
        const body = await readJsonBody<{
          specialist: `0x${string}`;
          nonce: string;
          signature: `0x${string}`;
        }>(req);

        const signer = await auth.verifyAndConsume({
          action: "RELEASE_ENVELOPE",
          address: body.specialist,
          nonce: body.nonce,
          signature: body.signature,
          recordId,
        });

        const stored = options.store.get(recordId);
        if (!stored) {
          sendJson(
            res,
            404,
            { error: "Envelope not found (never stored or permanently crypto-shredded)." },
            corsOrigin
          );
          return;
        }

        const policy = await options.verifier.getGrantPolicy(recordId);
        if (!policy) {
          sendJson(res, 404, { error: "Record policy not found on QoreChain." }, corsOrigin);
          return;
        }
        if (policy.specialist.toLowerCase() !== signer.toLowerCase()) {
          sendJson(res, 403, { error: "Wallet is not the authorized specialist for this record." }, corsOrigin);
          return;
        }
        if (policy.revoked) {
          sendJson(res, 403, { error: "Access revoked on-chain by patient (Kill-Switch)." }, corsOrigin);
          return;
        }
        if (!policy.isActive) {
          sendJson(res, 403, { error: "Ephemeral access window has expired on-chain." }, corsOrigin);
          return;
        }

        sendJson(
          res,
          200,
          {
            recordId: stored.recordId,
            ipfsCID: stored.ipfsCID,
            encryptedKeyEnvelope: stored.encryptedKeyEnvelope,
            contentHash: stored.contentHash,
            validUntil: policy.validUntil.toString(),
          },
          corsOrigin
        );
        return;
      }

      // 5. Right to Erasure (Ley 1581 / GDPR): Crypto-Shredding + Pinata unpin
      const deleteMatch = /^\/api\/envelopes\/(0x[a-fA-F0-9]{64})$/.exec(pathname);
      if (req.method === "DELETE" && deleteMatch) {
        const recordId = deleteMatch[1] as `0x${string}`;
        const body = await readJsonBody<{
          patient: `0x${string}`;
          nonce: string;
          signature: `0x${string}`;
        }>(req);

        const signer = await auth.verifyAndConsume({
          action: "SHRED_RECORD",
          address: body.patient,
          nonce: body.nonce,
          signature: body.signature,
          recordId,
        });

        const existing = options.store.get(recordId);
        if (!existing) {
          sendJson(res, 404, { error: "Record envelope not found." }, corsOrigin);
          return;
        }
        if (existing.patient.toLowerCase() !== signer.toLowerCase()) {
          sendJson(res, 403, { error: "Only the patient can crypto-shred this record." }, corsOrigin);
          return;
        }

        options.store.shred(recordId);

        let unpinnedFromPinata = false;
        if (options.pinataJwt && !existing.ipfsCID.startsWith("bafy-gw-") && !existing.ipfsCID.startsWith("bafy-synapseq-")) {
          try {
            unpinnedFromPinata = await unpinFromPinata(existing.ipfsCID, options.pinataJwt);
          } catch {
            unpinnedFromPinata = false;
          }
        }

        sendJson(res, 200, { shredded: true, unpinnedFromPinata }, corsOrigin);
        return;
      }

      // 6. Server-side Pinata upload proxy (keeps PINATA_JWT strictly off the browser)
      if (req.method === "POST" && pathname === "/api/storage/pin") {
        const contentType = req.headers["content-type"] ?? "";
        if (!contentType.includes("multipart/form-data")) {
          sendJson(res, 400, { error: "Expected multipart/form-data payload." }, corsOrigin);
          return;
        }

        const rawBody = await readRawBody(req);
        const formData = await new Response(new Uint8Array(rawBody), {
          headers: { "content-type": contentType },
        }).formData();

        const file = formData.get("file");
        const address = formData.get("address");
        const nonce = formData.get("nonce");
        const signature = formData.get("signature");
        const fileName = formData.get("fileName");

        if (
          !(file instanceof Blob) ||
          typeof address !== "string" ||
          typeof nonce !== "string" ||
          typeof signature !== "string"
        ) {
          sendJson(res, 400, { error: "Missing required fields: file, address, nonce, signature." }, corsOrigin);
          return;
        }

        await auth.verifyAndConsume({
          action: "PIN_BLOB",
          address,
          nonce,
          signature: signature as `0x${string}`,
        });

        const encryptedBytes = new Uint8Array(await file.arrayBuffer());

        if (options.pinataJwt) {
          const pinned = await uploadEncryptedBlobToPinata(encryptedBytes, {
            jwt: options.pinataJwt,
            fileName: typeof fileName === "string" ? fileName : undefined,
            metadata: { app: "SynapseQ", mode: "gateway-proxy" },
          });
          sendJson(
            res,
            201,
            { cid: pinned.cid, provider: "pinata-ipfs", size: pinned.size },
            corsOrigin
          );
          return;
        }

        const localCid = options.store.putLocalBlob(encryptedBytes);
        sendJson(
          res,
          201,
          { cid: localCid, provider: "gateway-local", size: encryptedBytes.length },
          corsOrigin
        );
        return;
      }

      // 7. Serve local fallback encrypted blobs (dev mode only)
      const blobMatch = /^\/api\/storage\/blobs\/(bafy-gw-[a-f0-9]{32})$/.exec(pathname);
      if (req.method === "GET" && blobMatch) {
        const cid = blobMatch[1];
        const bytes = options.store.getLocalBlob(cid);
        if (!bytes) {
          sendJson(res, 404, { error: "Encrypted blob not found (or shredded)." }, corsOrigin);
          return;
        }
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Access-Control-Allow-Origin": corsOrigin,
        });
        res.end(Buffer.from(bytes));
        return;
      }

      sendJson(res, 404, { error: "Endpoint not found." }, corsOrigin);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal gateway error";
      const status =
        message.includes("nonce") || message.includes("signature") || message.includes("Nonce")
          ? 401
          : 400;
      sendJson(res, status, { error: message }, corsOrigin);
    }
  });
}

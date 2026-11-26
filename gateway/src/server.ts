import { createServer, type IncomingMessage, type Server } from "node:http";
import { keccak256 } from "viem";
import { AuthError, GatewayAuthService } from "./auth.js";
import { ChainUnavailableError, type ChainPolicyVerifier } from "./chain.js";
import { EnvelopeVaultStore } from "./store.js";
import { unpinFromPinata, uploadEncryptedBlobToPinata } from "../../sdk/src/storage.js";
import type { EvmWindowStatus } from "../../sdk/src/evmWindow.js";

const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MiB cap for encrypted clinical/DICOM blobs
const MAX_JSON_BYTES = 64 * 1024; // envelopes are ~1.6 KB; JSON bodies never need more
const RECORD_ID_RE = /^0x[a-fA-F0-9]{64}$/;
const HEX_RE = /^0x[a-fA-F0-9]*$/;

export interface PinQuota {
  /** Max pins per wallet per window. */
  readonly maxPins: number;
  /** Max total bytes per wallet per window. */
  readonly maxBytes: number;
  readonly windowMs: number;
}

export interface GatewayServerOptions {
  readonly verifier: ChainPolicyVerifier;
  readonly store: EnvelopeVaultStore;
  readonly auth?: GatewayAuthService;
  readonly pinataJwt?: string;
  /** Allowed browser origins. Requests from other origins get no CORS headers. */
  readonly corsOrigins?: readonly string[];
  readonly pinQuota?: PinQuota;
  /** Max requests per client IP per minute (all endpoints). */
  readonly ipRequestsPerMinute?: number;
  /**
   * Reads an account's QoreChain EVM authorisation window (server-side: the public REST API sends
   * no CORS headers). Omit on chains without windows (local Anvil): the endpoint then reports
   * `enforced: false`.
   */
  readonly evmWindowReader?: (address: string) => Promise<EvmWindowStatus>;
}

const DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const DEFAULT_PIN_QUOTA: PinQuota = { maxPins: 20, maxBytes: 100 * 1024 * 1024, windowMs: 3_600_000 };

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/** Fixed-window counter keyed by an arbitrary string. */
class WindowCounter {
  private readonly buckets = new Map<string, { count: number; bytes: number; resetAt: number }>();
  constructor(private readonly windowMs: number) {}

  public hit(key: string, bytes = 0): { count: number; bytes: number } {
    const now = Date.now();
    if (this.buckets.size > 50_000) {
      for (const [k, b] of this.buckets) if (now > b.resetAt) this.buckets.delete(k);
    }
    let bucket = this.buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, bytes: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    bucket.bytes += bytes;
    return { count: bucket.count, bytes: bucket.bytes };
  }
}

async function readRawBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const declared = Number(req.headers["content-length"] ?? 0);
  if (declared > limit) throw new HttpError(413, "Payload too large.");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > limit) throw new HttpError(413, "Payload too large.");
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = await readRawBody(req, MAX_JSON_BYTES);
  try {
    return JSON.parse(raw.toString("utf8")) as T;
  } catch {
    throw new HttpError(400, "Malformed JSON body.");
  }
}

/**
 * Creates the SynapseQ Key-Release & Pinata Proxy HTTP server.
 */
export function createGatewayServer(options: GatewayServerOptions): Server {
  const auth = options.auth ?? new GatewayAuthService(options.verifier.chainId);
  const allowedOrigins = new Set(options.corsOrigins ?? DEFAULT_CORS_ORIGINS);
  const pinQuota = options.pinQuota ?? DEFAULT_PIN_QUOTA;
  const pinCounter = new WindowCounter(pinQuota.windowMs);
  const ipCounter = new WindowCounter(60_000);
  const ipLimit = options.ipRequestsPerMinute ?? 300;
  const windowCache = new Map<string, { at: number; body: unknown }>();
  const WINDOW_CACHE_MS = 10_000;

  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    const corsHeaders: Record<string, string> =
      origin && allowedOrigins.has(origin)
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            Vary: "Origin",
          }
        : {};
    const sendJson = (status: number, body: unknown): void => {
      res.writeHead(status, { "Content-Type": "application/json", ...corsHeaders });
      res.end(JSON.stringify(body));
    };

    try {
      if (!req.url || !req.method) throw new HttpError(400, "Malformed request.");

      if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }

      const ip = req.socket.remoteAddress ?? "unknown";
      if (ipCounter.hit(ip).count > ipLimit) throw new HttpError(429, "Too many requests.");

      const url = new URL(req.url, "http://127.0.0.1");
      const pathname = url.pathname;

      // 1. Health check
      if (req.method === "GET" && pathname === "/health") {
        sendJson(200, {
          status: "ok",
          service: "synapseq-key-release-gateway",
          chainId: options.verifier.chainId,
          pinataConfigured: Boolean(options.pinataJwt),
        });
        return;
      }

      // 1b. EVM authorisation window status (proxied: QoreChain REST has no CORS)
      const windowMatch = /^\/api\/qore\/evm-window\/(0x[a-fA-F0-9]{40})$/.exec(pathname);
      if (req.method === "GET" && windowMatch) {
        if (!options.evmWindowReader) {
          sendJson(200, { enforced: false });
          return;
        }
        const key = windowMatch[1].toLowerCase();
        const cached = windowCache.get(key);
        if (cached && Date.now() - cached.at < WINDOW_CACHE_MS) {
          sendJson(200, cached.body);
          return;
        }
        let win: EvmWindowStatus;
        try {
          win = await options.evmWindowReader(key);
        } catch (err) {
          throw new ChainUnavailableError(
            `Could not read the EVM window: ${err instanceof Error ? err.message : String(err)}`
          );
        }
        const body = {
          enforced: true,
          found: win.found,
          live: win.live,
          expiryHeight: win.expiryHeight.toString(),
          remainingBlocks: win.remainingBlocks.toString(),
          remainingTxs: win.remainingTxs.toString(),
          remainingValue: win.remainingValue.toString(),
          nativeOnly: win.nativeOnly,
          allowedTargets: win.allowedTargets,
        };
        if (windowCache.size > 5_000) windowCache.clear();
        windowCache.set(key, { at: Date.now(), body });
        sendJson(200, body);
        return;
      }

      // 2. Issue single-use authentication nonce (60s TTL, capped per address)
      if (req.method === "GET" && pathname === "/api/auth/nonce") {
        const address = url.searchParams.get("address");
        if (!address) throw new HttpError(400, "Missing required query parameter: address");
        sendJson(200, auth.issueNonce(address));
        return;
      }

      // 3. Store envelope + CID off-chain. Only the on-chain patient may store, and the envelope
      //    and ciphertext hash must match the commitments written by grantTimedAccess.
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
        if (!RECORD_ID_RE.test(String(body.recordId))) throw new HttpError(400, "Invalid recordId.");
        if (typeof body.ipfsCID !== "string" || body.ipfsCID.length === 0 || body.ipfsCID.length > 200) {
          throw new HttpError(400, "Invalid ipfsCID.");
        }
        if (!HEX_RE.test(String(body.encryptedKeyEnvelope)) || !RECORD_ID_RE.test(String(body.contentHash))) {
          throw new HttpError(400, "Invalid envelope or contentHash encoding.");
        }

        const signer = await auth.verifyAndConsume({
          action: "STORE_ENVELOPE",
          address: body.patient,
          nonce: body.nonce,
          signature: body.signature,
          recordId: body.recordId,
        });

        const policy = await options.verifier.getGrantPolicy(body.recordId);
        if (!policy) {
          throw new HttpError(404, "Record policy not found on QoreChain. Submit grantTimedAccess first.");
        }
        if (policy.patient.toLowerCase() !== signer.toLowerCase()) {
          throw new HttpError(403, "Only the on-chain record owner can store envelopes.");
        }
        if (keccak256(body.encryptedKeyEnvelope).toLowerCase() !== policy.envelopeHash.toLowerCase()) {
          throw new HttpError(409, "Envelope does not match the on-chain envelopeHash commitment.");
        }
        if (body.contentHash.toLowerCase() !== policy.contentHash.toLowerCase()) {
          throw new HttpError(409, "contentHash does not match the on-chain commitment.");
        }
        if (options.store.get(body.recordId)) {
          throw new HttpError(409, "Envelope already stored for this record.");
        }

        options.store.put({
          recordId: body.recordId,
          patient: signer,
          ipfsCID: body.ipfsCID,
          encryptedKeyEnvelope: body.encryptedKeyEnvelope,
          contentHash: body.contentHash,
          storedAt: Date.now(),
        });
        sendJson(201, { stored: true, recordId: body.recordId });
        return;
      }

      // 4. Conditional key release (wallet signature + live on-chain isActive check)
      const releaseMatch = /^\/api\/envelopes\/(0x[a-fA-F0-9]{64})\/release$/.exec(pathname);
      if (req.method === "POST" && releaseMatch) {
        const recordId = releaseMatch[1] as `0x${string}`;
        const body = await readJsonBody<{ specialist: `0x${string}`; nonce: string; signature: `0x${string}` }>(req);

        const signer = await auth.verifyAndConsume({
          action: "RELEASE_ENVELOPE",
          address: body.specialist,
          nonce: body.nonce,
          signature: body.signature,
          recordId,
        });

        const policy = await options.verifier.getGrantPolicy(recordId);
        if (!policy) throw new HttpError(404, "Record policy not found on QoreChain.");
        if (policy.specialist.toLowerCase() !== signer.toLowerCase()) {
          throw new HttpError(403, "Wallet is not the authorized specialist for this record.");
        }
        if (policy.revoked) throw new HttpError(403, "Access revoked on-chain by patient (Kill-Switch).");
        if (!policy.isActive) throw new HttpError(403, "Ephemeral access window has expired on-chain.");

        const stored = options.store.get(recordId);
        if (!stored) {
          throw new HttpError(404, "Envelope not found (never stored or permanently crypto-shredded).");
        }

        sendJson(200, {
          recordId: stored.recordId,
          ipfsCID: stored.ipfsCID,
          encryptedKeyEnvelope: stored.encryptedKeyEnvelope,
          contentHash: stored.contentHash,
          validUntil: policy.validUntil.toString(),
          blobToken: stored.ipfsCID.startsWith("bafy-gw-")
            ? options.store.issueBlobToken(stored.ipfsCID)
            : undefined,
        });
        return;
      }

      // 5. Right to Erasure: crypto-shredding + Pinata unpin
      const deleteMatch = /^\/api\/envelopes\/(0x[a-fA-F0-9]{64})$/.exec(pathname);
      if (req.method === "DELETE" && deleteMatch) {
        const recordId = deleteMatch[1] as `0x${string}`;
        const body = await readJsonBody<{ patient: `0x${string}`; nonce: string; signature: `0x${string}` }>(req);

        const signer = await auth.verifyAndConsume({
          action: "SHRED_RECORD",
          address: body.patient,
          nonce: body.nonce,
          signature: body.signature,
          recordId,
        });

        const existing = options.store.get(recordId);
        if (!existing) throw new HttpError(404, "Record envelope not found.");
        if (existing.patient.toLowerCase() !== signer.toLowerCase()) {
          throw new HttpError(403, "Only the patient can crypto-shred this record.");
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
        sendJson(200, { shredded: true, unpinnedFromPinata });
        return;
      }

      // 6. Server-side Pinata upload proxy (PINATA_JWT never reaches the browser), with quotas
      if (req.method === "POST" && pathname === "/api/storage/pin") {
        const contentType = req.headers["content-type"] ?? "";
        if (!contentType.includes("multipart/form-data")) {
          throw new HttpError(400, "Expected multipart/form-data payload.");
        }

        const rawBody = await readRawBody(req, MAX_BODY_BYTES);
        const formData = await new Response(new Uint8Array(rawBody), {
          headers: { "content-type": contentType },
        }).formData();

        const file = formData.get("file");
        const address = formData.get("address");
        const nonce = formData.get("nonce");
        const signature = formData.get("signature");
        const fileName = formData.get("fileName");
        if (!(file instanceof Blob) || typeof address !== "string" || typeof nonce !== "string" || typeof signature !== "string") {
          throw new HttpError(400, "Missing required fields: file, address, nonce, signature.");
        }

        const signer = await auth.verifyAndConsume({
          action: "PIN_BLOB",
          address,
          nonce,
          signature: signature as `0x${string}`,
        });

        const usage = pinCounter.hit(signer.toLowerCase(), file.size);
        if (usage.count > pinQuota.maxPins || usage.bytes > pinQuota.maxBytes) {
          throw new HttpError(429, "Upload quota exceeded for this wallet. Try again later.");
        }

        const encryptedBytes = new Uint8Array(await file.arrayBuffer());
        if (options.pinataJwt) {
          const pinned = await uploadEncryptedBlobToPinata(encryptedBytes, {
            jwt: options.pinataJwt,
            fileName: typeof fileName === "string" ? fileName.slice(0, 120) : undefined,
            metadata: { app: "SynapseQ", mode: "gateway-proxy" },
          });
          sendJson(201, { cid: pinned.cid, provider: "pinata-ipfs", size: pinned.size });
          return;
        }

        const localCid = options.store.putLocalBlob(encryptedBytes);
        sendJson(201, { cid: localCid, provider: "gateway-local", size: encryptedBytes.length });
        return;
      }

      // 7. Gateway-local encrypted blobs: only with a single-use token issued by a release
      const blobMatch = /^\/api\/storage\/blobs\/(bafy-gw-[a-f0-9]{32})$/.exec(pathname);
      if (req.method === "GET" && blobMatch) {
        const cid = blobMatch[1];
        const token = url.searchParams.get("token") ?? "";
        if (!options.store.consumeBlobToken(cid, token)) {
          throw new HttpError(401, "A valid single-use download token is required (obtain it via release).");
        }
        const bytes = options.store.getLocalBlob(cid);
        if (!bytes) throw new HttpError(404, "Encrypted blob not found (or shredded).");
        res.writeHead(200, { "Content-Type": "application/octet-stream", ...corsHeaders });
        res.end(Buffer.from(bytes));
        return;
      }

      throw new HttpError(404, "Endpoint not found.");
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(err.status, { error: err.message });
      } else if (err instanceof AuthError) {
        sendJson(err.status, { error: err.message });
      } else if (err instanceof ChainUnavailableError) {
        sendJson(503, { error: err.message });
      } else {
        console.error("[gateway] unexpected error:", err);
        sendJson(500, { error: "Internal gateway error." });
      }
    }
  });
}

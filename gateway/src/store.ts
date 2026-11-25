import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface StoredEnvelopeEntry {
  readonly recordId: `0x${string}`;
  readonly patient: `0x${string}`;
  readonly ipfsCID: string;
  readonly encryptedKeyEnvelope: `0x${string}`;
  readonly contentHash: `0x${string}`;
  readonly storedAt: number;
}

/**
 * Off-chain blind custodian for ML-KEM-1024 key envelopes and encrypted blob pointers.
 * Never stores plaintext files or private keys; supports permanent Crypto-Shredding.
 */
const BLOB_TOKEN_TTL_MS = 5 * 60_000;

export class EnvelopeVaultStore {
  private readonly entries = new Map<string, StoredEnvelopeEntry>();
  private readonly blobTokens = new Map<string, { cid: string; expiresAt: number }>();
  private readonly filePath?: string;
  private readonly blobsDir?: string;

  constructor(dataDir?: string) {
    if (dataDir) {
      this.filePath = join(dataDir, "envelopes.json");
      this.blobsDir = join(dataDir, "blobs");
      mkdirSync(this.blobsDir, { recursive: true });
      this.loadFromDisk();
    }
  }

  public put(entry: StoredEnvelopeEntry): void {
    this.entries.set(entry.recordId.toLowerCase(), entry);
    this.persistToDisk();
  }

  public get(recordId: string): StoredEnvelopeEntry | undefined {
    return this.entries.get(recordId.toLowerCase());
  }

  /** Permanently removes the envelope from memory and disk (Crypto-Shredding). */
  public shred(recordId: string): StoredEnvelopeEntry | undefined {
    const key = recordId.toLowerCase();
    const existing = this.entries.get(key);
    if (!existing) return undefined;

    this.entries.delete(key);
    this.persistToDisk();

    if (this.blobsDir && existing.ipfsCID.startsWith("bafy-gw-")) {
      const localPath = join(this.blobsDir, `${existing.ipfsCID}.enc`);
      if (existsSync(localPath)) {
        unlinkSync(localPath);
      }
    }

    return existing;
  }

  /** Issues a single-use, short-lived token that authorizes one download of a local blob. */
  public issueBlobToken(cid: string): string {
    const now = Date.now();
    for (const [key, entry] of this.blobTokens) {
      if (now > entry.expiresAt) this.blobTokens.delete(key);
    }
    const token = randomBytes(24).toString("hex");
    this.blobTokens.set(token, { cid, expiresAt: now + BLOB_TOKEN_TTL_MS });
    return token;
  }

  /** Consumes a blob token; returns true only if it was issued for this CID and is unexpired. */
  public consumeBlobToken(cid: string, token: string): boolean {
    const entry = this.blobTokens.get(token);
    if (!entry) return false;
    this.blobTokens.delete(token);
    return entry.cid === cid && Date.now() <= entry.expiresAt;
  }

  /** Stores an encrypted binary blob on local gateway disk when PINATA_JWT is not configured. */
  public putLocalBlob(bytes: Uint8Array): string {
    const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
    const cid = `bafy-gw-${digest}`;
    if (this.blobsDir) {
      mkdirSync(this.blobsDir, { recursive: true });
      writeFileSync(join(this.blobsDir, `${cid}.enc`), bytes);
    }
    return cid;
  }

  public getLocalBlob(cid: string): Uint8Array | undefined {
    if (!this.blobsDir || !/^bafy-gw-[a-f0-9]{32}$/.test(cid)) {
      return undefined;
    }
    const localPath = join(this.blobsDir, `${cid}.enc`);
    if (!existsSync(localPath)) {
      return undefined;
    }
    return new Uint8Array(readFileSync(localPath));
  }

  private loadFromDisk(): void {
    if (!this.filePath || !existsSync(this.filePath)) return;
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf8")) as StoredEnvelopeEntry[];
      for (const entry of raw) {
        this.entries.set(entry.recordId.toLowerCase(), entry);
      }
    } catch {
      // Ignore corrupt/empty store file on startup
    }
  }

  private persistToDisk(): void {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify([...this.entries.values()], null, 2), "utf8");
  }
}

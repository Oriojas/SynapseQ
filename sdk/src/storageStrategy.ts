import {
  buildDaBlob,
  DEFAULT_RDK_PARAMS,
  isDaBackendAvailable,
  type DaBlob,
} from "@qorechain/rdk";
import { computeShake256 } from "./pqc.js";
import { fetchEncryptedBlobFromIpfs, uploadEncryptedBlobToPinata } from "./storage.js";

export type StorageProviderId = "pinata-ipfs" | "qorechain-da" | "memory-fallback";
export type StorageMode = "auto" | StorageProviderId;
export type DataDomain = "CLINICAL" | "BIONIC_TELEMETRY";
export type RetentionPolicy = "long-term" | "ephemeral";

export interface StorageContext {
  domain: DataDomain;
  retention: RetentionPolicy;
  fileName?: string;
  metadata?: Record<string, string>;
  /** Override automatic routing with a specific backend. Defaults to "auto". */
  preferredMode?: StorageMode;
}

export interface StorageReceipt {
  provider: StorageProviderId;
  /** On-chain storable reference (IPFS CID or qorechain-da://<dataHash>) */
  reference: string;
  size: number;
  ephemeral: boolean;
  /** Human-readable explanation of why this storage layer was selected */
  reason: string;
  daBlob?: DaBlob;
  daDataHash?: string;
}

export interface StorageStrategy {
  readonly id: StorageProviderId;
  canHandle(blob: Uint8Array, context: StorageContext): boolean;
  store(blob: Uint8Array, context: StorageContext): Promise<StorageReceipt>;
  retrieve?(reference: string): Promise<Uint8Array>;
}

/**
 * Long-term decentralized storage on Pinata IPFS (ideal for 50-70yr clinical & HBOM archives).
 */
export class PinataIpfsStrategy implements StorageStrategy {
  public readonly id: StorageProviderId = "pinata-ipfs";
  private readonly jwt: string;
  private readonly gatewayUrl?: string;

  constructor(jwt: string, gatewayUrl?: string) {
    this.jwt = jwt;
    this.gatewayUrl = gatewayUrl;
  }

  public canHandle(): boolean {
    return this.jwt.length > 0;
  }

  public async store(blob: Uint8Array, context: StorageContext): Promise<StorageReceipt> {
    const res = await uploadEncryptedBlobToPinata(blob, {
      jwt: this.jwt,
      fileName: context.fileName,
      metadata: {
        app: "SynapseQ",
        domain: context.domain,
        retention: context.retention,
        ...context.metadata,
      },
    });

    return {
      provider: this.id,
      reference: res.cid,
      size: res.size,
      ephemeral: false,
      reason: "Routed to Pinata IPFS for persistent long-term encrypted storage.",
    };
  }

  public async retrieve(reference: string): Promise<Uint8Array> {
    return fetchEncryptedBlobFromIpfs(reference, this.gatewayUrl);
  }
}

/**
 * QoreChain x/rdk Native DA Router strategy for ephemeral bionic telemetry (auto-pruned by EndBlocker).
 */
export class QoreChainDaStrategy implements StorageStrategy {
  public readonly id: StorageProviderId = "qorechain-da";
  private readonly maxDaBlobSize: number;

  constructor(maxDaBlobSize: number = DEFAULT_RDK_PARAMS.maxDaBlobSize) {
    this.maxDaBlobSize = maxDaBlobSize;
  }

  public canHandle(blob: Uint8Array, context: StorageContext): boolean {
    if (!isDaBackendAvailable("native")) return false;
    if (blob.length > this.maxDaBlobSize) return false;
    return context.preferredMode === "qorechain-da" || context.retention === "ephemeral";
  }

  public async store(blob: Uint8Array): Promise<StorageReceipt> {
    const daBlob = buildDaBlob({
      data: blob,
      maxBlobSize: this.maxDaBlobSize,
    });

    return {
      provider: this.id,
      reference: `qorechain-da://${daBlob.dataHash}`,
      size: blob.length,
      ephemeral: true,
      daBlob,
      daDataHash: daBlob.dataHash,
      reason: `Routed to QoreChain Native DA (<= ${this.maxDaBlobSize} bytes, auto-pruned ephemeral telemetry).`,
    };
  }
}

/**
 * Browser-safe in-memory fallback strategy for local development, tests, and offline resilience.
 */
export class MemoryFallbackStrategy implements StorageStrategy {
  public readonly id: StorageProviderId = "memory-fallback";
  private readonly storeMap = new Map<string, Uint8Array>();

  public canHandle(): boolean {
    return true;
  }

  public async store(blob: Uint8Array): Promise<StorageReceipt> {
    const digest = computeShake256(blob).slice(2, 34);
    const reference = `bafy-synapseq-${digest}`;
    this.storeMap.set(reference, new Uint8Array(blob));

    return {
      provider: this.id,
      reference,
      size: blob.length,
      ephemeral: true,
      reason: "Stored in browser-safe memory fallback (no external Pinata JWT configured).",
    };
  }

  public async retrieve(reference: string): Promise<Uint8Array> {
    const found = this.storeMap.get(reference);
    if (!found) {
      throw new Error(`Blob not found in memory fallback for reference: ${reference}`);
    }
    return new Uint8Array(found);
  }
}

export interface StorageRouterOptions {
  pinataJwt?: string;
  ipfsGatewayUrl?: string;
  maxDaBlobSize?: number;
  /** Fall back to MemoryFallbackStrategy if external provider fails or is unconfigured. Default: true */
  allowFallback?: boolean;
}

export interface StrategyDecision {
  strategy: StorageStrategy;
  reason: string;
}

/**
 * Smart storage router that selects the optimal encrypted storage backend based on
 * clinical vs. bionic telemetry domain, retention policy, and payload size.
 */
export class SynapseStorageRouter {
  private readonly pinata?: PinataIpfsStrategy;
  private readonly qoreDa: QoreChainDaStrategy;
  private readonly fallback: MemoryFallbackStrategy;
  private readonly allowFallback: boolean;
  private readonly maxDaBlobSize: number;

  constructor(options: StorageRouterOptions = {}) {
    this.maxDaBlobSize = options.maxDaBlobSize ?? DEFAULT_RDK_PARAMS.maxDaBlobSize;
    this.allowFallback = options.allowFallback ?? true;
    if (options.pinataJwt) {
      this.pinata = new PinataIpfsStrategy(options.pinataJwt, options.ipfsGatewayUrl);
    }
    this.qoreDa = new QoreChainDaStrategy(this.maxDaBlobSize);
    this.fallback = new MemoryFallbackStrategy();
  }

  /**
   * Pure decision helper so UIs can preview which storage backend will be used and why.
   */
  public resolveStrategy(blob: Uint8Array, context: StorageContext): StrategyDecision {
    const mode = context.preferredMode ?? "auto";

    if (mode === "qorechain-da") {
      if (!this.qoreDa.canHandle(blob, context)) {
        throw new Error(
          `QoreChain Native DA cannot handle payload (${blob.length} bytes > ${this.maxDaBlobSize} limit or backend unavailable).`
        );
      }
      return {
        strategy: this.qoreDa,
        reason: "Explicitly routed to QoreChain Native DA Router.",
      };
    }

    if (mode === "pinata-ipfs") {
      if (!this.pinata) {
        throw new Error("Pinata IPFS mode requested but no PINATA_JWT was configured.");
      }
      return {
        strategy: this.pinata,
        reason: "Explicitly routed to Pinata IPFS.",
      };
    }

    if (mode === "memory-fallback") {
      return {
        strategy: this.fallback,
        reason: "Explicitly routed to local memory fallback.",
      };
    }

    // Automatic policy routing:
    // 1) Ephemeral bionic telemetry within DA limit -> QoreChain Native DA (auto-pruned)
    if (
      context.domain === "BIONIC_TELEMETRY" &&
      context.retention === "ephemeral" &&
      this.qoreDa.canHandle(blob, context)
    ) {
      return {
        strategy: this.qoreDa,
        reason: `Auto-selected QoreChain Native DA for ephemeral bionic telemetry (${blob.length} bytes <= ${this.maxDaBlobSize}).`,
      };
    }

    // 2) Long-term clinical records or payloads > 2 MiB -> Pinata IPFS
    if (this.pinata) {
      return {
        strategy: this.pinata,
        reason: "Auto-selected Pinata IPFS for long-term persistence.",
      };
    }

    // 3) Graceful fallback when no Pinata JWT is configured
    if (this.allowFallback) {
      return {
        strategy: this.fallback,
        reason: "Pinata JWT not configured; using browser-safe memory fallback.",
      };
    }

    throw new Error("No available storage strategy matched the routing policy.");
  }

  /**
   * Stores an already-encrypted blob using the resolved strategy, with optional fallback resilience.
   */
  public async store(blob: Uint8Array, context: StorageContext): Promise<StorageReceipt> {
    const { strategy, reason } = this.resolveStrategy(blob, context);
    try {
      const receipt = await strategy.store(blob, context);
      return { ...receipt, reason };
    } catch (err) {
      if (!this.allowFallback || strategy.id === this.fallback.id) {
        throw err;
      }
      const fallbackReceipt = await this.fallback.store(blob);
      return {
        ...fallbackReceipt,
        reason: `Fallback triggered after ${strategy.id} error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Retrieves an encrypted blob by reference (memory fallback or IPFS gateway).
   */
  public async retrieve(reference: string): Promise<Uint8Array> {
    if (reference.startsWith("bafy-synapseq-")) {
      return this.fallback.retrieve(reference);
    }
    if (reference.startsWith("qorechain-da://")) {
      throw new Error(
        "QoreChain DA blobs are retrieved from the host chain DA layer via RdkClient."
      );
    }
    if (this.pinata) {
      return this.pinata.retrieve(reference);
    }
    return fetchEncryptedBlobFromIpfs(reference);
  }
}

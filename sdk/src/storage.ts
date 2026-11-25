import { bytesToHex, hexToBytes } from "viem";
import { computeShake256 } from "./pqc.js";

/**
 * Browser-safe encrypted blob storage adapters for SynapseQ.
 * Supports Pinata IPFS pinning (production/hackathon demo), custom IPFS gateways,
 * and automatic browser/Node local fallback.
 * All payloads MUST be encrypted client-side (AES-256-GCM) before calling these functions.
 */

export interface PinataUploadConfig {
  /** Pinata JWT token (from https://app.pinata.cloud/developers/api-keys) */
  jwt: string;
  /** Optional custom Pinata API endpoint */
  apiUrl?: string;
  /** Optional metadata name shown in Pinata dashboard */
  fileName?: string;
  /** Optional key-value metadata (never include sensitive medical plaintext!) */
  metadata?: Record<string, string>;
}

export interface PinataUploadResult {
  cid: string;
  size: number;
  timestamp: string;
}

export interface StorageConfig {
  pinataJwt?: string;
  ipfsGatewayUrl?: string;
  fileName?: string;
  metadata?: Record<string, string>;
}

const DEFAULT_PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const DEFAULT_IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

const memoryBlobCache = new Map<string, Uint8Array>();

/**
 * Uploads an already-encrypted binary blob (.enc) to Pinata IPFS.
 * Returns the resulting IPFS CID.
 */
export async function uploadEncryptedBlobToPinata(
  encryptedBlob: Uint8Array,
  config: PinataUploadConfig
): Promise<PinataUploadResult> {
  if (!config.jwt) {
    throw new Error("Pinata JWT is required to upload to IPFS.");
  }

  const formData = new FormData();
  const fileName = config.fileName ?? `synapseq-${Date.now()}.enc`;
  const fileBlob = new Blob([encryptedBlob as BlobPart], {
    type: "application/octet-stream",
  });
  formData.append("file", fileBlob, fileName);

  const pinataMetadata: { name: string; keyvalues?: Record<string, string> } = {
    name: fileName,
  };
  if (config.metadata) {
    pinataMetadata.keyvalues = config.metadata;
  }
  formData.append("pinataMetadata", JSON.stringify(pinataMetadata));

  const response = await fetch(config.apiUrl ?? DEFAULT_PINATA_PIN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.jwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Pinata upload failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    IpfsHash: string;
    PinSize: number;
    Timestamp: string;
  };

  memoryBlobCache.set(data.IpfsHash, encryptedBlob);

  return {
    cid: data.IpfsHash,
    size: data.PinSize,
    timestamp: data.Timestamp,
  };
}

/**
 * Downloads an encrypted binary blob from an IPFS gateway by CID.
 */
export async function fetchEncryptedBlobFromIpfs(
  cid: string,
  gatewayUrl: string = DEFAULT_IPFS_GATEWAY
): Promise<Uint8Array> {
  const normalizedGateway = gatewayUrl.replace(/\/+$/, "");
  const cleanCid = cid.replace(/^ipfs:\/\//, "");
  const url = normalizedGateway.endsWith("/ipfs")
    ? `${normalizedGateway}/${cleanCid}`
    : `${normalizedGateway}/ipfs/${cleanCid}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch CID ${cleanCid} from IPFS (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  memoryBlobCache.set(cleanCid, bytes);
  return bytes;
}

/**
 * Unpins an encrypted blob from Pinata IPFS (supports Right to Erasure / Ley 1581 / GDPR).
 * Intended to be called from a trusted backend/gateway holding PINATA_JWT.
 */
export async function unpinFromPinata(cid: string, jwt: string): Promise<boolean> {
  if (!jwt) {
    throw new Error("Pinata JWT is required to unpin a CID.");
  }
  const cleanCid = cid.replace(/^ipfs:\/\//, "");
  const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${encodeURIComponent(cleanCid)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });
  if (response.status === 404) {
    return false;
  }
  if (!response.ok) {
    throw new Error(`Pinata unpin failed (${response.status}): ${await response.text()}`);
  }
  memoryBlobCache.delete(cleanCid);
  return true;
}

/**
 * Unified helper that uploads to Pinata IPFS if a JWT is provided/configured (server-side only),
 * or falls back to an in-memory cache (plus browser localStorage) for local development.
 * Browsers should pin through the Key-Release Gateway instead (pinEncryptedBlobViaGateway).
 */
export async function uploadEncryptedBlob(
  blob: Uint8Array,
  config?: StorageConfig
): Promise<string> {
  const digest = computeShake256(blob).slice(2, 34);
  const pinataJwt =
    config?.pinataJwt ||
    (typeof process !== "undefined" ? process.env?.PINATA_JWT : undefined);

  if (pinataJwt && pinataJwt.trim().length > 0) {
    const res = await uploadEncryptedBlobToPinata(blob, {
      jwt: pinataJwt,
      fileName: config?.fileName ?? `synapseq-${digest}.enc`,
      metadata: config?.metadata,
    });
    return res.cid;
  }

  const cid = `bafy-synapseq-${digest}`;
  memoryBlobCache.set(cid, blob);

  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    window.localStorage.setItem(`synapseq_ipfs_${cid}`, bytesToHex(blob));
  }

  return cid;
}

/**
 * Unified helper that retrieves an encrypted blob from cache, browser localStorage, or IPFS gateway.
 */
export async function fetchEncryptedBlob(
  cid: string,
  config?: StorageConfig
): Promise<Uint8Array> {
  const cached = memoryBlobCache.get(cid);
  if (cached) {
    return cached;
  }

  if (cid.startsWith("bafy-synapseq-")) {
    if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      const hex = window.localStorage.getItem(`synapseq_ipfs_${cid}`);
      if (!hex) {
        throw new Error(`Encrypted blob not found in browser storage for CID: ${cid}`);
      }
      const bytes = hexToBytes(hex as `0x${string}`);
      memoryBlobCache.set(cid, bytes);
      return bytes;
    }

    throw new Error(`Encrypted blob not found in memory cache for CID: ${cid}`);
  }

  const gatewayUrl =
    config?.ipfsGatewayUrl ||
    (typeof process !== "undefined" ? process.env?.IPFS_GATEWAY_URL : undefined) ||
    DEFAULT_IPFS_GATEWAY;

  return fetchEncryptedBlobFromIpfs(cid, gatewayUrl);
}

/**
 * Browser-safe encrypted blob storage adapters for SynapseQ.
 * Supports Pinata IPFS pinning (production/hackathon demo) and custom IPFS gateways.
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

const DEFAULT_PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const DEFAULT_IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

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
  const url = `${normalizedGateway}/${cleanCid}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch CID ${cleanCid} from IPFS (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

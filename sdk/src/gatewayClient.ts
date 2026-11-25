/**
 * Browser-safe client for the SynapseQ Key-Release & Pinata Proxy Gateway.
 * Keeps ML-KEM-1024 envelopes and storage CIDs out of public EVM storage/calldata (only their
 * hashes go on-chain) and keeps PINATA_JWT out of browser bundles.
 *
 * Trust model: the gateway operator enforces release (it checks the wallet signature and the live
 * on-chain `isAccessValid`). It never sees plaintext or private keys. A key that was already
 * released cannot be recalled by a later revocation.
 */
import { encodeAbiParameters, keccak256 } from "viem";

export type GatewayAuthAction =
  | "STORE_ENVELOPE"
  | "RELEASE_ENVELOPE"
  | "SHRED_RECORD"
  | "PIN_BLOB";

export interface NonceResponse {
  readonly nonce: string;
  readonly expiresAt: number;
  /** Chain ID the gateway enforces; must be included in the signed message. */
  readonly chainId: number;
}

export interface ReleasedEnvelopeResponse {
  readonly recordId: `0x${string}`;
  readonly ipfsCID: string;
  readonly encryptedKeyEnvelope: `0x${string}`;
  readonly contentHash: `0x${string}`;
  readonly validUntil: string;
  /** Short-lived single-use token to download a gateway-local blob (absent for Pinata CIDs). */
  readonly blobToken?: string;
}

/** recordId = keccak256(abi.encode(patient, salt)), identical to the contract's computeRecordId. */
export function computeRecordId(patient: `0x${string}`, salt: `0x${string}`): `0x${string}` {
  return keccak256(
    encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [patient, salt])
  );
}

export interface GatewayPinResponse {
  readonly cid: string;
  readonly provider: "pinata-ipfs" | "gateway-local";
  readonly size: number;
}

/**
 * Deterministic challenge message signed by the wallet (patient or specialist) to prove key
 * possession before any gateway write, key release, or crypto-shredding. It is bound to the
 * action, wallet, single-use nonce, chain ID and (when relevant) the recordId.
 */
export function buildGatewayAuthMessage(params: {
  readonly action: GatewayAuthAction;
  readonly address: `0x${string}`;
  readonly nonce: string;
  readonly chainId: number;
  readonly recordId?: `0x${string}`;
}): string {
  const lines = [
    "SynapseQ Key-Release Gateway",
    `Action: ${params.action}`,
    `Address: ${params.address.toLowerCase()}`,
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
  ];
  if (params.recordId) {
    lines.push(`RecordId: ${params.recordId.toLowerCase()}`);
  }
  return lines.join("\n");
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/** Requests a single-use authentication nonce (60s TTL) for a wallet address. */
export async function requestGatewayNonce(
  gatewayUrl: string,
  address: `0x${string}`
): Promise<NonceResponse> {
  const url = `${normalizeBaseUrl(gatewayUrl)}/api/auth/nonce?address=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to obtain gateway nonce (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as NonceResponse;
}

/**
 * Downloads a gateway-local encrypted blob using the single-use token returned by a release.
 */
export async function downloadBlobViaGateway(
  gatewayUrl: string,
  cid: string,
  blobToken: string
): Promise<Uint8Array> {
  const res = await fetch(
    `${normalizeBaseUrl(gatewayUrl)}/api/storage/blobs/${encodeURIComponent(cid)}?token=${encodeURIComponent(blobToken)}`
  );
  if (!res.ok) {
    throw new Error(`Blob download denied (${res.status}): ${await res.text()}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/** Stores an ML-KEM-1024 envelope and IPFS CID off-chain in the Key-Release Gateway. */
export async function storeProtectedEnvelope(
  gatewayUrl: string,
  payload: {
    readonly recordId: `0x${string}`;
    readonly patient: `0x${string}`;
    readonly ipfsCID: string;
    readonly encryptedKeyEnvelope: `0x${string}`;
    readonly contentHash: `0x${string}`;
    readonly nonce: string;
    readonly signature: `0x${string}`;
  }
): Promise<{ stored: true; recordId: `0x${string}` }> {
  const res = await fetch(`${normalizeBaseUrl(gatewayUrl)}/api/envelopes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to store protected envelope (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as { stored: true; recordId: `0x${string}` };
}

/**
 * Requests conditional release of a protected ML-KEM-1024 envelope.
 * The gateway verifies both the specialist's wallet signature and live on-chain `isAccessValid(recordId)`.
 */
export async function releaseProtectedEnvelope(
  gatewayUrl: string,
  params: {
    readonly recordId: `0x${string}`;
    readonly specialist: `0x${string}`;
    readonly nonce: string;
    readonly signature: `0x${string}`;
  }
): Promise<ReleasedEnvelopeResponse> {
  const res = await fetch(
    `${normalizeBaseUrl(gatewayUrl)}/api/envelopes/${encodeURIComponent(params.recordId)}/release`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        specialist: params.specialist,
        nonce: params.nonce,
        signature: params.signature,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Key release denied (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as ReleasedEnvelopeResponse;
}

/**
 * Exercises the patient's Right to Erasure (Ley 1581 / GDPR):
 * destroys the stored ML-KEM-1024 envelope (Crypto-Shredding) and unpins the encrypted blob from Pinata.
 */
export async function shredProtectedRecord(
  gatewayUrl: string,
  params: {
    readonly recordId: `0x${string}`;
    readonly patient: `0x${string}`;
    readonly nonce: string;
    readonly signature: `0x${string}`;
  }
): Promise<{ shredded: true; unpinnedFromPinata: boolean }> {
  const res = await fetch(
    `${normalizeBaseUrl(gatewayUrl)}/api/envelopes/${encodeURIComponent(params.recordId)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient: params.patient,
        nonce: params.nonce,
        signature: params.signature,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Crypto-shredding failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as { shredded: true; unpinnedFromPinata: boolean };
}

/**
 * Uploads an already-encrypted binary blob (.enc) via the Gateway so PINATA_JWT never enters the browser.
 */
export async function pinEncryptedBlobViaGateway(
  gatewayUrl: string,
  params: {
    readonly encryptedBlob: Uint8Array;
    readonly address: `0x${string}`;
    readonly nonce: string;
    readonly signature: `0x${string}`;
    readonly fileName?: string;
  }
): Promise<GatewayPinResponse> {
  const formData = new FormData();
  const fileName = params.fileName ?? `synapseq-${Date.now()}.enc`;
  formData.append(
    "file",
    new Blob([params.encryptedBlob as BlobPart], { type: "application/octet-stream" }),
    fileName
  );
  formData.append("address", params.address);
  formData.append("nonce", params.nonce);
  formData.append("signature", params.signature);
  formData.append("fileName", fileName);

  const res = await fetch(`${normalizeBaseUrl(gatewayUrl)}/api/storage/pin`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Gateway Pinata upload failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as GatewayPinResponse;
}

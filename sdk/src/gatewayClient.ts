/**
 * Browser-safe client for the SynapseQ Zero-Trust Key-Release & Pinata Proxy Gateway.
 * Ensures ML-KEM-1024 envelopes and IPFS CIDs are never exposed in public EVM storage/calldata,
 * and ensures PINATA_JWT never leaks into browser bundles.
 */

export type GatewayAuthAction =
  | "STORE_ENVELOPE"
  | "RELEASE_ENVELOPE"
  | "SHRED_RECORD"
  | "PIN_BLOB";

export interface NonceResponse {
  readonly nonce: string;
  readonly expiresAt: number;
}

export interface ReleasedEnvelopeResponse {
  readonly recordId: `0x${string}`;
  readonly ipfsCID: string;
  readonly encryptedKeyEnvelope: `0x${string}`;
  readonly contentHash: `0x${string}`;
  readonly validUntil: string;
}

export interface GatewayPinResponse {
  readonly cid: string;
  readonly provider: "pinata-ipfs" | "gateway-local";
  readonly size: number;
}

/**
 * Deterministic SIWE-style challenge message signed by the wallet (patient or specialist)
 * to prove real key possession before any gateway write, key release, or crypto-shredding.
 */
export function buildGatewayAuthMessage(params: {
  readonly action: GatewayAuthAction;
  readonly address: `0x${string}`;
  readonly nonce: string;
  readonly recordId?: `0x${string}`;
}): string {
  const lines = [
    "SynapseQ Zero-Trust Key-Release Gateway",
    `Action: ${params.action}`,
    `Address: ${params.address.toLowerCase()}`,
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

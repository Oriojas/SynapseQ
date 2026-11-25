import { bytesToHex, hexToBytes } from "viem";
import { computeShake256 } from "./pqc.js";

export interface StorageConfig {
  pinataJwt?: string;
  ipfsGatewayUrl?: string;
}

const memoryBlobCache = new Map<string, Uint8Array>();

export async function uploadEncryptedBlob(
  blob: Uint8Array,
  config?: StorageConfig
): Promise<string> {
  const digest = computeShake256(blob).slice(2, 34);
  const pinataJwt =
    config?.pinataJwt ||
    (typeof process !== "undefined" ? process.env?.PINATA_JWT : undefined);

  if (pinataJwt && pinataJwt.trim().length > 0) {
    const uploadUrl =
      (typeof process !== "undefined" ? process.env?.PINATA_UPLOAD_URL : undefined) ||
      "https://api.pinata.cloud/pinning/pinFileToIPFS";

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([blob as BlobPart], { type: "application/octet-stream" }),
      `synapseq-${digest}.enc`
    );

    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Pinata IPFS upload failed (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as { IpfsHash: string };
    memoryBlobCache.set(data.IpfsHash, blob);
    return data.IpfsHash;
  }

  const cid = `bafy-synapseq-${digest}`;
  memoryBlobCache.set(cid, blob);

  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    window.localStorage.setItem(`synapseq_ipfs_${cid}`, bytesToHex(blob));
  } else if (typeof window === "undefined") {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const localIpfsDir = join(process.cwd(), ".local-ipfs");
    mkdirSync(localIpfsDir, { recursive: true });
    writeFileSync(join(localIpfsDir, `${cid}.enc`), blob);
  }

  return cid;
}

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

    if (typeof window === "undefined") {
      const { readFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      const filePath = join(process.cwd(), ".local-ipfs", `${cid}.enc`);
      const bytes = new Uint8Array(readFileSync(filePath));
      memoryBlobCache.set(cid, bytes);
      return bytes;
    }
  }

  const gatewayUrl = (
    config?.ipfsGatewayUrl ||
    (typeof process !== "undefined" ? process.env?.IPFS_GATEWAY_URL : undefined) ||
    "https://gateway.pinata.cloud"
  ).replace(/\/+$/, "");

  const res = await fetch(`${gatewayUrl}/ipfs/${cid}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch IPFS CID ${cid} (${res.status})`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  memoryBlobCache.set(cid, bytes);
  return bytes;
}

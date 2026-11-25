/**
 * Browser-safe Shamir Secret Sharing over GF(256) (AES irreducible polynomial 0x11b).
 * Decouples the user's ML-KEM-1024 master vault seed from their EVM wallet so losing
 * a wallet never results in permanent loss of clinical or HBOM records.
 *
 * Recommended SynapseQ profile: 2-of-3 recovery
 *   Share 1: User device (Passkey / local keychain)
 *   Share 2: Offline QR / paper backup kit
 *   Share 3: Trusted guardian (family member / clinic custodian)
 */

import { bytesToHex, hexToBytes } from "viem";

export interface SecretShare {
  /** 1-based x-coordinate (1..255) */
  readonly index: number;
  /** Share payload bytes (same length as the original secret) */
  readonly data: Uint8Array;
}

function getWebCrypto(): Crypto {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Web Crypto API (crypto.getRandomValues) is required for Shamir secret sharing.");
  }
  return globalThis.crypto;
}

/** Multiplies two bytes in GF(256) using the AES irreducible polynomial x^8 + x^4 + x^3 + x + 1 (0x11b). */
function gfMul(a: number, b: number): number {
  let result = 0;
  let x = a;
  let y = b;
  for (let i = 0; i < 8; i++) {
    if ((y & 1) !== 0) {
      result ^= x;
    }
    const highBit = x & 0x80;
    x = (x << 1) & 0xff;
    if (highBit !== 0) {
      x ^= 0x1b;
    }
    y >>= 1;
  }
  return result;
}

/** Computes a^exp in GF(256). */
function gfPow(base: number, exp: number): number {
  let result = 1;
  let b = base;
  let e = exp;
  while (e > 0) {
    if ((e & 1) !== 0) {
      result = gfMul(result, b);
    }
    b = gfMul(b, b);
    e >>= 1;
  }
  return result;
}

/** Multiplicative inverse in GF(256) via Fermat's little theorem: a^-1 = a^254. */
function gfInv(a: number): number {
  if (a === 0) {
    throw new Error("Division by zero in GF(256).");
  }
  return gfPow(a, 254);
}

/** Evaluates polynomial coeffs[0] + coeffs[1]*x + ... at x in GF(256). */
function evalPoly(coeffs: Uint8Array, x: number): number {
  let result = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = gfMul(result, x) ^ coeffs[i];
  }
  return result;
}

/**
 * Splits a secret (e.g., 32-byte ML-KEM-1024 master seed) into `totalShares` shares
 * such that any `threshold` shares reconstruct the exact secret, while fewer than
 * `threshold` shares reveal zero information.
 */
export function splitSecret(
  secret: Uint8Array,
  totalShares: number = 3,
  threshold: number = 2
): SecretShare[] {
  if (secret.length === 0) {
    throw new Error("Secret must not be empty.");
  }
  if (threshold < 2 || totalShares < threshold || totalShares > 255) {
    throw new Error("Invalid Shamir parameters: require 2 <= threshold <= totalShares <= 255.");
  }

  const webCrypto = getWebCrypto();
  const shares: SecretShare[] = Array.from({ length: totalShares }, (_, idx) => ({
    index: idx + 1,
    data: new Uint8Array(secret.length),
  }));

  const coeffs = new Uint8Array(threshold);
  const randomCoeffs = new Uint8Array(threshold - 1);

  for (let byteIdx = 0; byteIdx < secret.length; byteIdx++) {
    coeffs[0] = secret[byteIdx];
    webCrypto.getRandomValues(randomCoeffs);
    for (let c = 1; c < threshold; c++) {
      coeffs[c] = randomCoeffs[c - 1];
    }

    for (let s = 0; s < totalShares; s++) {
      shares[s].data[byteIdx] = evalPoly(coeffs, shares[s].index);
    }
  }

  coeffs.fill(0);
  randomCoeffs.fill(0);
  return shares;
}

/**
 * Reconstructs the original secret from `threshold` or more Shamir shares via
 * Lagrange interpolation at x = 0 in GF(256).
 */
export function combineShares(shares: readonly SecretShare[]): Uint8Array {
  if (shares.length < 2) {
    throw new Error("At least 2 shares are required to reconstruct a secret.");
  }

  const secretLength = shares[0].data.length;
  const seenIndices = new Set<number>();

  for (const share of shares) {
    if (share.index < 1 || share.index > 255) {
      throw new Error(`Invalid share index: ${share.index}`);
    }
    if (seenIndices.has(share.index)) {
      throw new Error(`Duplicate share index: ${share.index}`);
    }
    if (share.data.length !== secretLength) {
      throw new Error("All shares must have identical byte length.");
    }
    seenIndices.add(share.index);
  }

  const recovered = new Uint8Array(secretLength);

  // Precompute Lagrange basis coefficients L_i(0) for each share i
  const lagrangeAtZero = new Uint8Array(shares.length);
  for (let i = 0; i < shares.length; i++) {
    let numerator = 1;
    let denominator = 1;
    const xi = shares[i].index;

    for (let j = 0; j < shares.length; j++) {
      if (i === j) continue;
      const xj = shares[j].index;
      numerator = gfMul(numerator, xj);
      denominator = gfMul(denominator, xi ^ xj);
    }
    lagrangeAtZero[i] = gfMul(numerator, gfInv(denominator));
  }

  for (let byteIdx = 0; byteIdx < secretLength; byteIdx++) {
    let acc = 0;
    for (let i = 0; i < shares.length; i++) {
      acc ^= gfMul(shares[i].data[byteIdx], lagrangeAtZero[i]);
    }
    recovered[byteIdx] = acc;
  }

  return recovered;
}

/** Encodes a share into a compact QR/paper-friendly string: "synapseq-share-v1:<index>:<hex>" */
export function encodeRecoveryShare(share: SecretShare): string {
  return `synapseq-share-v1:${share.index}:${bytesToHex(share.data)}`;
}

/** Decodes a compact recovery share string back into a SecretShare. */
export function decodeRecoveryShare(encoded: string): SecretShare {
  const parts = encoded.trim().split(":");
  if (parts.length !== 3 || parts[0] !== "synapseq-share-v1") {
    throw new Error("Invalid SynapseQ recovery share format.");
  }
  const index = Number(parts[1]);
  if (!Number.isInteger(index) || index < 1 || index > 255) {
    throw new Error(`Invalid share index in recovery string: ${parts[1]}`);
  }
  const data = hexToBytes(parts[2] as `0x${string}`);
  return { index, data };
}

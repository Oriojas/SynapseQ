import { ml_kem1024 } from "@noble/post-quantum/ml-kem";
import { ml_dsa87 } from "@noble/post-quantum/ml-dsa";
import { shake256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes, keccak256 } from "viem";

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is required (use HTTPS or localhost).");
  }
  return globalThis.crypto;
}

const AES_KEY_BYTES = 32; // AES-256-GCM (Grover-resistant symmetric cipher)
const AES_IV_BYTES = 12;  // 96-bit standard GCM nonce
const ML_KEM_1024_CIPHERTEXT_BYTES = 1568; // NIST FIPS 203 ML-KEM-1024 ciphertext size

export interface KemKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface DsaKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface SealedDocumentResult {
  /** AES-256-GCM encrypted document bytes (iv || ciphertext+authTag) ready for IPFS */
  encryptedBlob: Uint8Array;
  /**
   * SHAKE-256 32-byte digest of the *encrypted* blob. Hashing the ciphertext (not the plaintext)
   * avoids a public "guess-and-confirm" oracle for low-entropy medical documents.
   */
  contentHash: `0x${string}`;
  /** keccak256 of the envelope: the on-chain commitment the gateway release is checked against */
  envelopeHash: `0x${string}`;
  /** ML-KEM-1024 sealed envelope (kemCiphertext || wrapIv || wrappedDek+authTag) */
  encryptedKeyEnvelope: `0x${string}`;
}

/**
 * Generates a NIST FIPS 203 ML-KEM-1024 key pair for post-quantum key encapsulation.
 */
export function generateKemKeyPair(): KemKeyPair {
  return ml_kem1024.keygen();
}

/**
 * Deterministically derives an ML-KEM-1024 key pair from a 64-byte seed.
 * Used to rebuild a specialist's key from a wallet signature (no secret key stored in the browser).
 */
export function deriveKemKeyPairFromSeed(seed: Uint8Array): KemKeyPair {
  const seed64 = seed.length === 64 ? seed : shake256(seed, { dkLen: 64 });
  return ml_kem1024.keygen(seed64);
}

/** Fixed message a wallet signs to derive its ML-KEM-1024 key (ECDSA RFC 6979 is deterministic). */
export const KEM_DERIVATION_MESSAGE =
  "SynapseQ ML-KEM-1024 key derivation v1\nSigning this does NOT authorize any transaction.";

/** Derives the ML-KEM-1024 key pair from the wallet's signature over KEM_DERIVATION_MESSAGE. */
export function deriveKemKeyPairFromSignature(signatureHex: `0x${string}`): KemKeyPair {
  return deriveKemKeyPairFromSeed(shake256(hexToBytes(signatureHex), { dkLen: 64 }));
}

/** keccak256 commitment of an envelope (matches the contract's `envelopeHash`). */
export function computeEnvelopeHash(envelopeHex: `0x${string}`): `0x${string}` {
  return keccak256(envelopeHex);
}

/**
 * Generates a NIST FIPS 204 ML-DSA-87 key pair for post-quantum digital signatures.
 */
export function generateDsaKeyPair(): DsaKeyPair {
  const seed = getCrypto().getRandomValues(new Uint8Array(32));
  return ml_dsa87.keygen(seed);
}

/**
 * Computes a 32-byte SHAKE-256 digest (QoreChain native hash primitive).
 */
export function computeShake256(data: Uint8Array): `0x${string}` {
  const digest = shake256(data, { dkLen: 32 });
  return bytesToHex(digest);
}

/**
 * Signs a bionic firmware image or medical attestation using ML-DSA-87 (FIPS 204).
 */
export function signMLDSA87(payload: Uint8Array, secretKey: Uint8Array): `0x${string}` {
  const signature = ml_dsa87.sign(secretKey, payload);
  return bytesToHex(signature);
}

/**
 * Verifies an ML-DSA-87 (FIPS 204) signature against a payload and public key.
 */
export function verifyMLDSA87(
  payload: Uint8Array,
  signatureHex: `0x${string}`,
  publicKey: Uint8Array
): boolean {
  return ml_dsa87.verify(publicKey, payload, hexToBytes(signatureHex));
}

async function aesGcmEncrypt(keyBytes: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const webCrypto = getCrypto();
  const iv = webCrypto.getRandomValues(new Uint8Array(AES_IV_BYTES));
  const cryptoKey = await webCrypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const cipherBuffer = await webCrypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    cryptoKey,
    plaintext as BufferSource
  );
  const cipherBytes = new Uint8Array(cipherBuffer);

  const output = new Uint8Array(AES_IV_BYTES + cipherBytes.length);
  output.set(iv, 0);
  output.set(cipherBytes, AES_IV_BYTES);
  return output;
}

async function aesGcmDecrypt(keyBytes: Uint8Array, payload: Uint8Array): Promise<Uint8Array> {
  const webCrypto = getCrypto();
  const iv = payload.subarray(0, AES_IV_BYTES);
  const ciphertext = payload.subarray(AES_IV_BYTES);
  const cryptoKey = await webCrypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const plainBuffer = await webCrypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    cryptoKey,
    ciphertext as BufferSource
  );
  return new Uint8Array(plainBuffer);
}

/**
 * Hybrid Post-Quantum Envelope Encryption:
 * 1) Computes SHAKE-256 integrity hash of the resulting ciphertext.
 * 2) Encrypts plaintext with a fresh random AES-256-GCM Data Encryption Key (DEK).
 * 3) Encapsulates a shared secret to the recipient's ML-KEM-1024 public key.
 * 4) Wraps the DEK with the ML-KEM shared secret into an on-chain compatible envelope.
 */
export async function encryptAndSealDocument(
  plaintext: Uint8Array,
  recipientKemPublicKey: Uint8Array
): Promise<SealedDocumentResult> {
  // Step 1: Encrypt the document payload with a fresh random 256-bit DEK
  const dek = getCrypto().getRandomValues(new Uint8Array(AES_KEY_BYTES));
  const encryptedBlob = await aesGcmEncrypt(dek, plaintext);

  // Step 2: ML-KEM-1024 encapsulation against the specialist's public key
  const { cipherText: kemCiphertext, sharedSecret } = ml_kem1024.encapsulate(
    recipientKemPublicKey
  );

  // Step 3: Wrap the DEK using the 32-byte ML-KEM shared secret
  const wrappedDek = await aesGcmEncrypt(sharedSecret, dek);

  // Step 4: Pack ML-KEM ciphertext + wrapped DEK into a single envelope
  const envelopeBytes = new Uint8Array(kemCiphertext.length + wrappedDek.length);
  envelopeBytes.set(kemCiphertext, 0);
  envelopeBytes.set(wrappedDek, kemCiphertext.length);

  const encryptedKeyEnvelope = bytesToHex(envelopeBytes);
  return {
    encryptedBlob,
    contentHash: computeShake256(encryptedBlob),
    encryptedKeyEnvelope,
    envelopeHash: computeEnvelopeHash(encryptedKeyEnvelope),
  };
}

/**
 * Hybrid Post-Quantum Decryption & Integrity Verification:
 * 0) Verifies SHAKE-256(ciphertext) against the on-chain contentHash BEFORE decrypting.
 * 1) Decapsulates the ML-KEM-1024 shared secret using the recipient's private key.
 * 2) Unwraps the AES-256-GCM DEK.
 * 3) Decrypts the encrypted document blob in memory.
 */
export async function unsealAndDecryptDocument(
  encryptedBlob: Uint8Array,
  encryptedKeyEnvelopeHex: `0x${string}`,
  recipientKemSecretKey: Uint8Array,
  expectedContentHash: `0x${string}`
): Promise<Uint8Array> {
  const actualHash = computeShake256(encryptedBlob);
  if (actualHash.toLowerCase() !== expectedContentHash.toLowerCase()) {
    throw new Error(
      `Integrity verification failed: expected ${expectedContentHash}, got ${actualHash}`
    );
  }

  const envelopeBytes = hexToBytes(encryptedKeyEnvelopeHex);
  const kemCiphertext = envelopeBytes.subarray(0, ML_KEM_1024_CIPHERTEXT_BYTES);
  const wrappedDek = envelopeBytes.subarray(ML_KEM_1024_CIPHERTEXT_BYTES);

  // Step 1: Decapsulate ML-KEM-1024 shared secret
  const sharedSecret = ml_kem1024.decapsulate(kemCiphertext, recipientKemSecretKey);

  // Step 2: Unwrap DEK
  const dek = await aesGcmDecrypt(sharedSecret, wrappedDek);

  // Step 3: Decrypt document blob in memory (AES-GCM tag authenticates the plaintext)
  const plaintext = await aesGcmDecrypt(dek, encryptedBlob);
  dek.fill(0);
  return plaintext;
}

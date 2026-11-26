import { ml_dsa87 } from "@noble/post-quantum/ml-dsa";
import { shake256 } from "@noble/hashes/sha3";
import {
  generateSealKeys,
  open as qoreSealOpen,
  seal as qoreSealSeal,
  sealKeysFromSeed,
  validateMlkemPublicKey,
  type SealKeyPair,
  type SealMode,
} from "@qorechain/qoreseal";
import { bytesToHex, hexToBytes, keccak256 } from "viem";

export {
  buildRegisterKemKeyMessage,
  buildRemoveKemKeyMessage,
  deriveSealKeys,
  envelopeFromText,
  envelopeToText,
  parseEnvelope,
  recipientOf,
  signRecipientCard,
  validateMlkemPublicKey,
  verifyRecipientCard,
  type ParsedEnvelope,
  type RecipientCard,
  type SealKeyPair,
  type SealMode,
  type SealRecipient,
} from "@qorechain/qoreseal";

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is required (use HTTPS or localhost).");
  }
  return globalThis.crypto;
}

const AES_KEY_BYTES = 32; // AES-256-GCM (Grover-resistant symmetric cipher)
const AES_IV_BYTES = 12; // 96-bit standard GCM nonce

/** Default QoreChain chain ID and QoreSeal application purpose bound into every HKDF key derivation. */
export const QORESEAL_CHAIN_ID = "qorechain-diana";
export const QORESEAL_VAULT_PURPOSE = "synapseq-vault-dek";

export interface KemKeyPair {
  /** 1568-byte NIST FIPS 203 ML-KEM-1024 encapsulation key */
  publicKey: Uint8Array;
  /** 3168-byte NIST FIPS 203 ML-KEM-1024 decapsulation key */
  secretKey: Uint8Array;
  /** Full QoreSeal key pair (ML-KEM-1024 + X25519 + 32-byte seed) for hybrid & recipient cards */
  sealKeys?: SealKeyPair;
}

export interface DsaKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface SealDocumentOptions {
  /** Optional X25519 public key (from a verified QoreSeal Recipient Card) to enable hybrid ML-KEM-1024 + X25519 mode */
  recipientX25519PublicKey?: Uint8Array;
  /** Override QoreSeal chain ID binding (default: "qorechain-diana") */
  chainId?: string;
  /** Override QoreSeal purpose binding (default: "synapseq-vault-dek") */
  purpose?: string;
}

export interface SealedDocumentResult {
  /** AES-256-GCM encrypted document bytes (iv || ciphertext+authTag) ready for IPFS */
  encryptedBlob: Uint8Array;
  /**
   * SHAKE-256 32-byte digest of the *encrypted* blob. Hashing the ciphertext (not the plaintext)
   * avoids a public "guess-and-confirm" oracle for low-entropy medical documents.
   */
  contentHash: `0x${string}`;
  /** keccak256 of the QoreSeal envelope: the on-chain commitment the gateway release is checked against */
  envelopeHash: `0x${string}`;
  /** Official QoreSeal v1 binary envelope (ML-KEM-1024 or hybrid ML-KEM-1024 + X25519) wrapping the 32-byte DEK */
  encryptedKeyEnvelope: `0x${string}`;
  /** QoreSeal encryption mode used ("hybrid" when X25519 key provided, otherwise "mlkem") */
  sealMode: SealMode;
}

/**
 * Generates a NIST FIPS 203 ML-KEM-1024 (+ X25519) QoreSeal key pair.
 */
export function generateKemKeyPair(): KemKeyPair {
  const sealKeys = generateSealKeys();
  return {
    publicKey: sealKeys.mlkemPublicKey,
    secretKey: sealKeys.mlkemSecretKey,
    sealKeys,
  };
}

/**
 * Deterministically derives a QoreSeal ML-KEM-1024 (+ X25519) key pair from a seed.
 * Used to rebuild a specialist's key from a wallet signature (no secret key stored in the browser).
 */
export function deriveKemKeyPairFromSeed(seed: Uint8Array): KemKeyPair {
  const seed32 = seed.length === 32 ? seed : shake256(seed, { dkLen: 32 });
  const sealKeys = sealKeysFromSeed(seed32);
  return {
    publicKey: sealKeys.mlkemPublicKey,
    secretKey: sealKeys.mlkemSecretKey,
    sealKeys,
  };
}

/** Fixed message a wallet signs to derive its ML-KEM-1024 key (ECDSA RFC 6979 is deterministic). */
export const KEM_DERIVATION_MESSAGE =
  "SynapseQ ML-KEM-1024 key derivation v1\nSigning this does NOT authorize any transaction.";

/** Derives the QoreSeal key pair from the wallet's signature over KEM_DERIVATION_MESSAGE. */
export function deriveKemKeyPairFromSignature(signatureHex: `0x${string}`): KemKeyPair {
  return deriveKemKeyPairFromSeed(shake256(hexToBytes(signatureHex), { dkLen: 32 }));
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
 * Hybrid Post-Quantum Envelope Encryption powered by official @qorechain/qoreseal:
 * 1) Validates the recipient's ML-KEM-1024 public key against FIPS 203 modulus checks.
 * 2) Encrypts plaintext with a fresh random AES-256-GCM Data Encryption Key (DEK).
 * 3) Computes SHAKE-256 integrity hash of the resulting ciphertext.
 * 4) Seals the 32-byte DEK into an official QoreSeal v1 binary envelope bound to QoreChain Diana.
 */
export async function encryptAndSealDocument(
  plaintext: Uint8Array,
  recipientKemPublicKey: Uint8Array,
  options: SealDocumentOptions = {}
): Promise<SealedDocumentResult> {
  validateMlkemPublicKey(recipientKemPublicKey);

  // Step 1: Encrypt the document payload with a fresh random 256-bit DEK
  const dek = getCrypto().getRandomValues(new Uint8Array(AES_KEY_BYTES));
  const encryptedBlob = await aesGcmEncrypt(dek, plaintext);

  // Step 2: Wrap the DEK in an official QoreSeal v1 envelope (hybrid when X25519 key is supplied)
  const sealMode: SealMode = options.recipientX25519PublicKey ? "hybrid" : "mlkem";
  const qoreSealEnvelope = qoreSealSeal({
    chainId: options.chainId ?? QORESEAL_CHAIN_ID,
    purpose: options.purpose ?? QORESEAL_VAULT_PURPOSE,
    mode: sealMode,
    recipients: [
      {
        mlkemPublicKey: recipientKemPublicKey,
        ...(options.recipientX25519PublicKey
          ? { x25519PublicKey: options.recipientX25519PublicKey }
          : {}),
      },
    ],
    plaintext: dek,
    anonymous: true,
  });
  dek.fill(0);

  const encryptedKeyEnvelope = bytesToHex(qoreSealEnvelope);
  return {
    encryptedBlob,
    contentHash: computeShake256(encryptedBlob),
    encryptedKeyEnvelope,
    envelopeHash: computeEnvelopeHash(encryptedKeyEnvelope),
    sealMode,
  };
}

/**
 * Hybrid Post-Quantum Decryption & Integrity Verification powered by official @qorechain/qoreseal:
 * 0) Verifies SHAKE-256(ciphertext) against the on-chain contentHash BEFORE decrypting.
 * 1) Opens the official QoreSeal v1 envelope to recover the 32-byte DEK.
 * 2) Decrypts the encrypted document blob in memory with AES-256-GCM.
 */
export async function unsealAndDecryptDocument(
  encryptedBlob: Uint8Array,
  encryptedKeyEnvelopeHex: `0x${string}`,
  recipientKemSecretKey: Uint8Array,
  expectedContentHash: `0x${string}`,
  options: {
    sealKeys?: SealKeyPair;
    chainId?: string;
    purpose?: string;
  } = {}
): Promise<Uint8Array> {
  const actualHash = computeShake256(encryptedBlob);
  if (actualHash.toLowerCase() !== expectedContentHash.toLowerCase()) {
    throw new Error(
      `Integrity verification failed: expected ${expectedContentHash}, got ${actualHash}`
    );
  }

  const envelopeBytes = hexToBytes(encryptedKeyEnvelopeHex);
  const openKeys: SealKeyPair = options.sealKeys ?? {
    seed: new Uint8Array(32),
    mlkemPublicKey: new Uint8Array(1568),
    mlkemSecretKey: recipientKemSecretKey,
    x25519PublicKey: new Uint8Array(32),
    x25519SecretKey: new Uint8Array(32),
  };

  // Step 1: Open official QoreSeal v1 envelope to recover the 32-byte DEK
  const dek = qoreSealOpen({
    chainId: options.chainId ?? QORESEAL_CHAIN_ID,
    purpose: options.purpose ?? QORESEAL_VAULT_PURPOSE,
    envelope: envelopeBytes,
    keys: openKeys,
  });

  // Step 2: Decrypt document blob in memory (AES-GCM tag authenticates the plaintext)
  try {
    return await aesGcmDecrypt(dek, encryptedBlob);
  } finally {
    dek.fill(0);
  }
}

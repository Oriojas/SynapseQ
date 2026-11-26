/**
 * OEM (implant manufacturer) tooling: signs HBOM firmware attestations with the manufacturer's
 * REGISTERED ML-DSA-87 key so that SynapseVaultRegistry can verify them ON-CHAIN through
 * QoreChain's PQC precompiles (pqcKeyStatus 0x…0a02 + pqcVerify 0x…0a01, Diana testnet).
 *
 * Why a tool and not the browser: QoreX does not expose ML-DSA message signing to web pages, and
 * the registered key is the account's *canonical* key, derived from its mnemonic
 * (`deriveCanonicalPqKey`). Manufacturers sign firmware in their own build pipeline anyway.
 *
 * Local development: Anvil (or an Anvil fork of Diana) does NOT run QoreChain's native precompiles,
 * so `make init` places MockQorePqc at 0x…0a01/0x…0a02. On such a chain this module registers the
 * OEM key in the mock and approves the exact (pubkey, signature, message) triple AFTER verifying the
 * signature off-chain with ML-DSA-87. On Diana it never touches the mock.
 */
import {
  deriveCanonicalPqKey,
  deriveClassicalKey,
  addressFromPublicKey,
  pqKeyFromSeed,
  pqSign,
  pqVerify,
  type PqKeyPair,
} from "@qorechain/qoresign";
import {
  bytesToHex,
  hexToBytes,
  keccak256,
  parseAbi,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { SYNAPSE_VAULT_ABI } from "./abi.js";

export const PQC_VERIFY_PRECOMPILE = "0x0000000000000000000000000000000000000a01" as const;
export const PQC_KEY_STATUS_PRECOMPILE = "0x0000000000000000000000000000000000000a02" as const;

const MOCK_PQC_ABI = parseAbi([
  "function setKeyStatus(address account, bytes pubkey, bool possessionProven)",
  "function approveSignature(bytes pubkey, bytes signature, bytes message)",
]);
const PQC_KEY_STATUS_ABI = parseAbi([
  "function pqcKeyStatus(address account) view returns (bool registered, uint8 algorithmId, bytes pubkey, bool possessionProven)",
]);

export interface OemIdentity {
  readonly account: PrivateKeyAccount;
  readonly pqKey: PqKeyPair;
  /** "canonical" = the key QoreChain wallets register for this account (Diana-ready). */
  readonly pqKeySource: "canonical" | "dev-derived";
}

/**
 * Diana: derive the EVM account and its canonical ML-DSA-87 key from the OEM mnemonic.
 * The PQ key is bound to the account's bech32 address, exactly as QoreX derives it.
 */
export function oemFromMnemonic(mnemonic: string, index = 0): OemIdentity {
  const classical = deriveClassicalKey({ mnemonic, type: "eth_secp256k1", index });
  const address = addressFromPublicKey(classical.publicKey, "eth_secp256k1");
  const account = privateKeyToAccount(bytesToHex(classical.privateKey));
  if (account.address.toLowerCase() !== address.hex.toLowerCase()) {
    throw new Error("Derived EVM account does not match the QoreSign address derivation.");
  }
  return {
    account,
    pqKey: deriveCanonicalPqKey({ mnemonic, address: address.bech32 }),
    pqKeySource: "canonical",
  };
}

/** Local dev only: EVM private key + an ML-DSA key deterministically derived from it. */
export function oemFromDevPrivateKey(privateKey: `0x${string}`): OemIdentity {
  const seed = hexToBytes(keccak256(`${privateKey}${"5eed"}` as `0x${string}`));
  return { account: privateKeyToAccount(privateKey), pqKey: pqKeyFromSeed(seed), pqKeySource: "dev-derived" };
}

export interface PqcChainInfo {
  /** true when MockQorePqc code sits at the precompile address (Anvil / Anvil fork). */
  readonly isDevMock: boolean;
  /** false when the precompile does not answer (plain Anvil, mainnet): the contract fails closed. */
  readonly available: boolean;
  readonly registered: boolean;
  readonly algorithmId: number;
  readonly possessionProven: boolean;
  readonly registeredPubkeyMatches: boolean;
}

export async function inspectPqcKey(client: PublicClient, oem: OemIdentity): Promise<PqcChainInfo> {
  const code = await client.getCode({ address: PQC_KEY_STATUS_PRECOMPILE });
  const isDevMock = Boolean(code && code !== "0x");
  try {
    const [registered, algorithmId, pubkey, possessionProven] = await client.readContract({
      address: PQC_KEY_STATUS_PRECOMPILE,
      abi: PQC_KEY_STATUS_ABI,
      functionName: "pqcKeyStatus",
      args: [oem.account.address],
    });
    return {
      isDevMock,
      available: true,
      registered,
      algorithmId,
      possessionProven,
      registeredPubkeyMatches: pubkey.toLowerCase() === bytesToHex(oem.pqKey.publicKey).toLowerCase(),
    };
  } catch {
    // Precompile absent (plain Anvil without mock, or mainnet): the contract will fail closed.
    return {
      isDevMock,
      available: false,
      registered: false,
      algorithmId: 0,
      possessionProven: false,
      registeredPubkeyMatches: false,
    };
  }
}

interface Clients {
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient;
  readonly vault: Address;
}

async function sendChecked(c: Clients, hash: Hash, label: string): Promise<bigint> {
  const receipt = await c.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} reverted (tx ${hash})`);
  return receipt.gasUsed;
}

/** Dev-chain only: make the mock behave like Diana for this OEM key and this exact signature. */
async function prepareDevMock(c: Clients, oem: OemIdentity, signature: Uint8Array, message: `0x${string}`) {
  const pubkey = bytesToHex(oem.pqKey.publicKey);
  await sendChecked(
    c,
    await c.walletClient.writeContract({
      account: oem.account,
      chain: c.walletClient.chain,
      address: PQC_KEY_STATUS_PRECOMPILE,
      abi: MOCK_PQC_ABI,
      functionName: "setKeyStatus",
      args: [oem.account.address, pubkey, true],
    }),
    "mock.setKeyStatus"
  );
  await sendChecked(
    c,
    await c.walletClient.writeContract({
      account: oem.account,
      chain: c.walletClient.chain,
      address: PQC_VERIFY_PRECOMPILE,
      abi: MOCK_PQC_ABI,
      functionName: "approveSignature",
      args: [pubkey, bytesToHex(signature), message],
    }),
    "mock.approveSignature"
  );
}

/**
 * Signs the contract's exact attestation message with ML-DSA-87 and checks it locally first.
 * The message is read FROM THE CONTRACT, so it is bound to chain ID, contract, part and version.
 */
async function signAttestation(
  c: Clients,
  oem: OemIdentity,
  partId: `0x${string}`,
  version: number,
  firmwareHash: `0x${string}`,
  calibrationHash: `0x${string}`
): Promise<{ signature: Uint8Array; message: `0x${string}` }> {
  const message = await c.publicClient.readContract({
    address: c.vault,
    abi: SYNAPSE_VAULT_ABI,
    functionName: "firmwareAttestationMessage",
    args: [partId, version, firmwareHash, calibrationHash],
  });
  const signature = pqSign(oem.pqKey.secretKey, hexToBytes(message));
  if (!pqVerify(oem.pqKey.publicKey, hexToBytes(message), signature)) {
    throw new Error("Local ML-DSA-87 self-verification failed.");
  }
  return { signature, message };
}

async function ensureChainReady(c: Clients, oem: OemIdentity, signature: Uint8Array, message: `0x${string}`) {
  const info = await inspectPqcKey(c.publicClient, oem);
  if (!info.available) {
    throw new Error(
      "QoreChain PQC precompiles are not available on this chain (plain Anvil or mainnet). Use Diana testnet, or run `make dev-pqc-mock` on a local Anvil."
    );
  }
  if (info.isDevMock) {
    await prepareDevMock(c, oem, signature, message);
    return;
  }
  if (!info.registered) {
    throw new Error(
      `No ML-DSA-87 key registered on-chain for ${oem.account.address}. Register it with QoreX (or the QoreChain SDK) first.`
    );
  }
  if (!info.registeredPubkeyMatches) {
    throw new Error(
      "The ML-DSA key registered on-chain is not this OEM's canonical key (wrong mnemonic/index?)."
    );
  }
}

export interface RegisterPartArgs {
  readonly bearer: Address;
  readonly zone: number;
  readonly modelName: string;
  readonly serialNumber: string;
  readonly firmwareHash: `0x${string}`;
  readonly calibrationHash: `0x${string}`;
}

export async function registerPartWithAttestation(
  c: Clients,
  oem: OemIdentity,
  args: RegisterPartArgs
): Promise<{ partId: `0x${string}`; hash: Hash; gasUsed: bigint; signatureBytes: number }> {
  const partId = await c.publicClient.readContract({
    address: c.vault,
    abi: SYNAPSE_VAULT_ABI,
    functionName: "computePartId",
    args: [oem.account.address, args.serialNumber],
  });
  const { signature, message } = await signAttestation(c, oem, partId, 1, args.firmwareHash, args.calibrationHash);
  await ensureChainReady(c, oem, signature, message);

  const callArgs = [
    args.bearer,
    args.zone,
    args.modelName,
    args.serialNumber,
    args.firmwareHash,
    args.calibrationHash,
    bytesToHex(signature),
  ] as const;
  const { request } = await c.publicClient.simulateContract({
    account: oem.account,
    address: c.vault,
    abi: SYNAPSE_VAULT_ABI,
    functionName: "registerBionicPart",
    args: callArgs,
  });
  const hash = await c.walletClient.writeContract(request);
  const gasUsed = await sendChecked(c, hash, "registerBionicPart");
  return { partId, hash, gasUsed, signatureBytes: signature.length };
}

export async function pushFirmwareWithAttestation(
  c: Clients,
  oem: OemIdentity,
  partId: `0x${string}`,
  firmwareHash: `0x${string}`,
  calibrationHash: `0x${string}`
): Promise<{ version: number; hash: Hash; gasUsed: bigint }> {
  const part = await c.publicClient.readContract({
    address: c.vault,
    abi: SYNAPSE_VAULT_ABI,
    functionName: "getBionicPart",
    args: [partId],
  });
  const version = part.firmwareVersion + 1;
  const { signature, message } = await signAttestation(c, oem, partId, version, firmwareHash, calibrationHash);
  await ensureChainReady(c, oem, signature, message);

  const { request } = await c.publicClient.simulateContract({
    account: oem.account,
    address: c.vault,
    abi: SYNAPSE_VAULT_ABI,
    functionName: "logFirmwareUpdate",
    args: [partId, firmwareHash, calibrationHash, bytesToHex(signature)],
  });
  const hash = await c.walletClient.writeContract(request);
  const gasUsed = await sendChecked(c, hash, "logFirmwareUpdate");
  return { version, hash, gasUsed };
}

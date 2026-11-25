import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  defineChain,
  http,
  type Address,
} from "viem";
import { SYNAPSE_VAULT_ABI } from "../../sdk/src/abi.js";

export interface OnChainGrantPolicy {
  readonly patient: Address;
  readonly specialist: Address;
  readonly validUntil: bigint;
  readonly revoked: boolean;
  readonly isActive: boolean;
  readonly contentHash: `0x${string}`;
  readonly envelopeHash: `0x${string}`;
}

/** Raised when the chain could not be queried (RPC down, wrong contract address, ...). */
export class ChainUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainUnavailableError";
  }
}

export interface ChainPolicyVerifier {
  readonly chainId: number;
  /** Returns null ONLY when the record does not exist; throws ChainUnavailableError otherwise. */
  getGrantPolicy(recordId: `0x${string}`): Promise<OnChainGrantPolicy | null>;
}

/**
 * Live QoreChain EVM verifier that reads `getGrantMetadata(recordId)` (which already includes the
 * kill-switch-aware `isActive`) before authorizing any key release.
 */
export class QoreChainPolicyVerifier implements ChainPolicyVerifier {
  public readonly chainId: number;
  private readonly contractAddress: Address;
  private readonly publicClient;

  constructor(params: {
    readonly rpcUrl: string;
    readonly chainId: number;
    readonly contractAddress: Address;
  }) {
    this.chainId = params.chainId;
    this.contractAddress = params.contractAddress;
    const chain = defineChain({
      id: params.chainId,
      name: "QoreChain Diana Testnet",
      nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
      rpcUrls: { default: { http: [params.rpcUrl] } },
    });
    this.publicClient = createPublicClient({ chain, transport: http(params.rpcUrl) });
  }

  public async getGrantPolicy(recordId: `0x${string}`): Promise<OnChainGrantPolicy | null> {
    try {
      const metadata = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: SYNAPSE_VAULT_ABI,
        functionName: "getGrantMetadata",
        args: [recordId],
      });
      return {
        patient: metadata.patient,
        specialist: metadata.specialist,
        validUntil: metadata.validUntil,
        revoked: metadata.revoked,
        isActive: metadata.isActive,
        contentHash: metadata.contentHash,
        envelopeHash: metadata.envelopeHash,
      };
    } catch (err) {
      if (err instanceof BaseError) {
        const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
        if (
          revert instanceof ContractFunctionRevertedError &&
          revert.data?.errorName === "RecordNotFound"
        ) {
          return null;
        }
      }
      throw new ChainUnavailableError(
        `Could not verify the on-chain policy: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`
      );
    }
  }
}

import { createPublicClient, defineChain, http, type Address } from "viem";
import { SYNAPSE_VAULT_ABI } from "../../sdk/src/abi.js";

export interface OnChainGrantPolicy {
  readonly patient: Address;
  readonly specialist: Address;
  readonly validUntil: bigint;
  readonly revoked: boolean;
  readonly isActive: boolean;
}

export interface ChainPolicyVerifier {
  getGrantPolicy(recordId: `0x${string}`): Promise<OnChainGrantPolicy | null>;
}

/**
 * Live QoreChain EVM verifier that queries `SynapseVaultRegistry.getGrantMetadata(recordId)`
 * and `isAccessValid(recordId)` before authorizing any key release.
 */
export class QoreChainPolicyVerifier implements ChainPolicyVerifier {
  private readonly contractAddress: Address;
  private readonly publicClient;

  constructor(params: {
    readonly rpcUrl: string;
    readonly chainId: number;
    readonly contractAddress: Address;
  }) {
    this.contractAddress = params.contractAddress;
    const chain = defineChain({
      id: params.chainId,
      name: "QoreChain Diana Testnet",
      nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
      rpcUrls: { default: { http: [params.rpcUrl] } },
    });
    this.publicClient = createPublicClient({
      chain,
      transport: http(params.rpcUrl),
    });
  }

  public async getGrantPolicy(recordId: `0x${string}`): Promise<OnChainGrantPolicy | null> {
    try {
      const [metadata, isActive] = await Promise.all([
        this.publicClient.readContract({
          address: this.contractAddress,
          abi: SYNAPSE_VAULT_ABI,
          functionName: "getGrantMetadata",
          args: [recordId],
        }),
        this.publicClient.readContract({
          address: this.contractAddress,
          abi: SYNAPSE_VAULT_ABI,
          functionName: "isAccessValid",
          args: [recordId],
        }),
      ]);

      return {
        patient: metadata.patient,
        specialist: metadata.specialist,
        validUntil: metadata.validUntil,
        revoked: metadata.revoked,
        isActive,
      };
    } catch {
      return null;
    }
  }
}

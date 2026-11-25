export interface FrontendEnvConfig {
  readonly qorechainRpcUrl: string;
  readonly qorechainChainId: number;
  readonly synapseVaultAddress: `0x${string}` | undefined;
  readonly gatewayUrl: string | undefined;
  readonly ipfsGatewayUrl: string | undefined;
}

function parseHexAddress(value: string | undefined): `0x${string}` | undefined {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value.trim())) {
    return undefined;
  }
  return value.trim() as `0x${string}`;
}

export function getFrontendEnvConfig(): FrontendEnvConfig {
  const rawRpcUrl = import.meta.env.VITE_QORECHAIN_RPC_URL;
  const rawChainId = import.meta.env.VITE_QORECHAIN_CHAIN_ID;
  const rawVaultAddress = import.meta.env.VITE_SYNAPSE_VAULT_ADDRESS;
  const rawGatewayUrl = import.meta.env.VITE_GATEWAY_URL;
  const rawIpfsGatewayUrl = import.meta.env.VITE_IPFS_GATEWAY_URL;

  const parsedChainId = rawChainId ? Number.parseInt(rawChainId, 10) : Number.NaN;

  return {
    qorechainRpcUrl: rawRpcUrl?.trim() ?? '',
    qorechainChainId: Number.isFinite(parsedChainId) ? parsedChainId : 0,
    synapseVaultAddress: parseHexAddress(rawVaultAddress),
    gatewayUrl: rawGatewayUrl?.trim() || undefined,
    ipfsGatewayUrl: rawIpfsGatewayUrl?.trim() || undefined,
  };
}

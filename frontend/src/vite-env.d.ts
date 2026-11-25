/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QORECHAIN_RPC_URL?: string;
  readonly VITE_QORECHAIN_CHAIN_ID?: string;
  readonly VITE_SYNAPSE_VAULT_ADDRESS?: string;
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_IPFS_GATEWAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

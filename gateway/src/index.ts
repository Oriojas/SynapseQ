import { join } from "node:path";
import type { Address } from "viem";
import { QoreChainPolicyVerifier } from "./chain.js";
import { createGatewayServer } from "./server.js";
import { EnvelopeVaultStore } from "./store.js";

const PORT = Number(process.env.GATEWAY_PORT ?? 4000);
const RPC_URL = process.env.QORECHAIN_RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.QORECHAIN_CHAIN_ID ?? 9800);
const CONTRACT_ADDRESS = (process.env.SYNAPSE_VAULT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as Address;
const PINATA_JWT = process.env.PINATA_JWT || undefined;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const verifier = new QoreChainPolicyVerifier({
  rpcUrl: RPC_URL,
  chainId: CHAIN_ID,
  contractAddress: CONTRACT_ADDRESS,
});

const store = new EnvelopeVaultStore(join(process.cwd(), "data"));
const server = createGatewayServer({
  verifier,
  store,
  pinataJwt: PINATA_JWT,
  corsOrigin: CORS_ORIGIN,
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("=========================================================");
  console.log(`SynapseQ Key-Release Gateway listening on http://127.0.0.1:${PORT}`);
  console.log(`QoreChain RPC:  ${RPC_URL} (Chain ID ${CHAIN_ID})`);
  console.log(`Vault Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Pinata Proxy:   ${PINATA_JWT ? "ENABLED (server-side JWT)" : "LOCAL FALLBACK"}`);
  console.log("=========================================================");
});

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isAddress, zeroAddress, type Address } from "viem";
import { QoreChainPolicyVerifier } from "./chain.js";
import { createGatewayServer } from "./server.js";
import { EnvelopeVaultStore } from "./store.js";

/** Minimal .env loader (gateway/.env, then repo-root .env). Real env vars always win. */
function loadDotEnv(file: string): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || line.trim().startsWith("#")) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (process.env[match[1]] === undefined && !value.includes("<")) process.env[match[1]] = value;
  }
}
loadDotEnv(join(process.cwd(), ".env"));
loadDotEnv(join(process.cwd(), "..", ".env"));

const PORT = Number(process.env.GATEWAY_PORT ?? 4000);
const RPC_URL = process.env.QORECHAIN_RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.QORECHAIN_CHAIN_ID ?? 9800);
const CONTRACT_ADDRESS = process.env.SYNAPSE_VAULT_ADDRESS ?? "";
const PINATA_JWT = process.env.PINATA_JWT || undefined;
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (!isAddress(CONTRACT_ADDRESS) || CONTRACT_ADDRESS === zeroAddress) {
  console.error("SYNAPSE_VAULT_ADDRESS is missing or invalid. Set it in gateway/.env or the root .env.");
  process.exit(1);
}
if (CORS_ORIGINS.includes("*")) {
  console.error("CORS_ORIGIN='*' is not allowed: list the frontend origins explicitly.");
  process.exit(1);
}

const verifier = new QoreChainPolicyVerifier({
  rpcUrl: RPC_URL,
  chainId: CHAIN_ID,
  contractAddress: CONTRACT_ADDRESS as Address,
});

const store = new EnvelopeVaultStore(join(process.cwd(), "data"));
const server = createGatewayServer({
  verifier,
  store,
  pinataJwt: PINATA_JWT,
  corsOrigins: CORS_ORIGINS,
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("=========================================================");
  console.log(`SynapseQ Key-Release Gateway listening on http://127.0.0.1:${PORT}`);
  console.log(`QoreChain RPC:  ${RPC_URL} (Chain ID ${CHAIN_ID})`);
  console.log(`Vault Contract: ${CONTRACT_ADDRESS}`);
  console.log(`CORS origins:   ${CORS_ORIGINS.join(", ")}`);
  console.log(`Pinata Proxy:   ${PINATA_JWT ? "ENABLED (server-side JWT)" : "LOCAL FALLBACK"}`);
  console.log("=========================================================");
});

/**
 * SynapseQ — Railway Infrastructure as Code.
 *
 * This folder is an isolated package (its own package.json / node_modules): the SDK used here
 * never touches the app packages (sdk/, gateway/, frontend/).
 *
 *   cd .railway && npm install
 *   railway link                 # pick the project + environment
 *   npm run plan                 # railway config plan
 *   npm run apply                # railway config apply
 *
 * Both services build from the repo root because gateway/ and frontend/ import ../sdk/src.
 * Secrets (PINATA_JWT) and the deployed contract address use preserve(): set them once in the
 * Railway dashboard (or `railway variables --set`) and apply will never overwrite them.
 */
import { defineRailway, github, preserve, project, service, volume } from "railway/iac";

const REPO = "Oriojas/SynapseQ";
const BRANCH = "master";

// QoreChain Diana Testnet (public endpoints, see README).
const DIANA_EVM_RPC = "https://evm-testnet.qore.host";
const DIANA_REST = "https://api-testnet.qore.host";
const DIANA_CHAIN_ID = "9800";
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

export default defineRailway(() => {
  // Envelope store (gateway/data/*.json) must survive redeploys.
  const gatewayData = volume("gateway-data", { sizeMB: 1024 });

  const gateway = service("gateway", {
    source: github(REPO, { branch: BRANCH }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "gateway/Dockerfile",
      watchPatterns: ["gateway/**", "sdk/src/**", "sdk/package*.json"],
    },
    deploy: {
      healthcheckPath: "/health",
      healthcheckTimeout: 60,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    volumeMounts: {
      "/app/gateway/data": gatewayData,
    },
    env: {
      NODE_ENV: "production",
      GATEWAY_HOST: "0.0.0.0", // PORT is injected by Railway (GATEWAY_PORT left unset)
      QORECHAIN_RPC_URL: DIANA_EVM_RPC,
      QORECHAIN_CHAIN_ID: DIANA_CHAIN_ID,
      QORECHAIN_REST_URL: DIANA_REST,
      SYNAPSE_VAULT_ADDRESS: preserve(),
      PINATA_JWT: preserve(), // server-only secret
      // Only the frontend's public domain may call the gateway (Railway resolves ${{...}}).
      CORS_ORIGIN: "https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}",
    },
  });

  const frontend = service("frontend", {
    source: github(REPO, { branch: BRANCH }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "frontend/Dockerfile",
      watchPatterns: ["frontend/**", "sdk/src/**", "sdk/package*.json"],
    },
    deploy: {
      healthcheckPath: "/",
      healthcheckTimeout: 60,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    // Build-time (VITE_* are inlined into the public bundle: public values only, no secrets).
    env: {
      VITE_QORECHAIN_RPC_URL: DIANA_EVM_RPC,
      VITE_QORECHAIN_CHAIN_ID: DIANA_CHAIN_ID,
      VITE_SYNAPSE_VAULT_ADDRESS: preserve(),
      VITE_GATEWAY_URL: "https://${{gateway.RAILWAY_PUBLIC_DOMAIN}}",
      VITE_IPFS_GATEWAY_URL: IPFS_GATEWAY,
    },
  });

  return project("SynapseQ", {
    resources: [gatewayData, gateway, frontend],
  });
});

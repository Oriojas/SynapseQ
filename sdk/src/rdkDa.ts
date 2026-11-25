import {
  buildDaBlob,
  checkPreflight,
  createRdkClient,
  DEFAULT_RDK_PARAMS,
  isDaBackendAvailable,
  presets,
  validateRollupConfig,
  type DaBlob,
  type ParamsView,
  type PreflightResult,
  type RdkClient,
  type RollupConfig,
  type RollupView,
  type ValidationResult,
} from "@qorechain/rdk";
import { encryptAndSealDocument, type SealedDocumentResult } from "./pqc.js";

export interface RdkNetworkStatus {
  chainId: string;
  endpoints: RdkClient["network"]["endpoints"];
  nativeDaAvailable: boolean;
  params: ParamsView | typeof DEFAULT_RDK_PARAMS;
  registeredRollups: RollupView[];
  preflight: PreflightResult | null;
}

export interface EncryptedDaBlobPackage extends SealedDocumentResult {
  /** QoreChain x/rdk Native DA blob ready for submission via RdkTxClient */
  daBlob: DaBlob;
}

/**
 * Creates a QoreChain RDK client connected to Diana Testnet (default) or Vladi Mainnet.
 */
export function createSynapseRdkClient(network: "testnet" | "mainnet" = "testnet"): RdkClient {
  return createRdkClient({ network });
}

/**
 * Queries live x/rdk module parameters, registered rollups, and preflight readiness
 * from the QoreChain host chain.
 */
export async function getLiveRdkStatus(
  network: "testnet" | "mainnet" = "testnet"
): Promise<RdkNetworkStatus> {
  const client = createSynapseRdkClient(network);

  let params: ParamsView | typeof DEFAULT_RDK_PARAMS = DEFAULT_RDK_PARAMS;
  let registeredRollups: RollupView[] = [];
  let preflight: PreflightResult | null = null;

  try {
    params = await client.rest.getParams();
  } catch {
    // Fallback to documented protocol defaults when REST node is unreachable
  }

  try {
    registeredRollups = await client.rest.listRollups();
  } catch {
    registeredRollups = [];
  }

  try {
    preflight = await checkPreflight(client);
  } catch {
    preflight = null;
  }

  return {
    chainId: client.network.chainId,
    endpoints: client.network.endpoints,
    nativeDaAvailable: isDaBackendAvailable("native"),
    params,
    registeredRollups,
    preflight,
  };
}

/**
 * Builds and validates a SynapseQ Sovereign Enterprise Rollup configuration
 * using QoreChain's Native DA Router (with automatic EndBlocker pruning for ephemeral telemetry).
 */
export function buildSynapseSovereignConfig(
  rollupId: string = "synapseq-hbom-v1"
): { config: RollupConfig; validation: ValidationResult } {
  const config = presets
    .enterprise({
      rollupId,
      settlement: "sovereign",
      da: "native",
    })
    .build();
  const validation = validateRollupConfig(config);
  return { config, validation };
}

/**
 * Encrypts an ephemeral bionic telemetry or clinical payload with AES-256-GCM + ML-KEM-1024
 * and packages the ciphertext into a protocol-compliant QoreChain Native DA Blob (<= 2 MiB).
 */
export async function prepareEncryptedDaBlob(
  plaintext: Uint8Array,
  recipientKemPublicKey: Uint8Array,
  maxBlobSize: number = DEFAULT_RDK_PARAMS.maxDaBlobSize
): Promise<EncryptedDaBlobPackage> {
  const sealed = await encryptAndSealDocument(plaintext, recipientKemPublicKey);
  const daBlob = buildDaBlob({
    data: sealed.encryptedBlob,
    maxBlobSize,
  });

  return {
    ...sealed,
    daBlob,
  };
}

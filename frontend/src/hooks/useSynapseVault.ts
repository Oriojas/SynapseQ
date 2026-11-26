import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Address,
  type Hash,
} from 'viem';
import { SYNAPSE_VAULT_ABI } from '@sdk/abi';
import {
  classifyEvmWindowRejection,
  describeEvmWindowProblem,
  parseEvmWindow,
  windowBlocksTarget,
  type EvmWindowStatus,
} from '@sdk/evmWindow';
import { getFrontendEnvConfig } from '@/config/env';

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export interface OnChainTxReceiptInfo {
  readonly txHash: Hash;
  readonly action: string;
  readonly blockNumber?: bigint;
  readonly gasUsed?: bigint;
  readonly timestamp: number;
}

export interface OnChainGrantMetadata {
  readonly contentHash: `0x${string}`;
  readonly envelopeHash: `0x${string}`;
  readonly linkedPartId: `0x${string}`;
  readonly patient: Address;
  readonly specialist: Address;
  /** 0 = CLINICAL, 1 = TELEMETRY */
  readonly domain: number;
  readonly createdAt: bigint;
  readonly validUntil: bigint;
  readonly revoked: boolean;
  readonly isActive: boolean;
}

export interface OnChainGrant extends OnChainGrantMetadata {
  readonly recordId: `0x${string}`;
}

export interface SpecialistGrantsResult {
  readonly grants: readonly OnChainGrant[];
  /** recordIds listed by getGrantsBySpecialist whose metadata read reverted/failed. */
  readonly failedIds: readonly `0x${string}`[];
}

export interface TxResult<T = undefined> {
  readonly hash: Hash;
  readonly result: T;
}

type WritableFunction =
  | 'registerKemPublicKey'
  | 'grantTimedAccess'
  | 'extendAccess'
  | 'revokeAccess'
  | 'emergencyRevokeAll'
  | 'registerBionicPart'
  | 'logFirmwareUpdate'
  | 'updatePartStatus';

import { detectDappLocale } from '@/i18n/context';

function bi(en: string, es: string): string {
  return detectDappLocale() === 'es' ? es : en;
}

/** Turns viem errors into a short, user-readable message (custom error name when available). */
export function describeTxError(err: unknown, contract?: string): string {
  // QoreChain EVM-lane refusals (no ML-DSA key / no window / exhausted / bad bounds) come first
  const windowProblem = classifyEvmWindowRejection(err);
  if (windowProblem) return describeEvmWindowProblem(windowProblem, contract);
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const reason = revert.data?.errorName ?? revert.reason ?? 'revert';
      return bi(`Transaction would revert: ${reason}`, `La transacción revertiría: ${reason}`);
    }
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : String(err);
}

export function useSynapseVault() {
  const env = useMemo(() => getFrontendEnvConfig(), []);
  const targetChainId = env.qorechainChainId || 9800;
  const contractAddress = env.synapseVaultAddress;

  const [walletAddress, setWalletAddress] = useState<Address | null>(null);
  const [isTxPending, setIsTxPending] = useState<boolean>(false);
  const [txHistory, setTxHistory] = useState<readonly OnChainTxReceiptInfo[]>([]);
  /** QoreChain EVM authorisation window of the connected wallet (null = unknown / not enforced). */
  const [evmWindow, setEvmWindow] = useState<EvmWindowStatus | null>(null);
  const [evmWindowEnforced, setEvmWindowEnforced] = useState<boolean>(false);

  const chain = useMemo(
    () =>
      defineChain({
        id: targetChainId,
        name: 'QoreChain Diana Testnet',
        nativeCurrency: { name: 'QOR', symbol: 'QOR', decimals: 18 },
        rpcUrls: { default: { http: env.qorechainRpcUrl ? [env.qorechainRpcUrl] : [] } },
      }),
    [env.qorechainRpcUrl, targetChainId]
  );

  const publicClient = useMemo(() => {
    if (env.qorechainRpcUrl) {
      return createPublicClient({ chain, transport: http(env.qorechainRpcUrl) });
    }
    if (typeof window !== 'undefined' && window.ethereum) {
      return createPublicClient({ chain, transport: custom(window.ethereum) });
    }
    return null;
  }, [env.qorechainRpcUrl, chain]);

  // Track the wallet's active account (account switches in the wallet update the UI)
  useEffect(() => {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
    if (!eth) return;
    eth
      .request({ method: 'eth_accounts' })
      .then((accounts) => {
        if (Array.isArray(accounts) && typeof accounts[0] === 'string') {
          setWalletAddress(accounts[0] as Address);
        }
      })
      .catch(() => undefined);
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0];
      setWalletAddress(
        Array.isArray(accounts) && typeof accounts[0] === 'string' ? (accounts[0] as Address) : null
      );
    };
    eth.on?.('accountsChanged', onAccounts);
    return () => eth.removeListener?.('accountsChanged', onAccounts);
  }, []);

  const connectWallet = useCallback(async (): Promise<Address | null> => {
    if (typeof window === 'undefined' || !window.ethereum) return null;
    const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
    const primary = (accounts?.[0] as Address | undefined) ?? null;
    setWalletAddress(primary);
    return primary;
  }, []);

  const getWalletClient = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error(
        bi(
          'No Web3 wallet detected (install QoreX Wallet or MetaMask).',
          'No hay wallet Web3 disponible (instala QoreX Wallet o MetaMask).'
        )
      );
    }
    const account = walletAddress ?? (await connectWallet());
    if (!account) throw new Error(bi('Wallet not connected.', 'Wallet no conectada.'));
    return {
      account,
      client: createWalletClient({ account, chain, transport: custom(window.ethereum) }),
    };
  }, [chain, connectWallet, walletAddress]);

  /** Reads the window through the gateway (QoreChain REST has no CORS). Local chains: not enforced. */
  const refreshEvmWindow = useCallback(async (): Promise<EvmWindowStatus | null> => {
    if (!walletAddress || !env.gatewayUrl) {
      setEvmWindow(null);
      setEvmWindowEnforced(false);
      return null;
    }
    try {
      const res = await fetch(
        `${env.gatewayUrl.replace(/\/+$/, '')}/api/qore/evm-window/${walletAddress}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as Record<string, unknown>;
      if (body.enforced !== true) {
        setEvmWindowEnforced(false);
        setEvmWindow(null);
        return null;
      }
      const parsed = parseEvmWindow({
        ...body,
        remaining_txs: body.remainingTxs,
        remaining_blocks: body.remainingBlocks,
        remaining_value: body.remainingValue,
        expiry_height: body.expiryHeight,
        native_only: body.nativeOnly,
        allowed_targets: body.allowedTargets,
      });
      setEvmWindowEnforced(true);
      setEvmWindow(parsed);
      return parsed;
    } catch {
      // Unknown state: do not block the user on a transient read error; the node still enforces it
      setEvmWindow(null);
      return null;
    }
  }, [env.gatewayUrl, walletAddress]);

  useEffect(() => {
    void refreshEvmWindow();
    const timer = window.setInterval(() => void refreshEvmWindow(), 30_000);
    return () => window.clearInterval(timer);
  }, [refreshEvmWindow]);

  /**
   * Simulates first (surfaces the revert reason BEFORE prompting the wallet), sends, waits for the
   * receipt and throws unless `receipt.status === "success"`. Never reports a failed tx as success.
   */
  const write = useCallback(
    async <T = undefined>(
      functionName: WritableFunction,
      args: readonly unknown[],
      label: string
    ): Promise<TxResult<T>> => {
      if (!contractAddress)
        throw new Error(
          bi('VITE_SYNAPSE_VAULT_ADDRESS is not configured.', 'VITE_SYNAPSE_VAULT_ADDRESS no está configurada.')
        );
      if (!publicClient)
        throw new Error(
          bi('No RPC configured (VITE_QORECHAIN_RPC_URL).', 'No hay RPC configurado (VITE_QORECHAIN_RPC_URL).')
        );
      const wallet = await getWalletClient();
      // Bounded EVM window: refuse early (no wallet prompt) if the window cannot admit this call
      const win = evmWindowEnforced ? await refreshEvmWindow() : null;
      if (win) {
        const problem = windowBlocksTarget(win, contractAddress);
        if (problem) throw new Error(describeEvmWindowProblem(problem, contractAddress));
      }
      setIsTxPending(true);
      try {
        let simulated: { result: unknown; request: unknown };
        try {
          simulated = (await publicClient.simulateContract({
            account: wallet.account,
            address: contractAddress,
            abi: SYNAPSE_VAULT_ABI,
            functionName,
            args,
          } as never)) as { result: unknown; request: unknown };
        } catch (err) {
          throw new Error(describeTxError(err, contractAddress));
        }
        let hash: Hash;
        try {
          hash = await wallet.client.writeContract(simulated.request as never);
        } catch (err) {
          throw new Error(describeTxError(err, contractAddress));
        }
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') {
          throw new Error(
            bi(
              `Transaction ${label} reverted on-chain (tx ${hash.slice(0, 12)}…)`,
              `La transacción ${label} revirtió on-chain (tx ${hash.slice(0, 12)}…)`
            )
          );
        }
        setTxHistory((prev) => [
          { txHash: hash, action: label, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed, timestamp: Date.now() },
          ...prev.slice(0, 14),
        ]);
        void refreshEvmWindow(); // one tx of the window was consumed
        return { hash, result: simulated.result as T };
      } finally {
        setIsTxPending(false);
      }
    },
    [contractAddress, evmWindowEnforced, getWalletClient, publicClient, refreshEvmWindow]
  );

  const signMessage = useCallback(
    async (message: string): Promise<`0x${string}`> => {
      const wallet = await getWalletClient();
      return wallet.client.signMessage({ account: wallet.account, message });
    },
    [getWalletClient]
  );

  const queryKemPublicKeyOnChain = useCallback(
    async (account: Address): Promise<`0x${string}` | null> => {
      if (!contractAddress || !publicClient) return null;
      const hasKey = await publicClient.readContract({
        address: contractAddress,
        abi: SYNAPSE_VAULT_ABI,
        functionName: 'hasKemPublicKey',
        args: [account],
      });
      if (!hasKey) return null;
      return publicClient.readContract({
        address: contractAddress,
        abi: SYNAPSE_VAULT_ABI,
        functionName: 'getKemPublicKey',
        args: [account],
      });
    },
    [contractAddress, publicClient]
  );

  const getGrantMetadata = useCallback(
    async (recordId: `0x${string}`): Promise<OnChainGrantMetadata> => {
      if (!contractAddress || !publicClient)
        throw new Error(bi('Chain not configured.', 'Cadena no configurada.'));
      return publicClient.readContract({
        address: contractAddress,
        abi: SYNAPSE_VAULT_ABI,
        functionName: 'getGrantMetadata',
        args: [recordId],
      });
    },
    [contractAddress, publicClient]
  );

  /**
   * Reads every grant addressed to `specialist` straight from the contract:
   * getGrantsBySpecialist(specialist) then getGrantMetadata(id) for each id in parallel (plain
   * eth_calls: Diana/Anvil do not guarantee a Multicall3 deployment). Ids whose metadata read reverts are skipped
   * and reported in `failedIds`.
   */
  const getGrantsForSpecialist = useCallback(
    async (specialist: Address): Promise<SpecialistGrantsResult> => {
      if (!contractAddress || !publicClient)
        throw new Error(bi('Chain not configured.', 'Cadena no configurada.'));
      const ids = await publicClient.readContract({
        address: contractAddress,
        abi: SYNAPSE_VAULT_ABI,
        functionName: 'getGrantsBySpecialist',
        args: [specialist],
      });
      const uniqueIds = [...new Set(ids.map((id) => id.toLowerCase() as `0x${string}`))];
      const settled = await Promise.allSettled(
        uniqueIds.map((recordId) =>
          publicClient.readContract({
            address: contractAddress,
            abi: SYNAPSE_VAULT_ABI,
            functionName: 'getGrantMetadata',
            args: [recordId],
          })
        )
      );
      const grants: OnChainGrant[] = [];
      const failedIds: `0x${string}`[] = [];
      settled.forEach((r, i) => {
        if (r.status === 'fulfilled') grants.push({ ...r.value, recordId: uniqueIds[i] });
        else failedIds.push(uniqueIds[i]);
      });
      return { grants, failedIds };
    },
    [contractAddress, publicClient]
  );

  return {
    isConnected: Boolean(walletAddress),
    isChainConfigured: Boolean(contractAddress && publicClient),
    evmWindow,
    evmWindowEnforced,
    refreshEvmWindow,
    walletAddress,
    chainId: targetChainId,
    contractAddress,
    isTxPending,
    txHistory,
    connectWallet,
    signMessage,
    queryKemPublicKeyOnChain,
    getGrantMetadata,
    getGrantsForSpecialist,
    publishKemPublicKeyOnChain: (pubKeyHex: `0x${string}`) =>
      write('registerKemPublicKey', [pubKeyHex], 'registerKemPublicKey (ML-KEM-1024)'),
    grantTimedAccessOnChain: (p: {
      readonly salt: `0x${string}`;
      readonly contentHash: `0x${string}`;
      readonly envelopeHash: `0x${string}`;
      readonly linkedPartId: `0x${string}`;
      readonly specialist: Address;
      readonly domain: number;
      readonly durationInSeconds: bigint;
    }) =>
      write<`0x${string}`>(
        'grantTimedAccess',
        [p.salt, p.contentHash, p.envelopeHash, p.linkedPartId, p.specialist, p.domain, p.durationInSeconds],
        'grantTimedAccess'
      ),
    extendAccessOnChain: (recordId: `0x${string}`, extraSeconds: bigint) =>
      write('extendAccess', [recordId, extraSeconds], 'extendAccess'),
    revokeAccessOnChain: (recordId: `0x${string}`) =>
      write('revokeAccess', [recordId], 'revokeAccess'),
    emergencyRevokeAllOnChain: () =>
      write('emergencyRevokeAll', [], 'emergencyRevokeAll (KILL-SWITCH)'),
    registerBionicPartOnChain: (p: {
      readonly bearer: Address;
      readonly zone: number;
      readonly modelName: string;
      readonly serialNumber: string;
      readonly firmwareHash: `0x${string}`;
      readonly calibrationHash: `0x${string}`;
      readonly pqcSignature: `0x${string}`;
    }) =>
      write<`0x${string}`>(
        'registerBionicPart',
        [p.bearer, p.zone, p.modelName, p.serialNumber, p.firmwareHash, p.calibrationHash, p.pqcSignature],
        `registerBionicPart (${p.modelName})`
      ),
    logFirmwareUpdateOnChain: (p: {
      readonly partId: `0x${string}`;
      readonly newFirmwareHash: `0x${string}`;
      readonly newCalibrationHash: `0x${string}`;
      readonly pqcSignature: `0x${string}`;
    }) =>
      write(
        'logFirmwareUpdate',
        [p.partId, p.newFirmwareHash, p.newCalibrationHash, p.pqcSignature],
        'logFirmwareUpdate (ML-DSA-87)'
      ),
    updatePartStatusOnChain: (partId: `0x${string}`, newStatus: number) =>
      write('updatePartStatus', [partId, newStatus], 'updatePartStatus'),
  };
}

export type UseSynapseVaultResult = ReturnType<typeof useSynapseVault>;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { detectDappLocale } from '@/i18n/context';

export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isQoreX?: boolean;
  isQore?: boolean;
  isQoreChain?: boolean;
  isMetaMask?: boolean;
  isRabby?: boolean;
  isBraveWallet?: boolean;
  isCoinbaseWallet?: boolean;
  providers?: EthereumProvider[];
}

export interface Eip6963ProviderInfo {
  readonly uuid: string;
  readonly name: string;
  readonly icon: string;
  readonly rdns: string;
}

export interface DiscoveredWalletProvider {
  readonly id: string;
  readonly name: string;
  readonly rdns: string;
  readonly icon?: string;
  readonly isQoreX: boolean;
  readonly provider: EthereumProvider;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    qorex?: EthereumProvider & { ethereum?: EthereumProvider };
    qore?: EthereumProvider & { ethereum?: EthereumProvider };
    qorechain?: EthereumProvider & { ethereum?: EthereumProvider };
  }
}

const DISCONNECT_STORAGE_KEY = 'synapseq.wallet.disconnected';
const SELECTED_WALLET_STORAGE_KEY = 'synapseq.wallet.selectedId';

function isQoreXDescriptor(name?: string, rdns?: string, p?: EthereumProvider): boolean {
  const n = (name ?? '').toLowerCase();
  const r = (rdns ?? '').toLowerCase();
  return Boolean(
    p?.isQoreX ||
      p?.isQore ||
      p?.isQoreChain ||
      n.includes('qorex') ||
      n.includes('qore') ||
      r.includes('qorex') ||
      r.includes('qorechain') ||
      r.includes('qore')
  );
}

function inferLegacyProviderName(p: EthereumProvider): { id: string; name: string; rdns: string; isQoreX: boolean } {
  if (isQoreXDescriptor(undefined, undefined, p)) {
    return { id: 'io.qorechain.qorex', name: 'QoreX Wallet', rdns: 'io.qorechain.qorex', isQoreX: true };
  }
  if (p.isRabby) {
    return { id: 'io.rabby', name: 'Rabby Wallet', rdns: 'io.rabby', isQoreX: false };
  }
  if (p.isBraveWallet) {
    return { id: 'com.brave.wallet', name: 'Brave Wallet', rdns: 'com.brave.wallet', isQoreX: false };
  }
  if (p.isCoinbaseWallet) {
    return { id: 'com.coinbase.wallet', name: 'Coinbase Wallet', rdns: 'com.coinbase.wallet', isQoreX: false };
  }
  if (p.isMetaMask) {
    return { id: 'io.metamask', name: 'MetaMask', rdns: 'io.metamask', isQoreX: false };
  }
  return { id: 'injected.evm', name: 'Injected EVM Wallet', rdns: 'injected.evm', isQoreX: false };
}

function sortWalletsQoreXFirst(list: readonly DiscoveredWalletProvider[]): DiscoveredWalletProvider[] {
  return [...list].sort((a, b) => {
    if (a.isQoreX !== b.isQoreX) return a.isQoreX ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function collectLegacyProviders(): DiscoveredWalletProvider[] {
  if (typeof window === 'undefined') return [];
  const results: DiscoveredWalletProvider[] = [];
  const seenProviders = new Set<EthereumProvider>();

  const pushProvider = (raw: EthereumProvider | undefined, explicitQoreX = false) => {
    if (!raw || typeof raw.request !== 'function' || seenProviders.has(raw)) return;
    seenProviders.add(raw);
    const meta = explicitQoreX
      ? { id: 'io.qorechain.qorex', name: 'QoreX Wallet', rdns: 'io.qorechain.qorex', isQoreX: true }
      : inferLegacyProviderName(raw);
    results.push({
      id: meta.id,
      name: meta.name,
      rdns: meta.rdns,
      isQoreX: meta.isQoreX,
      provider: raw,
    });
  };

  // 1. Check dedicated QoreX global objects first
  const qorexCand = window.qorex?.ethereum ?? window.qorex ?? window.qore?.ethereum ?? window.qore ?? window.qorechain?.ethereum ?? window.qorechain;
  if (qorexCand) pushProvider(qorexCand, true);

  // 2. Check window.ethereum.providers array (when multiple extensions are installed)
  if (Array.isArray(window.ethereum?.providers)) {
    for (const sub of window.ethereum.providers) {
      pushProvider(sub, false);
    }
  }

  // 3. Fallback to window.ethereum
  if (window.ethereum) {
    pushProvider(window.ethereum, false);
  }

  return sortWalletsQoreXFirst(results);
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

  const [availableWallets, setAvailableWallets] = useState<readonly DiscoveredWalletProvider[]>(() =>
    collectLegacyProviders()
  );
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(SELECTED_WALLET_STORAGE_KEY);
  });
  const [walletAddress, setWalletAddress] = useState<Address | null>(null);
  const [isTxPending, setIsTxPending] = useState<boolean>(false);
  const [txHistory, setTxHistory] = useState<readonly OnChainTxReceiptInfo[]>([]);
  /** QoreChain EVM authorisation window of the connected wallet (null = unknown / not enforced). */
  const [evmWindow, setEvmWindow] = useState<EvmWindowStatus | null>(null);
  const [evmWindowEnforced, setEvmWindowEnforced] = useState<boolean>(false);

  const eip6963MapRef = useRef<Map<string, DiscoveredWalletProvider>>(new Map());

  // Discover wallets via EIP-6963 + legacy providers, always sorting QoreX first
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const rebuildWalletList = () => {
      const eip6963List = [...eip6963MapRef.current.values()];
      const legacyList = collectLegacyProviders();
      const merged: DiscoveredWalletProvider[] = [...eip6963List];
      const seenProviders = new Set(eip6963List.map((w) => w.provider));
      const seenRdns = new Set(eip6963List.map((w) => w.rdns.toLowerCase()));

      for (const leg of legacyList) {
        if (seenProviders.has(leg.provider)) continue;
        if (leg.isQoreX && [...eip6963List].some((w) => w.isQoreX)) continue;
        if (seenRdns.has(leg.rdns.toLowerCase())) continue;
        merged.push(leg);
      }

      const sorted = sortWalletsQoreXFirst(merged);
      setAvailableWallets(sorted);
    };

    const onAnnounce = (ev: Event) => {
      const customEv = ev as CustomEvent<{ info?: Eip6963ProviderInfo; provider?: EthereumProvider }>;
      const info = customEv.detail?.info;
      const provider = customEv.detail?.provider;
      if (!info || !provider || typeof provider.request !== 'function') return;
      const isQoreX = isQoreXDescriptor(info.name, info.rdns, provider);
      const id = info.rdns || info.uuid;
      eip6963MapRef.current.set(id, {
        id,
        name: info.name || (isQoreX ? 'QoreX Wallet' : 'EVM Wallet'),
        rdns: info.rdns || id,
        icon: info.icon,
        isQoreX,
        provider,
      });
      rebuildWalletList();
    };

    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    rebuildWalletList();

    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
    };
  }, []);

  /**
   * Resolves the active wallet entry:
   * 1. Explicit user choice (if present in availableWallets)
   * 2. QoreX Wallet (default priority!)
   * 3. First available injected wallet
   */
  const activeWalletEntry = useMemo<DiscoveredWalletProvider | null>(() => {
    if (availableWallets.length === 0) return null;
    if (selectedWalletId) {
      const explicit = availableWallets.find((w) => w.id === selectedWalletId || w.rdns === selectedWalletId);
      if (explicit) return explicit;
    }
    const qorex = availableWallets.find((w) => w.isQoreX);
    if (qorex) return qorex;
    return availableWallets[0];
  }, [availableWallets, selectedWalletId]);

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
    if (activeWalletEntry?.provider) {
      return createPublicClient({ chain, transport: custom(activeWalletEntry.provider) });
    }
    if (typeof window !== 'undefined' && window.ethereum) {
      return createPublicClient({ chain, transport: custom(window.ethereum) });
    }
    return null;
  }, [activeWalletEntry, env.qorechainRpcUrl, chain]);

  // Track the active provider's account unless the user explicitly disconnected
  useEffect(() => {
    const provider = activeWalletEntry?.provider;
    if (!provider || typeof window === 'undefined') return;

    const isDisconnected = window.localStorage.getItem(DISCONNECT_STORAGE_KEY) === 'true';
    if (!isDisconnected) {
      provider
        .request({ method: 'eth_accounts' })
        .then((accounts) => {
          if (Array.isArray(accounts) && typeof accounts[0] === 'string') {
            setWalletAddress(accounts[0] as Address);
          }
        })
        .catch(() => undefined);
    }

    const onAccounts = (...args: unknown[]) => {
      if (window.localStorage.getItem(DISCONNECT_STORAGE_KEY) === 'true') return;
      const accounts = args[0];
      setWalletAddress(
        Array.isArray(accounts) && typeof accounts[0] === 'string' ? (accounts[0] as Address) : null
      );
    };
    provider.on?.('accountsChanged', onAccounts);
    return () => provider.removeListener?.('accountsChanged', onAccounts);
  }, [activeWalletEntry]);

  const selectWallet = useCallback((walletId: string) => {
    setSelectedWalletId(walletId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SELECTED_WALLET_STORAGE_KEY, walletId);
    }
  }, []);

  const connectWallet = useCallback(
    async (preferredWalletId?: string): Promise<Address | null> => {
      if (typeof window === 'undefined') return null;

      let entry: DiscoveredWalletProvider | null = null;
      if (preferredWalletId) {
        entry =
          availableWallets.find((w) => w.id === preferredWalletId || w.rdns === preferredWalletId) ?? null;
        if (entry) {
          setSelectedWalletId(entry.id);
          window.localStorage.setItem(SELECTED_WALLET_STORAGE_KEY, entry.id);
        }
      }
      if (!entry) {
        // Default priority: QoreX first, then user's previous selection, then first available
        const qorex = availableWallets.find((w) => w.isQoreX);
        entry = qorex ?? activeWalletEntry;
        if (entry) {
          setSelectedWalletId(entry.id);
          window.localStorage.setItem(SELECTED_WALLET_STORAGE_KEY, entry.id);
        }
      }

      const provider = entry?.provider ?? window.ethereum;
      if (!provider) return null;

      window.localStorage.removeItem(DISCONNECT_STORAGE_KEY);
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
      const primary = (accounts?.[0] as Address | undefined) ?? null;
      setWalletAddress(primary);
      return primary;
    },
    [activeWalletEntry, availableWallets]
  );

  const disconnectWallet = useCallback(async (): Promise<void> => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISCONNECT_STORAGE_KEY, 'true');
    }
    const provider = activeWalletEntry?.provider;
    if (provider) {
      // Best-effort EIP-2255 permission revocation (supported by modern wallets; ignored if unsupported)
      try {
        await provider.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // Wallets like QoreX or older extensions that don't implement wallet_revokePermissions simply clear local session
      }
    }
    setWalletAddress(null);
    setEvmWindow(null);
    setEvmWindowEnforced(false);
  }, [activeWalletEntry]);

  const getWalletClient = useCallback(async () => {
    const provider = activeWalletEntry?.provider ?? (typeof window !== 'undefined' ? window.ethereum : undefined);
    if (!provider) {
      throw new Error(
        bi(
          'No Web3 wallet detected (install QoreX Wallet or MetaMask).',
          'No hay wallet Web3 disponible (instala QoreX Wallet o MetaMask).'
        )
      );
    }
    const account = walletAddress ?? (await connectWallet(activeWalletEntry?.id));
    if (!account) throw new Error(bi('Wallet not connected.', 'Wallet no conectada.'));
    return {
      account,
      client: createWalletClient({ account, chain, transport: custom(provider) }),
    };
  }, [activeWalletEntry, chain, connectWallet, walletAddress]);

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
    availableWallets,
    activeWallet: activeWalletEntry,
    selectWallet,
    evmWindow,
    evmWindowEnforced,
    refreshEvmWindow,
    walletAddress,
    chainId: targetChainId,
    contractAddress,
    isTxPending,
    txHistory,
    connectWallet,
    disconnectWallet,
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

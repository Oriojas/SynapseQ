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
  readonly patient: Address;
  readonly specialist: Address;
  readonly validUntil: bigint;
  readonly revoked: boolean;
  readonly isActive: boolean;
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

/** Turns viem errors into a short, user-readable message (custom error name when available). */
export function describeTxError(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      return `La transacción revertiría: ${revert.data?.errorName ?? revert.reason ?? 'revert'}`;
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
      throw new Error('No hay wallet Web3 disponible (instala QoreX Wallet o MetaMask).');
    }
    const account = walletAddress ?? (await connectWallet());
    if (!account) throw new Error('Wallet no conectada.');
    return {
      account,
      client: createWalletClient({ account, chain, transport: custom(window.ethereum) }),
    };
  }, [chain, connectWallet, walletAddress]);

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
      if (!contractAddress) throw new Error('VITE_SYNAPSE_VAULT_ADDRESS no está configurada.');
      if (!publicClient) throw new Error('No hay RPC configurado (VITE_QORECHAIN_RPC_URL).');
      const wallet = await getWalletClient();
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
          throw new Error(describeTxError(err));
        }
        const hash = await wallet.client.writeContract(simulated.request as never);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') {
          throw new Error(`La transacción ${label} revirtió on-chain (tx ${hash.slice(0, 12)}…)`);
        }
        setTxHistory((prev) => [
          { txHash: hash, action: label, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed, timestamp: Date.now() },
          ...prev.slice(0, 14),
        ]);
        return { hash, result: simulated.result as T };
      } finally {
        setIsTxPending(false);
      }
    },
    [contractAddress, getWalletClient, publicClient]
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
      if (!contractAddress || !publicClient) throw new Error('Cadena no configurada.');
      return publicClient.readContract({
        address: contractAddress,
        abi: SYNAPSE_VAULT_ABI,
        functionName: 'getGrantMetadata',
        args: [recordId],
      });
    },
    [contractAddress, publicClient]
  );

  return {
    isConnected: Boolean(walletAddress),
    isChainConfigured: Boolean(contractAddress && publicClient),
    walletAddress,
    chainId: targetChainId,
    contractAddress,
    isTxPending,
    txHistory,
    connectWallet,
    signMessage,
    queryKemPublicKeyOnChain,
    getGrantMetadata,
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

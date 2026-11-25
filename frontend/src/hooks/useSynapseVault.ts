import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  readonly timestamp: number;
}

export interface UseSynapseVaultResult {
  readonly isConnected: boolean;
  readonly walletAddress: Address | null;
  readonly chainId: number;
  readonly contractAddress: Address | undefined;
  readonly isTxPending: boolean;
  readonly txHistory: readonly OnChainTxReceiptInfo[];
  readonly connectWallet: () => Promise<Address | null>;
  readonly publishKemPublicKeyOnChain: (pubKeyHex: `0x${string}`) => Promise<Hash | null>;
  readonly queryKemPublicKeyOnChain: (account: Address) => Promise<`0x${string}` | null>;
  readonly grantTimedAccessOnChain: (params: {
    readonly recordId: `0x${string}`;
    readonly ipfsCID: string;
    readonly contentHash: `0x${string}`;
    readonly linkedPartId: `0x${string}`;
    readonly specialist: Address;
    readonly encryptedKeyEnvelope: `0x${string}`;
    readonly domain: number;
    readonly durationInSeconds: bigint;
  }) => Promise<Hash | null>;
  readonly extendAccessOnChain: (recordId: `0x${string}`, extraSeconds: bigint) => Promise<Hash | null>;
  readonly revokeAccessOnChain: (recordId: `0x${string}`) => Promise<Hash | null>;
  readonly emergencyRevokeAllOnChain: () => Promise<Hash | null>;
  readonly registerBionicPartOnChain: (params: {
    readonly partId: `0x${string}`;
    readonly manufacturer: Address;
    readonly zone: number;
    readonly modelName: string;
    readonly serialNumber: string;
    readonly firmwareHash: `0x${string}`;
    readonly calibrationHash: `0x${string}`;
    readonly pqcSignature: `0x${string}`;
  }) => Promise<Hash | null>;
  readonly logFirmwareUpdateOnChain: (params: {
    readonly partId: `0x${string}`;
    readonly newFirmwareHash: `0x${string}`;
    readonly newCalibrationHash: `0x${string}`;
    readonly pqcSignature: `0x${string}`;
  }) => Promise<Hash | null>;
  readonly updatePartStatusOnChain: (partId: `0x${string}`, newStatus: number) => Promise<Hash | null>;
}

export function useSynapseVault(): UseSynapseVaultResult {
  const env = useMemo(() => getFrontendEnvConfig(), []);
  const targetChainId = env.qorechainChainId || 9800;
  const contractAddress = env.synapseVaultAddress;

  const [walletAddress, setWalletAddress] = useState<Address | null>(null);
  const [isTxPending, setIsTxPending] = useState<boolean>(false);
  const [txHistory, setTxHistory] = useState<readonly OnChainTxReceiptInfo[]>([]);

  const qorechainDiana = useMemo(() => {
    const rpcUrl = env.qorechainRpcUrl;
    return defineChain({
      id: targetChainId,
      name: 'QoreChain Diana Testnet',
      nativeCurrency: { name: 'QOR', symbol: 'QOR', decimals: 18 },
      rpcUrls: {
        default: { http: rpcUrl ? [rpcUrl] : [] },
      },
    });
  }, [env.qorechainRpcUrl, targetChainId]);

  const publicClient = useMemo(() => {
    if (env.qorechainRpcUrl) {
      return createPublicClient({
        chain: qorechainDiana,
        transport: http(env.qorechainRpcUrl),
      });
    }
    if (typeof window !== 'undefined' && window.ethereum) {
      return createPublicClient({
        chain: qorechainDiana,
        transport: custom(window.ethereum),
      });
    }
    return null;
  }, [env.qorechainRpcUrl, qorechainDiana]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts) => {
        if (Array.isArray(accounts) && typeof accounts[0] === 'string') {
          setWalletAddress(accounts[0] as Address);
        }
      })
      .catch(() => {
        // Silent if wallet is locked
      });
  }, []);

  const connectWallet = useCallback(async (): Promise<Address | null> => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return null;
    }
    const accounts = (await window.ethereum.request({
      method: 'eth_requestAccounts',
    })) as string[];
    const primary = (accounts?.[0] as Address | undefined) ?? null;
    setWalletAddress(primary);
    return primary;
  }, []);

  const getWalletClient = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return null;
    }
    const activeAccount = walletAddress ?? (await connectWallet());
    if (!activeAccount) return null;

    return {
      account: activeAccount,
      client: createWalletClient({
        account: activeAccount,
        chain: qorechainDiana,
        transport: custom(window.ethereum),
      }),
    };
  }, [connectWallet, qorechainDiana, walletAddress]);

  const recordTx = useCallback((txHash: Hash, action: string, blockNumber?: bigint) => {
    setTxHistory((prev) => [
      { txHash, action, blockNumber, timestamp: Date.now() },
      ...prev.slice(0, 14),
    ]);
  }, []);

  const publishKemPublicKeyOnChain = useCallback(
    async (pubKeyHex: `0x${string}`): Promise<Hash | null> => {
      if (!contractAddress) return null;
      const wallet = await getWalletClient();
      if (!wallet) return null;

      setIsTxPending(true);
      try {
        const hash = await wallet.client.writeContract({
          address: contractAddress,
          abi: SYNAPSE_VAULT_ABI,
          functionName: 'registerKemPublicKey',
          args: [pubKeyHex],
          account: wallet.account,
          chain: qorechainDiana,
        });
        const receipt = publicClient
          ? await publicClient.waitForTransactionReceipt({ hash })
          : undefined;
        recordTx(hash, 'registerKemPublicKey (ML-KEM-1024)', receipt?.blockNumber);
        return hash;
      } finally {
        setIsTxPending(false);
      }
    },
    [contractAddress, getWalletClient, publicClient, qorechainDiana, recordTx]
  );

  const queryKemPublicKeyOnChain = useCallback(
    async (account: Address): Promise<`0x${string}` | null> => {
      if (!contractAddress || !publicClient) return null;
      try {
        const hasKey = await publicClient.readContract({
          address: contractAddress,
          abi: SYNAPSE_VAULT_ABI,
          functionName: 'hasKemPublicKey',
          args: [account],
        });
        if (!hasKey) return null;
        const pubKey = await publicClient.readContract({
          address: contractAddress,
          abi: SYNAPSE_VAULT_ABI,
          functionName: 'getKemPublicKey',
          args: [account],
        });
        return pubKey;
      } catch {
        return null;
      }
    },
    [contractAddress, publicClient]
  );

  const grantTimedAccessOnChain = useCallback(
    async (params: {
      readonly recordId: `0x${string}`;
      readonly ipfsCID: string;
      readonly contentHash: `0x${string}`;
      readonly linkedPartId: `0x${string}`;
      readonly specialist: Address;
      readonly encryptedKeyEnvelope: `0x${string}`;
      readonly domain: number;
      readonly durationInSeconds: bigint;
    }): Promise<Hash | null> => {
      if (!contractAddress) return null;
      const wallet = await getWalletClient();
      if (!wallet) return null;

      setIsTxPending(true);
      try {
        const hash = await wallet.client.writeContract({
          address: contractAddress,
          abi: SYNAPSE_VAULT_ABI,
          functionName: 'grantTimedAccess',
          args: [
            params.recordId,
            params.ipfsCID,
            params.contentHash,
            params.linkedPartId,
            params.specialist,
            params.encryptedKeyEnvelope,
            params.domain,
            params.durationInSeconds,
          ],
          account: wallet.account,
          chain: qorechainDiana,
        });
        const receipt = publicClient
          ? await publicClient.waitForTransactionReceipt({ hash })
          : undefined;
        recordTx(hash, 'grantTimedAccess (ML-KEM-1024 Pass)', receipt?.blockNumber);
        return hash;
      } finally {
        setIsTxPending(false);
      }
    },
    [contractAddress, getWalletClient, publicClient, qorechainDiana, recordTx]
  );

  const extendAccessOnChain = useCallback(
    async (recordId: `0x${string}`, extraSeconds: bigint): Promise<Hash | null> => {
      if (!contractAddress) return null;
      const wallet = await getWalletClient();
      if (!wallet) return null;

      setIsTxPending(true);
      try {
        const hash = await wallet.client.writeContract({
          address: contractAddress,
          abi: SYNAPSE_VAULT_ABI,
          functionName: 'extendAccess',
          args: [recordId, extraSeconds],
          account: wallet.account,
          chain: qorechainDiana,
        });
        const receipt = publicClient
          ? await publicClient.waitForTransactionReceipt({ hash })
          : undefined;
        recordTx(hash, 'extendAccess', receipt?.blockNumber);
        return hash;
      } finally {
        setIsTxPending(false);
      }
    },
    [contractAddress, getWalletClient, publicClient, qorechainDiana, recordTx]
  );

  const revokeAccessOnChain = useCallback(
    async (recordId: `0x${string}`): Promise<Hash | null> => {
      if (!contractAddress) return null;
      const wallet = await getWalletClient();
      if (!wallet) return null;

      setIsTxPending(true);
      try {
        const hash = await wallet.client.writeContract({
          address: contractAddress,
          abi: SYNAPSE_VAULT_ABI,
          functionName: 'revokeAccess',
          args: [recordId],
          account: wallet.account,
          chain: qorechainDiana,
        });
        const receipt = publicClient
          ? await publicClient.waitForTransactionReceipt({ hash })
          : undefined;
        recordTx(hash, 'revokeAccess', receipt?.blockNumber);
        return hash;
      } finally {
        setIsTxPending(false);
      }
    },
    [contractAddress, getWalletClient, publicClient, qorechainDiana, recordTx]
  );

  const emergencyRevokeAllOnChain = useCallback(async (): Promise<Hash | null> => {
    if (!contractAddress) return null;
    const wallet = await getWalletClient();
    if (!wallet) return null;

    setIsTxPending(true);
    try {
      const hash = await wallet.client.writeContract({
        address: contractAddress,
        abi: SYNAPSE_VAULT_ABI,
        functionName: 'emergencyRevokeAll',
        account: wallet.account,
        chain: qorechainDiana,
      });
      const receipt = publicClient
        ? await publicClient.waitForTransactionReceipt({ hash })
        : undefined;
      recordTx(hash, 'emergencyRevokeAll (KILL-SWITCH)', receipt?.blockNumber);
      return hash;
    } finally {
      setIsTxPending(false);
    }
  }, [contractAddress, getWalletClient, publicClient, qorechainDiana, recordTx]);

  const registerBionicPartOnChain = useCallback(
    async (params: {
      readonly partId: `0x${string}`;
      readonly manufacturer: Address;
      readonly zone: number;
      readonly modelName: string;
      readonly serialNumber: string;
      readonly firmwareHash: `0x${string}`;
      readonly calibrationHash: `0x${string}`;
      readonly pqcSignature: `0x${string}`;
    }): Promise<Hash | null> => {
      if (!contractAddress) return null;
      const wallet = await getWalletClient();
      if (!wallet) return null;

      setIsTxPending(true);
      try {
        const hash = await wallet.client.writeContract({
          address: contractAddress,
          abi: SYNAPSE_VAULT_ABI,
          functionName: 'registerBionicPart',
          args: [
            params.partId,
            params.manufacturer,
            params.zone,
            params.modelName,
            params.serialNumber,
            params.firmwareHash,
            params.calibrationHash,
            params.pqcSignature,
          ],
          account: wallet.account,
          chain: qorechainDiana,
        });
        const receipt = publicClient
          ? await publicClient.waitForTransactionReceipt({ hash })
          : undefined;
        recordTx(hash, `registerBionicPart (${params.modelName})`, receipt?.blockNumber);
        return hash;
      } finally {
        setIsTxPending(false);
      }
    },
    [contractAddress, getWalletClient, publicClient, qorechainDiana, recordTx]
  );

  const logFirmwareUpdateOnChain = useCallback(
    async (params: {
      readonly partId: `0x${string}`;
      readonly newFirmwareHash: `0x${string}`;
      readonly newCalibrationHash: `0x${string}`;
      readonly pqcSignature: `0x${string}`;
    }): Promise<Hash | null> => {
      if (!contractAddress) return null;
      const wallet = await getWalletClient();
      if (!wallet) return null;

      setIsTxPending(true);
      try {
        const hash = await wallet.client.writeContract({
          address: contractAddress,
          abi: SYNAPSE_VAULT_ABI,
          functionName: 'logFirmwareUpdate',
          args: [
            params.partId,
            params.newFirmwareHash,
            params.newCalibrationHash,
            params.pqcSignature,
          ],
          account: wallet.account,
          chain: qorechainDiana,
        });
        const receipt = publicClient
          ? await publicClient.waitForTransactionReceipt({ hash })
          : undefined;
        recordTx(hash, 'logFirmwareUpdate (ML-DSA-87)', receipt?.blockNumber);
        return hash;
      } finally {
        setIsTxPending(false);
      }
    },
    [contractAddress, getWalletClient, publicClient, qorechainDiana, recordTx]
  );

  const updatePartStatusOnChain = useCallback(
    async (partId: `0x${string}`, newStatus: number): Promise<Hash | null> => {
      if (!contractAddress) return null;
      const wallet = await getWalletClient();
      if (!wallet) return null;

      setIsTxPending(true);
      try {
        const hash = await wallet.client.writeContract({
          address: contractAddress,
          abi: SYNAPSE_VAULT_ABI,
          functionName: 'updatePartStatus',
          args: [partId, newStatus],
          account: wallet.account,
          chain: qorechainDiana,
        });
        const receipt = publicClient
          ? await publicClient.waitForTransactionReceipt({ hash })
          : undefined;
        recordTx(hash, 'updatePartStatus', receipt?.blockNumber);
        return hash;
      } finally {
        setIsTxPending(false);
      }
    },
    [contractAddress, getWalletClient, publicClient, qorechainDiana, recordTx]
  );

  return {
    isConnected: Boolean(walletAddress),
    walletAddress,
    chainId: targetChainId,
    contractAddress,
    isTxPending,
    txHistory,
    connectWallet,
    publishKemPublicKeyOnChain,
    queryKemPublicKeyOnChain,
    grantTimedAccessOnChain,
    extendAccessOnChain,
    revokeAccessOnChain,
    emergencyRevokeAllOnChain,
    registerBionicPartOnChain,
    logFirmwareUpdateOnChain,
    updatePartStatusOnChain,
  };
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bytesToHex, hexToBytes, type Address } from 'viem';
import { ShieldAlert, Cpu, KeyRound, Activity, Radio, Wallet, CheckCircle2 } from 'lucide-react';
import {
  computeEnvelopeHash,
  computeShake256,
  deriveKemKeyPairFromSignature,
  encryptAndSealDocument,
  generateDsaKeyPair,
  generateKemKeyPair,
  KEM_DERIVATION_MESSAGE,
  unsealAndDecryptDocument,
} from '@sdk/pqc';
import {
  buildGatewayAuthMessage,
  computeRecordId,
  downloadBlobViaGateway,
  pinEncryptedBlobViaGateway,
  releaseProtectedEnvelope,
  requestGatewayNonce,
  storeProtectedEnvelope,
  type GatewayAuthAction,
} from '@sdk/gatewayClient';
import { fetchEncryptedBlobFromIpfs } from '@sdk/storage';
import { TacticalGpsBackground } from '@/components/layout/TacticalGpsBackground';
import { PatientVaultView, type SealGrantRequest } from '@/components/patient/PatientVaultView';
import { CyberHbomView } from '@/components/hbom/CyberHbomView';
import {
  SpecialistPortalView,
  type ChainGrantSyncState,
  type UnsealResult,
} from '@/components/specialist/SpecialistPortalView';
import { getFrontendEnvConfig } from '@/config/env';
import { useSynapseVault, type OnChainGrant } from '@/hooks/useSynapseVault';
import {
  INITIAL_BIONIC_PARTS,
  INITIAL_EPHEMERAL_PASSES,
  INITIAL_FIRMWARE_HISTORY,
  type MockBionicPart,
  type MockEphemeralPass,
  type MockFirmwareHistoryEntry,
  type PartStatusLabel,
} from '@/data/mockData';

type ActiveTab = 'patient-vault' | 'cyber-hbom' | 'specialist-portal';
type BannerTone = 'ok' | 'warn' | 'error';

interface CachedSealedPayload {
  readonly encryptedBlob: Uint8Array;
  readonly envelopeHex: `0x${string}`;
  readonly contentHash: `0x${string}`;
}

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function randomBytes32(): `0x${string}` {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Remaining seconds of an on-chain grant; the contract's isActive is the authority. */
function remainingFromChain(grant: OnChainGrant): number {
  if (!grant.isActive) return 0;
  const left = Number(grant.validUntil) - Math.floor(Date.now() / 1000);
  return Math.max(1, left);
}

/**
 * Builds a pass from on-chain metadata only. Anything the chain does not store (title, CID,
 * storage provider, telemetry) is an explicit placeholder, never invented data.
 */
function passFromChainGrant(
  grant: OnChainGrant,
  parts: readonly MockBionicPart[]
): MockEphemeralPass {
  const linkedPart =
    grant.linkedPartId === ZERO_BYTES32
      ? undefined
      : parts.find((p) => p.partId.toLowerCase() === grant.linkedPartId.toLowerCase());
  return {
    id: `OC-${grant.recordId.slice(2, 10).toUpperCase()}`,
    recordIdHex: grant.recordId,
    title: 'Pase on-chain',
    specialistName: 'Tu wallet (especialista)',
    specialistAddress: grant.specialist,
    patientPseudonym: shortAddress(grant.patient),
    domain: grant.domain === 1 ? 'BIONIC_TELEMETRY' : 'CLINICAL',
    retention: 'ephemeral',
    storageProvider: 'gateway-custody',
    isSample: false,
    onChain: true,
    fromChainScan: true,
    linkedPartName:
      grant.linkedPartId === ZERO_BYTES32
        ? 'Unlinked Clinical Shard'
        : linkedPart
          ? `${linkedPart.modelName} (${linkedPart.serialNumber})`
          : `Pieza ${grant.linkedPartId.slice(0, 10)}…`,
    linkedPartId: grant.linkedPartId,
    contentHash: grant.contentHash,
    ipfsCid: '(se obtiene del gateway)',
    remainingSeconds: remainingFromChain(grant),
    revoked: grant.revoked,
    gpsSector: '—',
    metrics: null,
  };
}

/**
 * On-chain HBOM writes need the manufacturer's REGISTERED ML-DSA-87 key: the contract verifies
 * the attestation with QoreChain's pqcVerify precompile. Web wallets (QoreX/MetaMask) do not expose
 * ML-DSA message signing, so those writes go through the OEM tool, not the browser.
 */
const OEM_TOOL_HINT =
  'En modo on-chain el contrato verifica la firma ML-DSA-87 del fabricante con pqcVerify, y la wallet web no puede firmar con ML-DSA. Usa la herramienta OEM: `cd sdk && OEM_MNEMONIC="…" SYNAPSE_VAULT_ADDRESS=… npm run oem -- register --serial … --model … --bearer 0x… --firmware …`';

export function App(): React.JSX.Element {
  const env = useMemo(() => getFrontendEnvConfig(), []);
  const vault = useSynapseVault();

  const [activeTab, setActiveTab] = useState<ActiveTab>('patient-vault');
  // Hard-coded examples are flagged so they are never presented as on-chain data
  const [passes, setPasses] = useState<readonly MockEphemeralPass[]>(() =>
    INITIAL_EPHEMERAL_PASSES.map((p) => ({ ...p, isSample: true }))
  );
  const [bionicParts, setBionicParts] = useState<readonly MockBionicPart[]>(() =>
    INITIAL_BIONIC_PARTS.map((p) => ({ ...p, isSample: true }))
  );
  const [firmwareHistory, setFirmwareHistory] = useState<readonly MockFirmwareHistoryEntry[]>(
    INITIAL_FIRMWARE_HISTORY
  );

  // Specialist ML-KEM-1024 key: random (ephemeral) until derived from the wallet's signature
  const [specialistKemKeyPair, setSpecialistKemKeyPair] = useState(() => generateKemKeyPair());
  const [keySource, setKeySource] = useState<'wallet' | 'ephemeral'>('ephemeral');
  const [oemDsaKeyPair] = useState(() => generateDsaKeyPair());
  const [isKeyPublishedOnChain, setIsKeyPublishedOnChain] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [bannerTone, setBannerTone] = useState<BannerTone>('ok');

  const localCacheRef = useRef<Map<string, CachedSealedPayload>>(new Map());
  const [chainSync, setChainSync] = useState<ChainGrantSyncState>({ status: 'off', count: 0, skipped: 0 });
  const chainSyncSeqRef = useRef(0);

  const specialistKemPublicKeyHex = useMemo(
    () => bytesToHex(specialistKemKeyPair.publicKey),
    [specialistKemKeyPair]
  );

  const chainMode = vault.isConnected && vault.isChainConfigured;
  const liveMode = chainMode && Boolean(env.gatewayUrl);

  const notify = useCallback((text: string, tone: BannerTone = 'ok') => {
    setStatusBanner(text);
    setBannerTone(tone);
  }, []);

  // Live 1-second countdown ticker
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPasses((prev) =>
        prev.map((p) =>
          !p.revoked && p.remainingSeconds > 0 ? { ...p, remainingSeconds: p.remainingSeconds - 1 } : p
        )
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // A wallet-derived key belongs to one account: drop it when the account changes
  useEffect(() => {
    setKeySource('ephemeral');
    setSpecialistKemKeyPair(generateKemKeyPair());
  }, [vault.walletAddress]);

  // The "registered on-chain" badge reflects the real directory, never an assumption
  const { queryKemPublicKeyOnChain } = vault;
  useEffect(() => {
    let mounted = true;
    if (!vault.walletAddress || !vault.isChainConfigured) {
      setIsKeyPublishedOnChain(false);
      return;
    }
    queryKemPublicKeyOnChain(vault.walletAddress)
      .then((onChain) => {
        if (mounted) {
          setIsKeyPublishedOnChain(
            Boolean(onChain) && onChain?.toLowerCase() === specialistKemPublicKeyHex.toLowerCase()
          );
        }
      })
      .catch(() => mounted && setIsKeyPublishedOnChain(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault.walletAddress, vault.isChainConfigured, specialistKemPublicKeyHex]);

  // ---------------------------------------------------------------------------
  // Specialist inbox: passes granted to the connected wallet, read from the chain
  // ---------------------------------------------------------------------------
  const { getGrantsForSpecialist } = vault;
  const walletAddress = vault.walletAddress;
  const bionicPartsRef = useRef(bionicParts);
  bionicPartsRef.current = bionicParts;

  const refreshSpecialistGrants = useCallback(async () => {
    const seq = ++chainSyncSeqRef.current;
    if (!chainMode || !walletAddress) {
      // Passes discovered for another (or no) wallet are not this viewer's: drop them
      setPasses((prev) => prev.filter((p) => !p.fromChainScan));
      setChainSync({ status: 'off', count: 0, skipped: 0 });
      return;
    }
    const wallet = walletAddress.toLowerCase();
    setChainSync((prev) => ({ ...prev, status: 'loading', error: undefined }));
    try {
      const { grants, failedIds } = await getGrantsForSpecialist(walletAddress);
      if (seq !== chainSyncSeqRef.current) return; // a newer scan (e.g. wallet switch) won
      const byId = new Map(grants.map((g) => [g.recordId.toLowerCase(), g]));
      setPasses((prev) => {
        const kept = prev
          .filter((p) => !p.fromChainScan || p.specialistAddress.toLowerCase() === wallet)
          .map((p) => {
            const g = byId.get(p.recordIdHex.toLowerCase());
            // Already known (e.g. created in this tab): keep its richer fields, take state from chain
            return g && p.onChain ? { ...p, revoked: g.revoked, remainingSeconds: remainingFromChain(g) } : p;
          });
        const known = new Set(kept.map((p) => p.recordIdHex.toLowerCase()));
        const discovered = grants
          .filter((g) => !known.has(g.recordId.toLowerCase()))
          .sort((a, b) => Number(b.createdAt - a.createdAt))
          .map((g) => passFromChainGrant(g, bionicPartsRef.current));
        return [...discovered, ...kept];
      });
      setChainSync({ status: 'ok', count: grants.length, skipped: failedIds.length, syncedAt: Date.now() });
    } catch (err) {
      if (seq !== chainSyncSeqRef.current) return;
      setChainSync((prev) => ({ ...prev, status: 'error', error: errorText(err) }));
    }
  }, [chainMode, getGrantsForSpecialist, walletAddress]);

  useEffect(() => {
    void refreshSpecialistGrants();
  }, [refreshSpecialistGrants]);

  const handleConnectWallet = useCallback(async () => {
    try {
      const addr = await vault.connectWallet();
      if (!addr) {
        notify('No se detectó wallet. La app queda en MODO DEMO LOCAL (nada se registra on-chain).', 'warn');
        return;
      }
      if (!vault.isChainConfigured) {
        notify(`Wallet ${addr} conectada, pero falta VITE_QORECHAIN_RPC_URL o VITE_SYNAPSE_VAULT_ADDRESS.`, 'warn');
      } else if (!env.gatewayUrl) {
        notify(`Wallet ${addr} conectada. Falta VITE_GATEWAY_URL: los pases no pueden custodiarse.`, 'warn');
      } else {
        notify(`Wallet ${addr} conectada a QoreChain (${vault.chainId}). Modo ON-CHAIN activo.`);
      }
    } catch (err) {
      notify(`Error al conectar wallet: ${errorText(err)}`, 'error');
    }
  }, [env.gatewayUrl, notify, vault]);

  /** Signs a gateway challenge with the connected wallet. */
  const gatewayAuth = useCallback(
    async (action: GatewayAuthAction, recordId?: `0x${string}`) => {
      if (!env.gatewayUrl || !vault.walletAddress) throw new Error('Gateway o wallet no disponibles.');
      const address = vault.walletAddress;
      const { nonce, chainId } = await requestGatewayNonce(env.gatewayUrl, address);
      const signature = await vault.signMessage(
        buildGatewayAuthMessage({ action, address, nonce, chainId, recordId })
      );
      return { nonce, signature };
    },
    [env.gatewayUrl, vault]
  );

  const deriveWalletKemKey = useCallback(async () => {
    const signature = await vault.signMessage(KEM_DERIVATION_MESSAGE);
    const pair = deriveKemKeyPairFromSignature(signature);
    setSpecialistKemKeyPair(pair);
    setKeySource('wallet');
    return pair;
  }, [vault]);

  // ---------------------------------------------------------------------------
  // Patient: seal + grant
  // ---------------------------------------------------------------------------
  const handleSealAndGrant = useCallback(
    async (req: SealGrantRequest) => {
      const passId = `EQ-${Math.floor(1000 + Math.random() * 8999)}`;
      const base = {
        id: passId,
        title: req.title,
        specialistName: req.specialistName,
        specialistAddress: req.specialistAddress,
        patientPseudonym: vault.walletAddress
          ? `${vault.walletAddress.slice(0, 6)}…${vault.walletAddress.slice(-4)}`
          : 'Demo-Patient',
        domain: req.domain,
        retention: req.retention,
        linkedPartName: req.linkedPart
          ? `${req.linkedPart.modelName} (${req.linkedPart.serialNumber})`
          : 'Unlinked Clinical Shard',
        linkedPartId: req.linkedPart?.partId ?? ZERO_BYTES32,
        remainingSeconds: req.durationSeconds,
        revoked: false,
        gpsSector: 'SEC-11 // 1.2 KM',
        metrics: { neuralLatencyMs: 0.39, impedanceKOhm: 11.8, coherencePct: 99.87 },
      };

      if (!liveMode) {
        // Demo mode: real crypto, but nothing leaves this tab and nothing goes on-chain
        const sealed = await encryptAndSealDocument(req.payloadBytes, specialistKemKeyPair.publicKey);
        const recordId = randomBytes32();
        localCacheRef.current.set(recordId, {
          encryptedBlob: sealed.encryptedBlob,
          envelopeHex: sealed.encryptedKeyEnvelope,
          contentHash: sealed.contentHash,
        });
        setPasses((prev) => [
          {
            ...base,
            recordIdHex: recordId,
            storageProvider: 'memory-fallback',
            contentHash: sealed.contentHash,
            ipfsCid: `local-demo-${recordId.slice(2, 14)}`,
            onChain: false,
          },
          ...prev,
        ]);
        notify(
          `Pase #${passId} sellado SOLO en modo demo local (sin wallet/contrato/gateway): no existe on-chain.`,
          'warn'
        );
        return;
      }

      const wallet = vault.walletAddress as Address;
      const gatewayUrl = env.gatewayUrl as string;
      if (req.linkedPart && !req.linkedPart.onChain) {
        throw new Error(
          `La pieza ${req.linkedPart.modelName} es de ejemplo y no existe on-chain. Regístrala en HBOM o elige "Sin pieza vinculada".`
        );
      }

      // 1. Specialist public key FROM THE ON-CHAIN DIRECTORY (never a local key)
      const specialistKey = await vault.queryKemPublicKeyOnChain(req.specialistAddress);
      if (!specialistKey) {
        throw new Error(
          `El especialista ${req.specialistAddress} no ha publicado su clave ML-KEM-1024 on-chain (Portal Especialista → Publish key).`
        );
      }
      // 2. Encrypt locally
      const sealed = await encryptAndSealDocument(req.payloadBytes, hexToBytes(specialistKey));
      // 3. Pin the ciphertext through the gateway (PINATA_JWT stays server-side)
      const pinned = await pinEncryptedBlobViaGateway(gatewayUrl, {
        encryptedBlob: sealed.encryptedBlob,
        address: wallet,
        fileName: `synapseq-${Date.now()}.enc`,
        ...(await gatewayAuth('PIN_BLOB')),
      });
      // 4. Grant on-chain with commitments only (no envelope, no CID in calldata)
      const salt = randomBytes32();
      const recordId = computeRecordId(wallet, salt);
      const tx = await vault.grantTimedAccessOnChain({
        salt,
        contentHash: sealed.contentHash,
        envelopeHash: sealed.envelopeHash,
        linkedPartId: req.linkedPart?.partId ?? ZERO_BYTES32,
        specialist: req.specialistAddress,
        domain: req.domain === 'CLINICAL' ? 0 : 1,
        durationInSeconds: BigInt(req.durationSeconds),
      });
      // 5. Hand the envelope to the gateway (checked against the on-chain envelopeHash)
      try {
        await storeProtectedEnvelope(gatewayUrl, {
          recordId,
          patient: wallet,
          ipfsCID: pinned.cid,
          encryptedKeyEnvelope: sealed.encryptedKeyEnvelope,
          contentHash: sealed.contentHash,
          ...(await gatewayAuth('STORE_ENVELOPE', recordId)),
        });
      } catch (err) {
        throw new Error(
          `El pase quedó on-chain (tx ${tx.hash.slice(0, 12)}…) pero el gateway no guardó el sobre: ${errorText(err)}. Revoca el pase y vuelve a intentarlo.`
        );
      }

      setPasses((prev) => [
        {
          ...base,
          recordIdHex: recordId,
          storageProvider: pinned.provider === 'pinata-ipfs' ? 'pinata-ipfs' : 'gateway-local',
          contentHash: sealed.contentHash,
          ipfsCid: pinned.cid,
          onChain: true,
        },
        ...prev,
      ]);
      notify(`Pase #${passId} registrado on-chain (solo hashes) y sobre custodiado por el gateway • Tx: ${tx.hash.slice(0, 14)}…`);
    },
    [env.gatewayUrl, gatewayAuth, liveMode, notify, specialistKemKeyPair.publicKey, vault]
  );

  /** Runs an on-chain action for real passes; local-only for samples/demo, and says so. */
  const runPassAction = useCallback(
    async (
      pass: MockEphemeralPass | undefined,
      onChainAction: () => Promise<{ hash: `0x${string}` }>,
      applyLocal: () => void,
      label: string
    ) => {
      if (!pass) return;
      if (pass.onChain) {
        if (!chainMode) {
          notify(`Conecta la wallet del paciente para ${label} el pase #${pass.id} on-chain.`, 'error');
          return;
        }
        try {
          const tx = await onChainAction();
          applyLocal();
          notify(`Pase #${pass.id}: ${label} confirmado on-chain • Tx: ${tx.hash.slice(0, 14)}…`);
        } catch (err) {
          notify(`No se pudo ${label} el pase #${pass.id}: ${errorText(err)}`, 'error');
        }
        return;
      }
      applyLocal();
      notify(`Pase #${pass.id}: ${label} aplicado solo en la interfaz (pase de ejemplo/demo, sin cadena).`, 'warn');
    },
    [chainMode, notify]
  );

  const handleExtendPass = useCallback(
    (id: string, extraSeconds: number) => {
      const target = passes.find((p) => p.id === id);
      void runPassAction(
        target,
        () => vault.extendAccessOnChain(target!.recordIdHex, BigInt(extraSeconds)),
        () =>
          setPasses((prev) =>
            prev.map((p) =>
              p.id === id && !p.revoked ? { ...p, remainingSeconds: p.remainingSeconds + extraSeconds } : p
            )
          ),
        'extender'
      );
    },
    [passes, runPassAction, vault]
  );

  const handleRevokePass = useCallback(
    (id: string) => {
      const target = passes.find((p) => p.id === id);
      void runPassAction(
        target,
        () => vault.revokeAccessOnChain(target!.recordIdHex),
        () =>
          setPasses((prev) =>
            prev.map((p) => (p.id === id ? { ...p, revoked: true, remainingSeconds: 0 } : p))
          ),
        'revocar'
      );
    },
    [passes, runPassAction, vault]
  );

  const handleEmergencyKillSwitch = useCallback(async () => {
    const revokeAllLocal = () => {
      // The kill-switch only revokes the patient's own grants, not passes granted to this wallet
      setPasses((prev) =>
        prev.map((p) => (p.fromChainScan ? p : { ...p, revoked: true, remainingSeconds: 0 }))
      );
      localCacheRef.current.clear();
    };
    if (!chainMode) {
      revokeAllLocal();
      notify('Kill-Switch aplicado solo en la interfaz (modo demo: no hay transacción on-chain).', 'warn');
      return;
    }
    try {
      const tx = await vault.emergencyRevokeAllOnChain();
      revokeAllLocal();
      void refreshSpecialistGrants();
      notify(`EMERGENCY KILL-SWITCH confirmado on-chain • Tx: ${tx.hash.slice(0, 14)}…`);
    } catch (err) {
      notify(`El Kill-Switch NO se ejecutó: ${errorText(err)}`, 'error');
    }
  }, [chainMode, notify, refreshSpecialistGrants, vault]);

  // ---------------------------------------------------------------------------
  // Specialist: real decryption (gateway + chain), or the local demo cache
  // ---------------------------------------------------------------------------
  const handleUnsealPass = useCallback(
    async (pass: MockEphemeralPass): Promise<UnsealResult> => {
      if (pass.isSample) {
        throw new Error('Pase de ejemplo: no tiene datos cifrados reales. Crea un pase desde Patient Vault.');
      }

      if (pass.onChain) {
        if (!liveMode || !vault.walletAddress) {
          throw new Error('Conecta la wallet del especialista (y configura el gateway) para descifrar este pase.');
        }
        if (vault.walletAddress.toLowerCase() !== pass.specialistAddress.toLowerCase()) {
          throw new Error(`Este pase es para ${pass.specialistAddress}. Cambia a esa cuenta en tu wallet.`);
        }
        const keyPair = keySource === 'wallet' ? specialistKemKeyPair : await deriveWalletKemKey();
        const gatewayUrl = env.gatewayUrl as string;
        let released: Awaited<ReturnType<typeof releaseProtectedEnvelope>>;
        try {
          released = await releaseProtectedEnvelope(gatewayUrl, {
            recordId: pass.recordIdHex,
            specialist: vault.walletAddress,
            ...(await gatewayAuth('RELEASE_ENVELOPE', pass.recordIdHex)),
          });
        } finally {
          // The gateway re-checked isActive on-chain: re-read our grants so revocations/expiry show up
          void refreshSpecialistGrants();
        }
        const storageProvider = released.blobToken ? 'gateway-local' : 'pinata-ipfs';
        setPasses((prev) =>
          prev.map((p) =>
            p.recordIdHex === pass.recordIdHex ? { ...p, ipfsCid: released.ipfsCID, storageProvider } : p
          )
        );
        // Do not trust the gateway blindly: check its envelope against the on-chain commitment
        const meta = await vault.getGrantMetadata(pass.recordIdHex);
        if (computeEnvelopeHash(released.encryptedKeyEnvelope) !== meta.envelopeHash) {
          throw new Error('El sobre entregado por el gateway NO coincide con el envelopeHash on-chain.');
        }
        const blob = released.blobToken
          ? await downloadBlobViaGateway(gatewayUrl, released.ipfsCID, released.blobToken)
          : await fetchEncryptedBlobFromIpfs(released.ipfsCID, env.ipfsGatewayUrl);
        const plaintext = await unsealAndDecryptDocument(
          blob,
          released.encryptedKeyEnvelope,
          keyPair.secretKey,
          meta.contentHash
        );
        return {
          plaintext,
          verifiedHash: computeShake256(blob),
          envelopeByteSize: (released.encryptedKeyEnvelope.length - 2) / 2,
          ciphertextByteSize: blob.byteLength,
          provenance: 'gateway-chain',
          storageReference: released.ipfsCID,
          storageProvider,
        };
      }

      const cached = localCacheRef.current.get(pass.recordIdHex);
      if (!cached) throw new Error('No hay datos cifrados para este pase en esta pestaña (demo local).');
      try {
        const plaintext = await unsealAndDecryptDocument(
          cached.encryptedBlob,
          cached.envelopeHex,
          specialistKemKeyPair.secretKey,
          cached.contentHash
        );
        return {
          plaintext,
          verifiedHash: cached.contentHash,
          envelopeByteSize: (cached.envelopeHex.length - 2) / 2,
          ciphertextByteSize: cached.encryptedBlob.byteLength,
          provenance: 'local-demo',
        };
      } catch {
        throw new Error('La clave del especialista cambió desde que se selló este pase (demo local): no se puede descifrar.');
      }
    },
    [deriveWalletKemKey, env.gatewayUrl, env.ipfsGatewayUrl, gatewayAuth, keySource, liveMode, refreshSpecialistGrants, specialistKemKeyPair, vault]
  );

  // ---------------------------------------------------------------------------
  // HBOM
  // ---------------------------------------------------------------------------
  const handleRegisterPart = useCallback(
    async (
      newPart: MockBionicPart,
      genesisHistory: MockFirmwareHistoryEntry,
      signatureHex: `0x${string}`
    ): Promise<`0x${string}`> => {
      if (!chainMode || !vault.walletAddress) {
        setBionicParts((prev) => [{ ...newPart, onChain: false }, ...prev]);
        setFirmwareHistory((prev) => [genesisHistory, ...prev]);
        notify(`Pieza ${newPart.modelName} registrada SOLO en la interfaz (demo, sin wallet): no existe on-chain.`, 'warn');
        return newPart.partId;
      }
      void signatureHex; // browser-generated key is not the OEM's registered key
      notify('Registro HBOM on-chain: usa la herramienta OEM (firma ML-DSA-87 verificada por pqcVerify).', 'warn');
      throw new Error(OEM_TOOL_HINT);
    },
    [chainMode, notify, vault.walletAddress]
  );

  const handlePushFirmwareUpdate = useCallback(
    async (partId: `0x${string}`, entry: MockFirmwareHistoryEntry, signatureHex: `0x${string}`) => {
      const part = bionicParts.find((p) => p.partId === partId);
      const applyLocal = () => {
        setBionicParts((prev) =>
          prev.map((p) =>
            p.partId === partId
              ? { ...p, firmwareVersion: entry.version, firmwareSemver: entry.semver, firmwareHash: entry.firmwareHash, calibrationHash: entry.calibrationHash }
              : p
          )
        );
        setFirmwareHistory((prev) => [entry, ...prev]);
      };
      if (!part?.onChain) {
        applyLocal();
        notify(`Parche ${entry.semver} aplicado solo en la interfaz (pieza de ejemplo/demo).`, 'warn');
        return;
      }
      void signatureHex;
      throw new Error(OEM_TOOL_HINT.replace('register --serial … --model … --bearer 0x…', `update --part ${partId}`));
    },
    [bionicParts, notify]
  );

  const handleUpdatePartStatus = useCallback(
    async (partId: `0x${string}`, newStatus: PartStatusLabel) => {
      const part = bionicParts.find((p) => p.partId === partId);
      if (part?.status === 'DECOMMISSIONED') {
        throw new Error('DECOMMISSIONED es un estado terminal: la pieza no puede reactivarse.');
      }
      const statusIdx = newStatus === 'ACTIVE' ? 0 : newStatus === 'MAINTENANCE' ? 1 : 2;
      const applyLocal = () =>
        setBionicParts((prev) =>
          prev.map((p) => (p.partId === partId ? { ...p, status: newStatus, statusIndex: statusIdx } : p))
        );
      if (!part?.onChain) {
        applyLocal();
        notify(`Estado ${newStatus} aplicado solo en la interfaz (pieza de ejemplo/demo).`, 'warn');
        return;
      }
      if (!chainMode) throw new Error('Conecta la wallet del portador para cambiar el estado on-chain.');
      try {
        const tx = await vault.updatePartStatusOnChain(partId, statusIdx);
        applyLocal();
        notify(`Estado ${newStatus} confirmado on-chain • Tx: ${tx.hash.slice(0, 14)}…`);
      } catch (err) {
        notify(`No se pudo cambiar el estado: ${errorText(err)}`, 'error');
        throw err;
      }
    },
    [bionicParts, chainMode, notify, vault]
  );

  const handleGrantTelemetryPassForPart = useCallback(
    (part: MockBionicPart) => {
      setActiveTab('patient-vault');
      notify(`Listo para sellar un pase ligado a ${part.modelName} (${part.serialNumber})`);
    },
    [notify]
  );

  // ---------------------------------------------------------------------------
  // Specialist key management
  // ---------------------------------------------------------------------------
  const handleRegenerateKemKeyPair = useCallback(async () => {
    if (vault.isConnected) {
      try {
        await deriveWalletKemKey();
        notify('Clave ML-KEM-1024 derivada de la firma de tu wallet (recuperable con la misma wallet).');
      } catch (err) {
        notify(`No se pudo derivar la clave: ${errorText(err)}`, 'error');
      }
      return;
    }
    setSpecialistKemKeyPair(generateKemKeyPair());
    setKeySource('ephemeral');
    notify('Nueva clave ML-KEM-1024 EFÍMERA (sin wallet: se pierde al recargar).', 'warn');
  }, [deriveWalletKemKey, notify, vault.isConnected]);

  const handlePublishKemKeyOnChain = useCallback(async () => {
    if (!chainMode) {
      notify('Conecta una wallet y configura el contrato para publicar la clave on-chain.', 'error');
      return;
    }
    try {
      // Never publish an ephemeral key: envelopes sealed to it would be lost on reload
      const pair = keySource === 'wallet' ? specialistKemKeyPair : await deriveWalletKemKey();
      const tx = await vault.publishKemPublicKeyOnChain(bytesToHex(pair.publicKey));
      setIsKeyPublishedOnChain(true);
      notify(`Clave pública ML-KEM-1024 registrada on-chain • Tx: ${tx.hash.slice(0, 14)}…`);
    } catch (err) {
      notify(`No se pudo publicar la clave: ${errorText(err)}`, 'error');
    }
  }, [chainMode, deriveWalletKemKey, keySource, notify, specialistKemKeyPair, vault]);

  // Passes granted TO this wallet (specialist inbox) are not the patient's to manage
  const patientPasses = useMemo(() => passes.filter((p) => !p.fromChainScan), [passes]);

  const activePassCount = useMemo(
    () => patientPasses.filter((p) => !p.revoked && p.remainingSeconds > 0).length,
    [patientPasses]
  );

  const displayAddress = vault.walletAddress
    ? `${vault.walletAddress.slice(0, 6)}...${vault.walletAddress.slice(-4)}`
    : 'Conectar wallet';

  return (
    <div className="min-h-screen flex flex-col justify-between relative bg-reb-bg text-reb-text-light selection:bg-reb-mint selection:text-reb-bg">
      <TacticalGpsBackground />

      {/* TOP HEADER */}
      <header className="sticky top-0 z-50 w-full bg-reb-bg/85 backdrop-blur-xl border-b border-reb-border">
        <div className="max-w-[1480px] mx-auto h-16 px-6 lg:px-10 flex items-center justify-between gap-4">
          {/* Brand & 3-Tab Navigation */}
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => setActiveTab('specialist-portal')}
              className="flex items-center gap-3 group text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-reb-surface-card border border-reb-border flex items-center justify-center relative overflow-hidden group-hover:border-reb-mint transition-colors">
                <span className="w-2 h-2 rounded-full bg-reb-mint shadow-[0_0_10px_#A8F0C6] animate-pulse" />
                <div className="absolute -right-1 -bottom-1 w-2 h-2 rounded-full bg-reb-pink" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-bold text-lg tracking-tight text-reb-text-light">
                    Synapse<span className="text-reb-mint">Q</span>
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-reb-pink" />
                </div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-reb-text-muted">
                  POST-QUANTUM BIO-HUD
                </span>
              </div>
            </button>

            <nav className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('patient-vault')}
                className={`relative px-3.5 py-1.5 rounded-md font-mono text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'patient-vault'
                    ? 'text-reb-mint font-semibold bg-reb-surface/90 border border-reb-mint/40 shadow-[0_0_12px_rgba(168,240,198,0.12)]'
                    : 'text-reb-text-muted hover:text-reb-text-light hover:bg-reb-surface/60'
                }`}
              >
                Patient Vault ({activePassCount})
                {activeTab === 'patient-vault' && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-reb-mint rounded-full shadow-[0_0_6px_#A8F0C6]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('cyber-hbom')}
                className={`relative px-3.5 py-1.5 rounded-md font-mono text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'cyber-hbom'
                    ? 'text-reb-mint font-semibold bg-reb-surface/90 border border-reb-mint/40 shadow-[0_0_12px_rgba(168,240,198,0.12)]'
                    : 'text-reb-text-muted hover:text-reb-text-light hover:bg-reb-surface/60'
                }`}
              >
                Cyber-Human HBOM ({bionicParts.length})
                {activeTab === 'cyber-hbom' && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-reb-mint rounded-full shadow-[0_0_6px_#A8F0C6]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('specialist-portal')}
                className={`relative px-3.5 py-1.5 rounded-md font-mono text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'specialist-portal'
                    ? 'text-reb-mint font-semibold bg-reb-surface/90 border border-reb-mint/40 shadow-[0_0_12px_rgba(168,240,198,0.12)]'
                    : 'text-reb-text-muted hover:text-reb-text-light hover:bg-reb-surface/60'
                }`}
              >
                Specialist Portal
                {activeTab === 'specialist-portal' && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-reb-mint rounded-full shadow-[0_0_6px_#A8F0C6]" />
                )}
              </button>
            </nav>
          </div>

          {/* Right Status, Web3 Wallet & Emergency Kill-Switch */}
          <div className="flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-reb-surface/80 border border-reb-border text-reb-text-muted font-mono text-xs">
              <Radio className="w-3.5 h-3.5 text-reb-mint animate-pulse" />
              <span className="text-reb-text-light">Diana</span>
              <span className="text-reb-mint">[{vault.chainId}]</span>
              <span
                className={`text-[10px] border-l border-reb-border pl-2 ${liveMode ? 'text-reb-mint' : 'text-reb-yellow'}`}
              >
                {liveMode ? 'ON-CHAIN' : 'DEMO LOCAL'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleConnectWallet()}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-reb-surface/80 border border-reb-border hover:border-reb-mint/50 font-mono text-xs transition-all cursor-pointer"
              title="Conectar QoreX Wallet / MetaMask a QoreChain Diana (9800)"
            >
              {vault.isConnected ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-reb-mint" />
              ) : (
                <Wallet className="w-3.5 h-3.5 text-reb-yellow" />
              )}
              <span className="text-reb-text-light">{displayAddress}</span>
              <span className="px-1.5 py-0.5 rounded bg-reb-mint/15 text-reb-mint text-[10px] font-semibold">
                {vault.isTxPending ? 'SIGNING...' : 'ML-KEM'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleEmergencyKillSwitch()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-reb-pink/15 border border-reb-pink/60 text-reb-pink hover:bg-reb-pink hover:text-reb-bg font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_16px_rgba(244,114,155,0.2)]"
              title="Revocar todos los pases efímeros activos en una sola transacción"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Kill-Switch</span>
            </button>
          </div>
        </div>
      </header>

      {/* NOTIFICATION BANNER */}
      {statusBanner && (
        <div className="relative z-40 max-w-[1480px] w-full mx-auto px-6 lg:px-10 pt-4">
          <div
            role={bannerTone === 'error' ? 'alert' : 'status'}
            className={`reb-glass rounded-lg px-4 py-2.5 flex items-center justify-between gap-4 ${
              bannerTone === 'error' ? 'border-reb-pink' : bannerTone === 'warn' ? 'border-reb-yellow/60' : 'border-reb-mint/50'
            }`}
          >
            <div
              className={`flex items-center gap-2.5 font-mono text-xs ${
                bannerTone === 'error' ? 'text-reb-pink' : bannerTone === 'warn' ? 'text-reb-yellow' : 'text-reb-mint'
              }`}
            >
              <Activity className="w-4 h-4 shrink-0 animate-pulse" />
              <span>{statusBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="font-mono text-[10px] uppercase text-reb-text-muted hover:text-reb-text-light cursor-pointer"
            >
              [Cerrar]
            </button>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE */}
      <main className="w-full max-w-[1480px] mx-auto px-6 lg:px-10 py-6 flex-1 relative z-10">
        {activeTab === 'patient-vault' && (
          <PatientVaultView
            passes={patientPasses}
            bionicParts={bionicParts}
            specialistKemPublicKeyHex={specialistKemPublicKeyHex}
            liveMode={liveMode}
            onSealAndGrant={handleSealAndGrant}
            onExtendPass={handleExtendPass}
            onRevokePass={handleRevokePass}
            onEmergencyKillSwitch={() => void handleEmergencyKillSwitch()}
          />
        )}

        {activeTab === 'cyber-hbom' && (
          <CyberHbomView
            parts={bionicParts}
            firmwareHistory={firmwareHistory}
            oemDsaKeyPair={oemDsaKeyPair}
            onRegisterPart={handleRegisterPart}
            onPushFirmwareUpdate={handlePushFirmwareUpdate}
            onUpdatePartStatus={handleUpdatePartStatus}
            onGrantTelemetryPassForPart={handleGrantTelemetryPassForPart}
            liveWallet={chainMode ? vault.walletAddress : null}
          />
        )}

        {activeTab === 'specialist-portal' && (
          <SpecialistPortalView
            passes={passes}
            specialistKemKeyPair={specialistKemKeyPair}
            specialistKemPublicKeyHex={specialistKemPublicKeyHex}
            isKeyPublishedOnChain={isKeyPublishedOnChain}
            keySource={keySource}
            onRegenerateKemKeyPair={() => void handleRegenerateKemKeyPair()}
            onPublishKemKeyOnChain={() => void handlePublishKemKeyOnChain()}
            onUnsealPass={handleUnsealPass}
            chainSync={chainSync}
            onRefreshChainGrants={() => void refreshSpecialistGrants()}
          />
        )}
      </main>

      {/* PERSISTENT FOOTER */}
      <footer className="relative z-10 w-full border-t border-reb-border bg-reb-bg/80 backdrop-blur-md py-3.5 px-6 lg:px-10 mt-6">
        <div className="max-w-[1480px] mx-auto flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] text-reb-text-muted">
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-reb-mint" />
              NIST FIPS 203: ML-KEM-1024
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-reb-pink" />
              FIPS 204: ML-DSA-87
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-reb-periwinkle" />
              SHAKE-256 + x/rdk Native DA Router
            </span>
            {vault.txHistory.length > 0 && (
              <span className="flex items-center gap-1.5 text-reb-mint">
                <KeyRound className="w-3 h-3" />
                Last Tx: {vault.txHistory[0].txHash.slice(0, 10)}... ({vault.txHistory[0].action})
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-reb-text-dim">
            <Cpu className="w-3.5 h-3.5 text-reb-mint" />
            <span>
              QoreChain Diana Testnet ({vault.chainId}) •{' '}
              {vault.contractAddress
                ? `Vault: ${vault.contractAddress.slice(0, 8)}...`
                : 'sin contrato configurado'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

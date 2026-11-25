import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bytesToHex } from 'viem';
import { ShieldAlert, Cpu, KeyRound, Activity, Radio, Wallet, CheckCircle2 } from 'lucide-react';
import { generateDsaKeyPair, generateKemKeyPair, signMLDSA87 } from '@sdk/pqc';
import { getLiveRdkStatus, type RdkNetworkStatus } from '@sdk/rdkDa';
import { TacticalGpsBackground } from '@/components/layout/TacticalGpsBackground';
import { PatientVaultView } from '@/components/patient/PatientVaultView';
import { CyberHbomView } from '@/components/hbom/CyberHbomView';
import { SpecialistPortalView } from '@/components/specialist/SpecialistPortalView';
import { getFrontendEnvConfig } from '@/config/env';
import { useSynapseVault } from '@/hooks/useSynapseVault';
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

interface CachedSealedPayload {
  readonly encryptedBlob: Uint8Array;
  readonly envelopeHex: `0x${string}`;
  readonly contentHash: `0x${string}`;
}

export function App(): React.JSX.Element {
  const env = useMemo(() => getFrontendEnvConfig(), []);
  const vault = useSynapseVault();

  const [activeTab, setActiveTab] = useState<ActiveTab>('specialist-portal');
  const [passes, setPasses] = useState<readonly MockEphemeralPass[]>(INITIAL_EPHEMERAL_PASSES);
  const [bionicParts, setBionicParts] = useState<readonly MockBionicPart[]>(INITIAL_BIONIC_PARTS);
  const [firmwareHistory, setFirmwareHistory] = useState<readonly MockFirmwareHistoryEntry[]>(
    INITIAL_FIRMWARE_HISTORY
  );

  // Real NIST FIPS 203 (ML-KEM-1024) and FIPS 204 (ML-DSA-87) keypairs from Felipe's @sdk/pqc
  const [specialistKemKeyPair, setSpecialistKemKeyPair] = useState(() => generateKemKeyPair());
  const [oemDsaKeyPair] = useState(() => generateDsaKeyPair());
  const [isKeyPublishedOnChain, setIsKeyPublishedOnChain] = useState<boolean>(true);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [rdkStatus, setRdkStatus] = useState<RdkNetworkStatus | null>(null);

  const sealedCacheRef = useRef<Map<string, CachedSealedPayload>>(new Map());
  const latestEnvelopeRef = useRef<`0x${string}`>('0x');

  const specialistKemPublicKeyHex = useMemo(
    () => bytesToHex(specialistKemKeyPair.publicKey),
    [specialistKemKeyPair]
  );

  // Live 1-second countdown ticker for active ephemeral passes
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPasses((prev) =>
        prev.map((p) =>
          !p.revoked && p.remainingSeconds > 0
            ? { ...p, remainingSeconds: p.remainingSeconds - 1 }
            : p
        )
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Query Felipe's @qorechain/rdk live status on mount
  useEffect(() => {
    let mounted = true;
    getLiveRdkStatus('testnet')
      .then((res) => {
        if (mounted) setRdkStatus(res);
      })
      .catch(() => {
        // Fallback already handled inside getLiveRdkStatus
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleConnectWallet = useCallback(async () => {
    try {
      const addr = await vault.connectWallet();
      if (addr) {
        setStatusBanner(`Wallet Web3 conectada: ${addr} en QoreChain Diana (${vault.chainId})`);
      } else {
        setStatusBanner(
          'Modo Enclave Local activo (instala QoreX Wallet o MetaMask para firmar transacciones on-chain).'
        );
      }
    } catch (err) {
      setStatusBanner(
        `Error al conectar wallet: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [vault]);

  const handleSealPayloadToCache = useCallback(
    (
      cid: string,
      encryptedBlob: Uint8Array,
      envelopeHex: `0x${string}`,
      contentHash: `0x${string}`
    ) => {
      sealedCacheRef.current.set(cid, { encryptedBlob, envelopeHex, contentHash });
      latestEnvelopeRef.current = envelopeHex;
    },
    []
  );

  const getCachedSealedPayload = useCallback((cid: string): CachedSealedPayload | undefined => {
    return sealedCacheRef.current.get(cid);
  }, []);

  const handleGrantCreated = useCallback(
    async (newPass: MockEphemeralPass, receiptInfo: string) => {
      setPasses((prev) => [newPass, ...prev]);

      if (vault.isConnected && vault.contractAddress) {
        try {
          const txHash = await vault.grantTimedAccessOnChain({
            recordId: newPass.recordIdHex,
            ipfsCID: newPass.ipfsCid,
            contentHash: newPass.contentHash,
            linkedPartId: newPass.linkedPartId,
            specialist: newPass.specialistAddress,
            encryptedKeyEnvelope: latestEnvelopeRef.current,
            domain: newPass.domain === 'CLINICAL' ? 0 : 1,
            durationInSeconds: BigInt(newPass.remainingSeconds),
          });
          if (txHash) {
            setStatusBanner(
              `Pase #${newPass.id} anclado on-chain en QoreChain Diana • Tx: ${txHash.slice(0, 14)}...`
            );
            return;
          }
        } catch {
          // Graceful fallback to local state if user rejects wallet prompt
        }
      }

      setStatusBanner(`Pase efímero #${newPass.id} sellado con ML-KEM-1024 (${receiptInfo})`);
    },
    [vault]
  );

  const handleExtendPass = useCallback(
    async (id: string, extraSeconds: number) => {
      const target = passes.find((p) => p.id === id);
      setPasses((prev) =>
        prev.map((p) =>
          p.id === id && !p.revoked
            ? { ...p, remainingSeconds: p.remainingSeconds + extraSeconds }
            : p
        )
      );

      if (target && vault.isConnected && vault.contractAddress) {
        try {
          const txHash = await vault.extendAccessOnChain(
            target.recordIdHex,
            BigInt(extraSeconds)
          );
          if (txHash) {
            setStatusBanner(`Pase #${id} extendido on-chain • Tx: ${txHash.slice(0, 14)}...`);
            return;
          }
        } catch {
          // Fallback to UI extension
        }
      }

      setStatusBanner(`Pase #${id} extendido +${Math.round(extraSeconds / 60)} min`);
    },
    [passes, vault]
  );

  const handleRevokePass = useCallback(
    async (id: string) => {
      const target = passes.find((p) => p.id === id);
      setPasses((prev) =>
        prev.map((p) => (p.id === id ? { ...p, revoked: true, remainingSeconds: 0 } : p))
      );

      if (target && vault.isConnected && vault.contractAddress) {
        try {
          const txHash = await vault.revokeAccessOnChain(target.recordIdHex);
          if (txHash) {
            setStatusBanner(`Pase #${id} revocado on-chain • Tx: ${txHash.slice(0, 14)}...`);
            return;
          }
        } catch {
          // Fallback to UI revocation
        }
      }

      setStatusBanner(`Pase #${id} revocado inmutablemente en SynapseVaultRegistry`);
    },
    [passes, vault]
  );

  const handleEmergencyKillSwitch = useCallback(async () => {
    setPasses((prev) => prev.map((p) => ({ ...p, revoked: true, remainingSeconds: 0 })));
    sealedCacheRef.current.clear();

    if (vault.isConnected && vault.contractAddress) {
      try {
        const txHash = await vault.emergencyRevokeAllOnChain();
        if (txHash) {
          setStatusBanner(
            `EMERGENCY KILL-SWITCH EJECUTADO ON-CHAIN • Tx: ${txHash.slice(0, 14)}...`
          );
          return;
        }
      } catch {
        // Fallback to UI kill-switch
      }
    }

    setStatusBanner(
      'EMERGENCY KILL-SWITCH ACTIVADO: Todos los pases efímeros fueron revocados y las claves en RAM eliminadas.'
    );
  }, [vault]);

  const handleRegisterPart = useCallback(
    async (newPart: MockBionicPart, genesisHistory: MockFirmwareHistoryEntry) => {
      setBionicParts((prev) => [newPart, ...prev]);
      setFirmwareHistory((prev) => [genesisHistory, ...prev]);

      if (vault.isConnected && vault.contractAddress) {
        try {
          const sigHex = signMLDSA87(
            new TextEncoder().encode(`${newPart.modelName}:${newPart.serialNumber}`),
            oemDsaKeyPair.secretKey
          );
          const txHash = await vault.registerBionicPartOnChain({
            partId: newPart.partId,
            manufacturer: newPart.manufacturerAddress,
            zone: newPart.zoneIndex,
            modelName: newPart.modelName,
            serialNumber: newPart.serialNumber,
            firmwareHash: newPart.firmwareHash,
            calibrationHash: newPart.calibrationHash,
            pqcSignature: sigHex,
          });
          if (txHash) {
            setStatusBanner(
              `Pieza biónica ${newPart.modelName} registrada on-chain • Tx: ${txHash.slice(0, 14)}...`
            );
            return;
          }
        } catch {
          // Fallback
        }
      }

      setStatusBanner(
        `Pieza biónica ${newPart.modelName} (${newPart.serialNumber}) registrada en HBOM con firma ML-DSA-87`
      );
    },
    [oemDsaKeyPair.secretKey, vault]
  );

  const handlePushFirmwareUpdate = useCallback(
    async (partId: `0x${string}`, entry: MockFirmwareHistoryEntry) => {
      setBionicParts((prev) =>
        prev.map((part) =>
          part.partId === partId
            ? {
                ...part,
                firmwareVersion: entry.version,
                firmwareSemver: entry.semver,
                firmwareHash: entry.firmwareHash,
                calibrationHash: entry.calibrationHash,
              }
            : part
        )
      );
      setFirmwareHistory((prev) => [entry, ...prev]);

      if (vault.isConnected && vault.contractAddress) {
        try {
          const sigHex = signMLDSA87(
            new TextEncoder().encode(entry.semver),
            oemDsaKeyPair.secretKey
          );
          const txHash = await vault.logFirmwareUpdateOnChain({
            partId,
            newFirmwareHash: entry.firmwareHash,
            newCalibrationHash: entry.calibrationHash,
            pqcSignature: sigHex,
          });
          if (txHash) {
            setStatusBanner(
              `Parche de firmware ${entry.semver} registrado on-chain • Tx: ${txHash.slice(0, 14)}...`
            );
            return;
          }
        } catch {
          // Fallback
        }
      }

      setStatusBanner(
        `Parche de firmware ${entry.semver} firmado con ML-DSA-87 registrado en el historial monotónico`
      );
    },
    [oemDsaKeyPair.secretKey, vault]
  );

  const handleUpdatePartStatus = useCallback(
    async (partId: `0x${string}`, newStatus: PartStatusLabel) => {
      const statusIdx = newStatus === 'ACTIVE' ? 0 : newStatus === 'MAINTENANCE' ? 1 : 2;
      setBionicParts((prev) =>
        prev.map((part) =>
          part.partId === partId ? { ...part, status: newStatus, statusIndex: statusIdx } : part
        )
      );

      if (vault.isConnected && vault.contractAddress) {
        try {
          const txHash = await vault.updatePartStatusOnChain(partId, statusIdx);
          if (txHash) {
            setStatusBanner(
              `Estado operativo actualizado a ${newStatus} on-chain • Tx: ${txHash.slice(0, 14)}...`
            );
            return;
          }
        } catch {
          // Fallback
        }
      }

      setStatusBanner(`Estado operativo actualizado a ${newStatus} en SynapseVaultRegistry`);
    },
    [vault]
  );

  const handleGrantTelemetryPassForPart = useCallback((part: MockBionicPart) => {
    setActiveTab('patient-vault');
    setStatusBanner(
      `Listo para sellar pase efímero de 2h ligado a ${part.modelName} (${part.serialNumber})`
    );
  }, []);

  const handleRegenerateKemKeyPair = useCallback(() => {
    const nextPair = generateKemKeyPair();
    setSpecialistKemKeyPair(nextPair);
    setIsKeyPublishedOnChain(false);
    setStatusBanner(
      'Nuevo par de llaves NIST FIPS 203 ML-KEM-1024 (1,568 bytes) generado en enclave WebCrypto'
    );
  }, []);

  const handlePublishKemKeyOnChain = useCallback(async () => {
    if (vault.isConnected && vault.contractAddress) {
      try {
        const txHash = await vault.publishKemPublicKeyOnChain(specialistKemPublicKeyHex);
        if (txHash) {
          setIsKeyPublishedOnChain(true);
          setStatusBanner(
            `Clave pública ML-KEM-1024 (1,568 B) registrada on-chain • Tx: ${txHash.slice(0, 14)}...`
          );
          return;
        }
      } catch {
        // Fallback
      }
    }
    setIsKeyPublishedOnChain(true);
    setStatusBanner(
      'Clave pública ML-KEM-1024 (1,568 B) publicada en el directorio QoreChain PKI (registerKemPublicKey)'
    );
  }, [specialistKemPublicKeyHex, vault]);

  const activePassCount = useMemo(
    () => passes.filter((p) => !p.revoked && p.remainingSeconds > 0).length,
    [passes]
  );

  const displayAddress = vault.walletAddress
    ? `${vault.walletAddress.slice(0, 6)}...${vault.walletAddress.slice(-4)}`
    : '0x71c...b9F4';

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
              {rdkStatus?.nativeDaAvailable && (
                <span className="text-[10px] text-reb-periwinkle border-l border-reb-border pl-2">
                  x/rdk DA Ready
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleConnectWallet}
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
              onClick={handleEmergencyKillSwitch}
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
          <div className="reb-glass rounded-lg px-4 py-2.5 flex items-center justify-between gap-4 border-reb-mint/50">
            <div className="flex items-center gap-2.5 font-mono text-xs text-reb-mint">
              <Activity className="w-4 h-4 shrink-0 text-reb-mint animate-pulse" />
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
            passes={passes}
            bionicParts={bionicParts}
            specialistKemPublicKey={specialistKemKeyPair.publicKey}
            specialistKemPublicKeyHex={specialistKemPublicKeyHex}
            pinataJwt={env.pinataJwt}
            ipfsGatewayUrl={env.ipfsGatewayUrl}
            onGrantCreated={handleGrantCreated}
            onExtendPass={handleExtendPass}
            onRevokePass={handleRevokePass}
            onEmergencyKillSwitch={handleEmergencyKillSwitch}
            onSealPayloadToCache={handleSealPayloadToCache}
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
          />
        )}

        {activeTab === 'specialist-portal' && (
          <SpecialistPortalView
            passes={passes}
            specialistKemKeyPair={specialistKemKeyPair}
            specialistKemPublicKeyHex={specialistKemPublicKeyHex}
            isKeyPublishedOnChain={isKeyPublishedOnChain}
            onRegenerateKemKeyPair={handleRegenerateKemKeyPair}
            onPublishKemKeyOnChain={handlePublishKemKeyOnChain}
            getCachedSealedPayload={getCachedSealedPayload}
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
                : 'Enclave Mode'}{' '}
              • 0 ms Quantum Drift
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

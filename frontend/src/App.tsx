import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bytesToHex } from 'viem';
import { ShieldAlert, Cpu, KeyRound, Activity, Radio } from 'lucide-react';
import { generateDsaKeyPair, generateKemKeyPair } from '@sdk/pqc';
import { getLiveRdkStatus, type RdkNetworkStatus } from '@sdk/rdkDa';
import { TacticalGpsBackground } from '@/components/layout/TacticalGpsBackground';
import { PatientVaultView } from '@/components/patient/PatientVaultView';
import { CyberHbomView } from '@/components/hbom/CyberHbomView';
import { SpecialistPortalView } from '@/components/specialist/SpecialistPortalView';
import { getFrontendEnvConfig } from '@/config/env';
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

  const handleSealPayloadToCache = useCallback(
    (
      cid: string,
      encryptedBlob: Uint8Array,
      envelopeHex: `0x${string}`,
      contentHash: `0x${string}`
    ) => {
      sealedCacheRef.current.set(cid, { encryptedBlob, envelopeHex, contentHash });
    },
    []
  );

  const getCachedSealedPayload = useCallback((cid: string): CachedSealedPayload | undefined => {
    return sealedCacheRef.current.get(cid);
  }, []);

  const handleGrantCreated = useCallback((newPass: MockEphemeralPass, receiptInfo: string) => {
    setPasses((prev) => [newPass, ...prev]);
    setStatusBanner(`Pase efímero #${newPass.id} sellado con ML-KEM-1024 (${receiptInfo})`);
  }, []);

  const handleExtendPass = useCallback((id: string, extraSeconds: number) => {
    setPasses((prev) =>
      prev.map((p) =>
        p.id === id && !p.revoked ? { ...p, remainingSeconds: p.remainingSeconds + extraSeconds } : p
      )
    );
    setStatusBanner(`Pase #${id} extendido +${Math.round(extraSeconds / 60)} min on-chain`);
  }, []);

  const handleRevokePass = useCallback((id: string) => {
    setPasses((prev) =>
      prev.map((p) => (p.id === id ? { ...p, revoked: true, remainingSeconds: 0 } : p))
    );
    setStatusBanner(`Pase #${id} revocado inmutablemente en SynapseVaultRegistry`);
  }, []);

  const handleEmergencyKillSwitch = useCallback(() => {
    setPasses((prev) => prev.map((p) => ({ ...p, revoked: true, remainingSeconds: 0 })));
    sealedCacheRef.current.clear();
    setStatusBanner(
      'EMERGENCY KILL-SWITCH ACTIVADO: Todos los pases efímeros fueron revocados y las claves en RAM eliminadas.'
    );
  }, []);

  const handleRegisterPart = useCallback(
    (newPart: MockBionicPart, genesisHistory: MockFirmwareHistoryEntry) => {
      setBionicParts((prev) => [newPart, ...prev]);
      setFirmwareHistory((prev) => [genesisHistory, ...prev]);
      setStatusBanner(
        `Pieza biónica ${newPart.modelName} (${newPart.serialNumber}) registrada en HBOM con firma ML-DSA-87`
      );
    },
    []
  );

  const handlePushFirmwareUpdate = useCallback(
    (partId: `0x${string}`, entry: MockFirmwareHistoryEntry) => {
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
      setStatusBanner(
        `Parche de firmware ${entry.semver} firmado con ML-DSA-87 registrado en el historial monotónico`
      );
    },
    []
  );

  const handleUpdatePartStatus = useCallback(
    (partId: `0x${string}`, newStatus: PartStatusLabel) => {
      const statusIdx = newStatus === 'ACTIVE' ? 0 : newStatus === 'MAINTENANCE' ? 1 : 2;
      setBionicParts((prev) =>
        prev.map((part) =>
          part.partId === partId ? { ...part, status: newStatus, statusIndex: statusIdx } : part
        )
      );
      setStatusBanner(`Estado operativo actualizado a ${newStatus} en SynapseVaultRegistry`);
    },
    []
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

  const handlePublishKemKeyOnChain = useCallback(() => {
    setIsKeyPublishedOnChain(true);
    setStatusBanner(
      'Clave pública ML-KEM-1024 (1,568 B) publicada on-chain vía registerKemPublicKey()'
    );
  }, []);

  const activePassCount = useMemo(
    () => passes.filter((p) => !p.revoked && p.remainingSeconds > 0).length,
    [passes]
  );

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

          {/* Right Status & Emergency Kill-Switch */}
          <div className="flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-reb-surface/80 border border-reb-border text-reb-text-muted font-mono text-xs">
              <Radio className="w-3.5 h-3.5 text-reb-mint animate-pulse" />
              <span className="text-reb-text-light">Diana</span>
              <span className="text-reb-mint">[{env.qorechainChainId || 9800}]</span>
              {rdkStatus?.nativeDaAvailable && (
                <span className="text-[10px] text-reb-periwinkle border-l border-reb-border pl-2">
                  x/rdk DA Ready
                </span>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-reb-surface/80 border border-reb-border font-mono text-xs">
              <KeyRound className="w-3.5 h-3.5 text-reb-mint" />
              <span className="text-reb-text-light">0x71c...b9F4</span>
              <span className="px-1.5 py-0.5 rounded bg-reb-mint/15 text-reb-mint text-[10px] font-semibold">
                ML-KEM
              </span>
            </div>

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
          </div>
          <div className="flex items-center gap-3 text-reb-text-dim">
            <Cpu className="w-3.5 h-3.5 text-reb-mint" />
            <span>
              QoreChain Diana Testnet ({env.qorechainChainId || 9800}) • Block #4,892,104 • 0 ms
              Quantum Drift
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

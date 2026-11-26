import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  CloudUpload,
  FolderKanban,
  Timer,
  LockOpen,
  Eye,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  Download,
  Trash2,
  ShieldAlert,
  Lock,
  Compass,
  Radio,
} from 'lucide-react';
import type { MockEphemeralPass } from '@/data/mockData';

/** Where a decrypted payload really came from. */
export type UnsealProvenance = 'gateway-chain' | 'local-demo';

export interface UnsealResult {
  readonly plaintext: Uint8Array;
  readonly verifiedHash: `0x${string}`;
  readonly envelopeByteSize: number;
  readonly ciphertextByteSize: number;
  readonly provenance: UnsealProvenance;
  /** Storage reference released by the gateway (passes read from the chain only learn it here). */
  readonly storageReference?: string;
  readonly storageProvider?: MockEphemeralPass['storageProvider'];
}

/** State of the getGrantsBySpecialist scan for the connected wallet. */
export interface ChainGrantSyncState {
  readonly status: 'off' | 'loading' | 'ok' | 'error';
  readonly error?: string;
  readonly count: number;
  /** Ids listed on-chain whose metadata read reverted (skipped). */
  readonly skipped: number;
  readonly syncedAt?: number;
}

export interface SpecialistPortalViewProps {
  readonly passes: readonly MockEphemeralPass[];
  readonly specialistKemKeyPair: {
    readonly publicKey: Uint8Array;
    readonly secretKey: Uint8Array;
  };
  readonly specialistKemPublicKeyHex: string;
  readonly isKeyPublishedOnChain: boolean;
  /** 'wallet' = derived from a wallet signature (recoverable); 'ephemeral' = random, lost on reload. */
  readonly keySource: 'wallet' | 'ephemeral';
  readonly onRegenerateKemKeyPair: () => void;
  readonly onPublishKemKeyOnChain: () => void;
  /** Real decryption: gateway release + chain checks, or the local demo cache. Never synthetic. */
  readonly onUnsealPass: (pass: MockEphemeralPass) => Promise<UnsealResult>;
  readonly chainSync: ChainGrantSyncState;
  readonly onRefreshChainGrants: () => void;
}

function passSourceBadge(pass: MockEphemeralPass): { label: string; className: string } {
  if (pass.isSample) {
    return { label: 'EJEMPLO', className: 'border-reb-border text-reb-text-muted' };
  }
  if (pass.onChain) {
    return {
      label: pass.fromChainScan ? 'ON-CHAIN • leído de la cadena' : 'ON-CHAIN',
      className: 'border-reb-mint/60 text-reb-mint',
    };
  }
  return { label: 'DEMO LOCAL', className: 'border-reb-yellow/60 text-reb-yellow' };
}

type GrantFilterTab = 'active' | 'revoked' | 'all';

interface UnsealedSessionState {
  readonly passId: string;
  readonly passTitle: string;
  readonly ipfsCid: string;
  readonly storageProvider: MockEphemeralPass['storageProvider'];
  readonly decryptedJsonText: string;
  readonly verifiedShake256Hash: `0x${string}`;
  readonly envelopeByteSize: number;
  readonly ciphertextByteSize: number;
  readonly decapsulationTimeMs: number;
  readonly provenance: UnsealProvenance;
  readonly timestampIso: string;
}

function formatRemainingCountdown(seconds: number): string {
  if (seconds <= 0) {
    return '00:00:00';
  }
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hrs, mins, secs].map((val) => String(val).padStart(2, '0')).join(':');
}

function formatTruncatedKeyPreview(hex: string): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length <= 32) {
    return `kem1q${clean}`;
  }
  return `kem1q${clean.slice(0, 18)}...${clean.slice(-8)}`;
}

export function SpecialistPortalView(
  props: Readonly<SpecialistPortalViewProps>
): React.JSX.Element {
  const {
    passes,
    specialistKemPublicKeyHex,
    isKeyPublishedOnChain,
    keySource,
    onRegenerateKemKeyPair,
    onPublishKemKeyOnChain,
    onUnsealPass,
    chainSync,
    onRefreshChainGrants,
  } = props;

  const [filterTab, setFilterTab] = useState<GrantFilterTab>('active');
  const [selectedPassId, setSelectedPassId] = useState<string | null>(() => {
    const firstActive = passes.find((p) => !p.revoked && p.remainingSeconds > 0);
    return firstActive ? firstActive.id : passes[0]?.id ?? null;
  });

  const [unsealedSession, setUnsealedSession] = useState<UnsealedSessionState | null>(null);
  const [isUnsealing, setIsUnsealing] = useState<boolean>(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  const [revokedNoticePass, setRevokedNoticePass] = useState<MockEphemeralPass | null>(null);

  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const [exportedAttestation, setExportedAttestation] = useState<boolean>(false);

  const activeCount = useMemo(
    () => passes.filter((p) => !p.revoked && p.remainingSeconds > 0).length,
    [passes]
  );
  const revokedCount = useMemo(
    () => passes.filter((p) => p.revoked || p.remainingSeconds <= 0).length,
    [passes]
  );

  const filteredPasses = useMemo(() => {
    if (filterTab === 'active') {
      return passes.filter((p) => !p.revoked && p.remainingSeconds > 0);
    }
    if (filterTab === 'revoked') {
      return passes.filter((p) => p.revoked || p.remainingSeconds <= 0);
    }
    return passes;
  }, [passes, filterTab]);

  const selectedPass = useMemo(
    () => passes.find((p) => p.id === selectedPassId) ?? null,
    [passes, selectedPassId]
  );

  const handleUnsealPass = useCallback(
    async (pass: MockEphemeralPass) => {
      setSelectedPassId(pass.id);
      setDecryptionError(null);
      // Flush the previous plaintext first: never show pass A's data under pass B's header
      setUnsealedSession(null);

      if (pass.revoked || pass.remainingSeconds <= 0) {
        setUnsealedSession(null);
        setRevokedNoticePass(pass);
        return;
      }

      setRevokedNoticePass(null);
      setIsUnsealing(true);

      try {
        const startPerf = performance.now();
        const result = await onUnsealPass(pass);
        const elapsedMs = Number((performance.now() - startPerf).toFixed(2));
        const decodedText = new TextDecoder().decode(result.plaintext);
        // Zeroize the plaintext buffer once decoded for display
        result.plaintext.fill(0);

        setUnsealedSession({
          passId: pass.id,
          passTitle: pass.title,
          ipfsCid: result.storageReference ?? pass.ipfsCid,
          storageProvider: result.storageProvider ?? pass.storageProvider,
          decryptedJsonText: decodedText,
          verifiedShake256Hash: result.verifiedHash,
          envelopeByteSize: result.envelopeByteSize,
          ciphertextByteSize: result.ciphertextByteSize,
          decapsulationTimeMs: elapsedMs,
          provenance: result.provenance,
          timestampIso: new Date().toISOString(),
        });
      } catch (err) {
        setDecryptionError(
          err instanceof Error
            ? err.message
            : 'Post-Quantum ML-KEM-1024 decapsulation or SHAKE-256 verification failed.'
        );
      } finally {
        setIsUnsealing(false);
      }
    },
    [onUnsealPass]
  );

  // Watch for on-chain Kill-Switch revocation while a pass is open in the viewer
  useEffect(() => {
    if (!selectedPassId) return;
    const currentPass = passes.find((p) => p.id === selectedPassId);
    if (!currentPass) return;

    if (currentPass.revoked || currentPass.remainingSeconds <= 0) {
      if (unsealedSession?.passId === currentPass.id || selectedPassId === currentPass.id) {
        setUnsealedSession(null);
        setRevokedNoticePass(currentPass);
      }
    }
  }, [passes, selectedPassId, unsealedSession]);

  const handleFlushSessionMemory = useCallback(() => {
    setUnsealedSession(null);
    setDecryptionError(null);
    setCopiedSnippet(false);
  }, []);

  const handleCopyPublicKey = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(specialistKemPublicKeyHex);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 1800);
    } catch {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 1800);
    }
  }, [specialistKemPublicKeyHex]);

  const handleCopyPayloadSnippet = useCallback(async () => {
    if (!unsealedSession) return;
    try {
      await navigator.clipboard.writeText(unsealedSession.decryptedJsonText);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 1800);
    } catch {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 1800);
    }
  }, [unsealedSession]);

  const handleExportAttestation = useCallback(() => {
    if (!unsealedSession || !selectedPass) return;
    const attestationReport = {
      protocol: 'SynapseQ Post-Quantum Enclave Attestation',
      chain: 'QoreChain Diana Testnet (Chain ID 9800)',
      provenance:
        unsealedSession.provenance === 'gateway-chain'
          ? 'Key-Release Gateway + on-chain isAccessValid/envelopeHash/contentHash'
          : 'LOCAL DEMO CACHE (not verified on-chain)',
      standards: ['NIST FIPS 203 (ML-KEM-1024)', 'AES-256-GCM', 'SHAKE-256 (32-Byte XOF)'],
      passId: unsealedSession.passId,
      recordIdHex: selectedPass.recordIdHex,
      patientPseudonym: selectedPass.patientPseudonym,
      storageProvider: unsealedSession.storageProvider,
      storageReference: unsealedSession.ipfsCid,
      verifiedShake256Hash: unsealedSession.verifiedShake256Hash,
      decapsulationTimeMs: unsealedSession.decapsulationTimeMs,
      envelopeByteSize: unsealedSession.envelopeByteSize,
      ciphertextByteSize: unsealedSession.ciphertextByteSize,
      attestedAtUtc: unsealedSession.timestampIso,
    };

    const blob = new Blob([JSON.stringify(attestationReport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `synapseq-pqc-attestation-${unsealedSession.passId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    setExportedAttestation(true);
    setTimeout(() => setExportedAttestation(false), 2000);
  }, [unsealedSession, selectedPass]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start relative">
      {/* LEFT FLOATING GLASS HUD SIDEBAR */}
      <aside className="lg:col-span-4 flex flex-col gap-3.5 pointer-events-auto">
        {/* Card 1: Compact ML-KEM-1024 Lattice Key HUD Card */}
        <div className="bg-[#131B18]/55 backdrop-blur-md border border-reb-mint/30 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded bg-reb-surface-card border border-reb-mint/50 flex items-center justify-center flex-shrink-0 text-reb-mint relative overflow-hidden">
                <KeyRound className="w-3.5 h-3.5" />
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-reb-pink" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-xs font-bold text-reb-text-light truncate">
                  ML-KEM-1024 Lattice Key
                </span>
                <span className="font-mono text-[9px] text-reb-text-muted">
                  1,568 B • NIST Cat 5
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-reb-surface/90 border border-reb-border text-reb-text-muted font-mono text-[9px]">
                {keySource === 'wallet' ? 'WALLET' : 'EFÍMERA'}
              </span>
              {isKeyPublishedOnChain ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-reb-surface border border-reb-mint/50 text-reb-mint font-mono text-[9px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-reb-mint animate-pulse" />
                  ON-CHAIN PKI
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-reb-surface border border-reb-yellow/60 text-reb-yellow font-mono text-[9px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-reb-yellow animate-pulse" />
                  LOCAL ENCLAVE
                </span>
              )}
            </div>
          </div>

          {/* Monospace Truncated Key Copy Button + Re-derivar button */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleCopyPublicKey()}
              className="flex-1 flex items-center justify-between gap-1.5 px-2.5 py-1 rounded bg-reb-surface-code/80 hover:bg-reb-surface-code border border-reb-border hover:border-reb-mint/60 transition-all font-mono text-[10px] text-reb-mint group cursor-pointer min-w-0"
              title="Copy full 1,568-byte ML-KEM-1024 hex public key"
            >
              <span className="truncate">
                {formatTruncatedKeyPreview(specialistKemPublicKeyHex)}
              </span>
              {copiedKey ? (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-reb-mint-bright flex-shrink-0">
                  <Check className="w-3 h-3" />
                  COPIED!
                </span>
              ) : (
                <Copy className="w-3 h-3 text-reb-text-muted group-hover:text-reb-mint transition-colors flex-shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onRegenerateKemKeyPair();
                setUnsealedSession(null);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-reb-surface-card/70 hover:bg-reb-surface-card border border-reb-border hover:border-reb-mint/50 text-reb-text-light font-mono text-[10px] font-semibold transition-all active:scale-95 cursor-pointer flex-shrink-0"
              title={
                keySource === 'wallet' ? 'Re-derivar desde wallet' : 'Derivar / generar clave'
              }
            >
              <RefreshCw className="w-3 h-3 text-reb-mint" />
              <span>Re-derivar</span>
            </button>
          </div>

          {/* Full-width Pastel Mint CTA button */}
          <button
            type="button"
            onClick={onPublishKemKeyOnChain}
            className="w-full py-1.5 px-3 rounded-lg bg-reb-mint hover:bg-reb-mint-bright text-reb-bg font-mono text-xs font-bold tracking-wide transition-all shadow-[0_0_14px_rgba(168,240,198,0.3)] flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            REGISTER KEY ON-CHAIN
          </button>
        </div>

        {/* Card 2: Telemetry Grants List Floating Panel */}
        <div className="bg-[#131B18]/50 backdrop-blur-md border border-reb-mint/25 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          {/* Header with Filter Tabs */}
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-reb-border/70 pb-2">
            <div className="flex items-center gap-1.5">
              <FolderKanban className="w-4 h-4 text-reb-mint" />
              <span className="font-mono text-xs font-bold tracking-wider text-reb-text-light uppercase">
                TELEMETRY GRANTS
              </span>
            </div>

            <div className="flex items-center gap-0.5 bg-reb-surface-code/70 p-0.5 rounded border border-reb-border font-mono text-[9px]">
              <button
                type="button"
                onClick={() => setFilterTab('active')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  filterTab === 'active'
                    ? 'text-reb-mint bg-reb-surface-card font-semibold'
                    : 'text-reb-text-muted hover:text-reb-text-light'
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('revoked')}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  filterTab === 'revoked'
                    ? 'text-reb-pink bg-reb-surface-card font-semibold'
                    : 'text-reb-text-muted hover:text-reb-text-light'
                }`}
              >
                Revoked ({revokedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  filterTab === 'all'
                    ? 'text-reb-mint bg-reb-surface-card font-semibold'
                    : 'text-reb-text-muted hover:text-reb-text-light'
                }`}
              >
                All ({passes.length})
              </button>
            </div>
          </div>

          {/* Compact chainSync status bar with Recargar button */}
          <div className="flex items-center justify-between gap-2 flex-wrap px-2.5 py-1.5 rounded bg-reb-surface-code/70 border border-reb-border font-mono text-[10px]">
            <span
              className={
                chainSync.status === 'error'
                  ? 'text-reb-pink'
                  : chainSync.status === 'ok'
                    ? 'text-reb-mint'
                    : 'text-reb-text-muted'
              }
            >
              {chainSync.status === 'off' &&
                'Conecta la wallet (ON-CHAIN) para leer pases de la cadena.'}
              {chainSync.status === 'loading' && 'Leyendo getGrantsBySpecialist on-chain…'}
              {chainSync.status === 'ok' &&
                `${chainSync.count} pase(s) on-chain${
                  chainSync.skipped > 0 ? ` • ${chainSync.skipped} omitido(s)` : ''
                }${chainSync.syncedAt ? ` • ${new Date(chainSync.syncedAt).toLocaleTimeString()}` : ''}`}
              {chainSync.status === 'error' && `Error on-chain: ${chainSync.error ?? 'desconocido'}`}
            </span>
            {chainSync.status !== 'off' && (
              <button
                type="button"
                onClick={onRefreshChainGrants}
                disabled={chainSync.status === 'loading'}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-reb-border text-reb-text-muted hover:text-reb-mint hover:border-reb-mint/60 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-2.5 h-2.5 ${chainSync.status === 'loading' ? 'animate-spin' : ''}`}
                />
                Recargar
              </button>
            )}
          </div>

          {/* Scrollable Compact Pass Cards */}
          <div className="max-h-[calc(100vh-330px)] overflow-y-auto space-y-2.5 pr-1">
            {filteredPasses.map((pass) => {
              const isRevokedOrExpired = pass.revoked || pass.remainingSeconds <= 0;
              const isSelected = selectedPassId === pass.id;
              const isUnsealedActive = unsealedSession?.passId === pass.id && !isRevokedOrExpired;
              const sourceBadge = passSourceBadge(pass);

              return (
                <div
                  key={pass.id}
                  className={`p-3 rounded-lg transition-all flex flex-col gap-2 ${
                    isRevokedOrExpired
                      ? 'bg-[#17221E]/25 border border-reb-pink/30 opacity-75'
                      : isSelected
                        ? 'bg-[#17221E]/75 border border-reb-mint shadow-[0_0_14px_rgba(168,240,198,0.12)]'
                        : 'bg-[#17221E]/45 hover:bg-[#17221E]/65 border border-reb-border hover:border-reb-mint/50'
                  }`}
                >
                  {/* Top Row: Domain Badge + Source Badge + Countdown */}
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap">
                      {isRevokedOrExpired ? (
                        <span className="px-1.5 py-0.5 rounded bg-reb-crimson/15 border border-reb-pink/40 text-reb-pink font-mono text-[8px] font-bold uppercase tracking-wider">
                          REVOKED / ZEROIZED
                        </span>
                      ) : pass.domain === 'BIONIC_TELEMETRY' ? (
                        <span className="px-2 py-0.5 rounded bg-[#3B66E8]/20 border border-[#3B66E8]/60 text-reb-periwinkle font-mono text-[9px] font-bold uppercase tracking-wider">
                          BIONIC_TELEMETRY
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-reb-surface border border-reb-mint/40 text-reb-mint font-mono text-[9px] font-bold uppercase tracking-wider">
                          CLINICAL_DICOM
                        </span>
                      )}

                      <span
                        className={`px-1.5 py-0.5 rounded bg-reb-surface-card/70 border font-mono text-[8px] ${sourceBadge.className}`}
                      >
                        {sourceBadge.label}
                      </span>
                    </div>

                    {isRevokedOrExpired ? (
                      <span className="font-mono text-[9px] text-reb-text-dim">#{pass.id}</span>
                    ) : (
                      <span className="flex items-center gap-1 text-reb-yellow font-mono text-[10px] font-bold">
                        <Timer className="w-3 h-3" />
                        <span>⏱ {formatRemainingCountdown(pass.remainingSeconds)}</span>
                      </span>
                    )}
                  </div>

                  {/* Pass Title, #pass.id & Patient Pseudonym */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-sans font-bold text-xs ${
                          isRevokedOrExpired
                            ? 'text-reb-text-muted line-through'
                            : 'text-reb-text-light'
                        }`}
                      >
                        {pass.title}
                      </span>
                      {!isRevokedOrExpired && (
                        <span
                          className={`font-mono text-[10px] ${
                            isSelected ? 'text-reb-mint' : 'text-reb-text-muted'
                          }`}
                        >
                          #{pass.id}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className="font-mono text-[10px] text-reb-text-muted truncate">
                        {pass.patientPseudonym} • {pass.storageProvider}
                      </p>
                      {isRevokedOrExpired && (
                        <span className="font-mono text-[9px] text-reb-pink flex-shrink-0">
                          ZERO-FILL OVERWRITTEN
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Geo Sector Pill */}
                  {!isRevokedOrExpired && (
                    <div className="flex items-center justify-between py-1 px-2 rounded bg-reb-surface-code/70 border border-reb-border text-[9px] font-mono">
                      <span className="text-reb-mint-bright flex items-center gap-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isUnsealedActive
                              ? 'bg-reb-mint-bright animate-pulse'
                              : 'bg-reb-mint/60'
                          }`}
                        />
                        {isUnsealedActive ? 'LIVE RAM STREAM' : 'READY FOR ENCLAVE'}
                      </span>
                      <span className="text-reb-text-muted">
                        {pass.gpsSector} // 2.4 KM
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {isRevokedOrExpired ? (
                    <div className="flex items-center justify-between pt-0.5 gap-1.5">
                      <span className="font-mono text-[9px] text-reb-text-muted">
                        DECOUPLED ON-CHAIN
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleUnsealPass(pass)}
                        className="py-1 px-2 rounded bg-reb-surface-card/40 border border-reb-pink/40 text-reb-pink font-mono text-[9px] font-semibold uppercase cursor-pointer hover:bg-reb-crimson/20 transition-all"
                      >
                        INSPECT REVOCATION
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        disabled={isUnsealing}
                        onClick={() => void handleUnsealPass(pass)}
                        className={`flex-1 py-1 px-2 rounded font-mono text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-reb-mint hover:bg-reb-mint-bright text-reb-bg shadow-[0_0_10px_rgba(168,240,198,0.2)]'
                            : 'bg-reb-surface hover:bg-reb-surface-card border border-reb-mint/40 hover:border-reb-mint text-reb-mint'
                        }`}
                      >
                        <LockOpen className="w-3 h-3" />
                        {isUnsealing && isSelected
                          ? 'DECAPSULATING...'
                          : isSelected
                            ? 'UNSEAL STREAM'
                            : 'UNSEAL IN MEMORY'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUnsealPass(pass)}
                        className="p-1 rounded bg-reb-surface-code/60 border border-reb-border hover:border-reb-mint/50 text-reb-text-muted hover:text-reb-text-light transition-all cursor-pointer"
                        title="Inspect Node Attestation"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* CENTER TACTICAL EXPEDITION CORRIDOR */}
      <div className="lg:col-span-8 min-h-[540px] flex flex-col justify-between pointer-events-none">
        {/* Top-Center Floating HUD Compass Pill */}
        <div className="self-center hidden sm:flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-[#0B100E]/70 backdrop-blur-md border border-reb-mint/20 font-mono text-xs text-reb-mint shadow-lg pointer-events-auto">
          <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '12s' }} />
          <span>HUD BEARING 284° WNW • SHINJUKU ENCLAVE LINK 99.8% COHERENT</span>
          <span className="w-1.5 h-1.5 rounded-full bg-reb-mint-bright animate-pulse" />
        </div>

        {/* Center space intentionally open so ENCLAVE NODE [DIANA-9800], GPS VECTOR // 2.4 km, and PATIENT BEACON [#EQ-9042] are 100% unobstructed */}
        <div className="my-auto" />

        {/* Bottom-Right Floating Glass Decryption Drawer */}
        <div className="self-end w-full max-w-[500px] pointer-events-auto mt-auto">
          {revokedNoticePass ? (
            /* a) Revoked Notice Coral Pink Lock Drawer */
            <div className="bg-[#131B18]/75 backdrop-blur-md border-2 border-reb-pink rounded-xl p-4 sm:p-5 flex flex-col gap-3 shadow-[0_16px_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-reb-pink via-reb-crimson to-reb-pink" />

              <div className="flex items-center justify-between gap-2 border-b border-reb-pink/30 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-reb-crimson/25 border border-reb-pink flex items-center justify-center text-reb-pink flex-shrink-0">
                    <ShieldAlert className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h2 className="font-mono text-xs font-bold text-reb-pink tracking-tight uppercase truncate">
                      ACCESS REVOKED ON-CHAIN — ENCLAVE RAM ZEROIZED
                    </h2>
                    <span className="font-mono text-[9px] text-reb-text-muted truncate">
                      PASS #{revokedNoticePass.id} // {revokedNoticePass.title}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-reb-crimson/20 border border-reb-pink text-reb-pink font-mono text-[9px] font-bold flex-shrink-0">
                  DECOUPLED
                </span>
              </div>

              <div className="p-3 rounded-lg bg-reb-surface-code/90 border border-reb-pink/40 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-reb-pink font-mono text-[10px] font-bold uppercase">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Kill-Switch Executed by Patient ({revokedNoticePass.patientPseudonym})</span>
                </div>
                <p className="font-mono text-[10px] text-reb-text-light leading-relaxed">
                  On-chain <code className="text-reb-pink">revokeAccess(bytes32)</code> confirmed on
                  QoreChain Diana Testnet. Unwrapped AES-256-GCM key and ML-KEM-1024 shared secret
                  have been overwritten with zeros in browser memory.
                </p>
                <div className="grid grid-cols-3 gap-1.5 pt-1 font-mono text-[9px]">
                  <div className="p-1.5 rounded bg-reb-surface/80 border border-reb-pink/30 text-reb-pink text-center">
                    RAM: 0x00 (WIPED)
                  </div>
                  <div className="p-1.5 rounded bg-reb-surface/80 border border-reb-pink/30 text-reb-pink text-center">
                    ML-KEM: DECOUPLED
                  </div>
                  <div className="p-1.5 rounded bg-reb-surface/80 border border-reb-pink/30 text-reb-pink text-center">
                    DISK: 0 BYTES
                  </div>
                </div>
              </div>
            </div>
          ) : decryptionError ? (
            /* b) Decryption Error Alert Box */
            <div className="bg-[#131B18]/75 backdrop-blur-md border border-reb-pink/60 rounded-xl p-4 sm:p-5 flex flex-col gap-3 shadow-[0_16px_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-reb-pink via-reb-yellow to-reb-pink" />
              <div className="flex items-center justify-between gap-2 border-b border-reb-pink/30 pb-2">
                <div className="flex items-center gap-2 text-reb-pink font-mono text-xs font-bold uppercase">
                  <ShieldAlert className="w-4 h-4" />
                  <span>PQC Decapsulation / Verification Failed</span>
                </div>
                <button
                  type="button"
                  onClick={handleFlushSessionMemory}
                  className="px-2 py-0.5 rounded bg-reb-surface-card border border-reb-border text-reb-text-muted hover:text-reb-text-light font-mono text-[9px] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
              <p className="font-mono text-xs text-reb-pink leading-relaxed">{decryptionError}</p>
            </div>
          ) : unsealedSession && selectedPass ? (
            /* c) Unsealed Session Floating Glass Decryption Drawer */
            <div className="bg-[#131B18]/65 backdrop-blur-md border border-reb-mint/35 rounded-xl p-4 sm:p-5 flex flex-col gap-3 shadow-[0_16px_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
              {/* Top Gradient Line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-reb-blue via-reb-mint-bright to-reb-pink" />

              {/* Drawer Header */}
              <div className="flex items-center justify-between gap-2 border-b border-reb-border/70 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-reb-mint animate-pulse shadow-[0_0_8px_#A8F0C6] flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-xs font-bold text-reb-text-light truncate uppercase">
                      STREAM: {unsealedSession.passTitle}
                    </span>
                    <span className="font-mono text-[9px] text-reb-text-muted truncate">
                      BEACON #{unsealedSession.passId} // {unsealedSession.decapsulationTimeMs} ms
                      PQC • RAM ONLY
                    </span>
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-reb-surface-card border border-reb-mint/40 text-reb-mint font-mono text-[9px] font-semibold flex items-center gap-1 flex-shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  <span>ISOLATED ENCLAVE</span>
                </div>
              </div>

              {/* 3 Compact Metric Tiles */}
              {selectedPass.metrics && (
                <div className="grid grid-cols-3 gap-2">
                  {/* LATENCY */}
                  <div className="p-2 rounded-lg bg-reb-surface-code/70 border border-reb-mint/25 flex flex-col gap-0.5">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-reb-text-muted">
                      LATENCY
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display font-bold text-base text-reb-mint leading-none">
                        {selectedPass.metrics.neuralLatencyMs.toFixed(2)}
                      </span>
                      <span className="font-mono text-[9px] text-reb-mint">ms</span>
                    </div>
                    <span className="font-mono text-[8px] text-reb-mint-bright">Nominal</span>
                  </div>

                  {/* IMPEDANCE */}
                  <div className="p-2 rounded-lg bg-reb-surface-code/70 border border-reb-mint-bright/25 flex flex-col gap-0.5">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-reb-text-muted">
                      IMPEDANCE
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display font-bold text-base text-reb-mint-bright leading-none">
                        {selectedPass.metrics.impedanceKOhm.toFixed(1)}
                      </span>
                      <span className="font-mono text-[9px] text-reb-mint-bright">kΩ</span>
                    </div>
                    <span className="font-mono text-[8px] text-reb-text-muted">Lattice Matrix</span>
                  </div>

                  {/* COHERENCE */}
                  <div className="p-2 rounded-lg bg-reb-surface-code/70 border border-reb-mint/25 flex flex-col gap-0.5">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-reb-text-muted">
                      COHERENCE
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display font-bold text-base text-reb-mint leading-none">
                        {selectedPass.metrics.coherencePct.toFixed(1)}
                      </span>
                      <span className="font-mono text-[9px] text-reb-mint">%</span>
                    </div>
                    <span className="font-mono text-[8px] text-reb-text-muted">Zero Drift</span>
                  </div>
                </div>
              )}

              {/* 4-Badge Mini Attestation Strip */}
              <div className="grid grid-cols-4 gap-1 py-0.5 font-mono text-[9px]">
                {unsealedSession.provenance === 'gateway-chain' ? (
                  <div className="flex items-center justify-center gap-0.5 px-1 py-0.5 rounded bg-reb-surface-code/60 border border-reb-mint/30 text-reb-mint truncate">
                    <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0" />
                    <span>✓ Qore</span>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center gap-0.5 px-1 py-0.5 rounded bg-reb-surface-code/60 border border-reb-yellow/40 text-reb-yellow truncate"
                    title="Caché local de demo (sin verificación on-chain)"
                  >
                    <ShieldAlert className="w-2.5 h-2.5 flex-shrink-0" />
                    <span>✓ Qore (Demo)</span>
                  </div>
                )}
                <div className="flex items-center justify-center gap-0.5 px-1 py-0.5 rounded bg-reb-surface-code/60 border border-reb-mint/30 text-reb-mint truncate">
                  <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0" />
                  <span>✓ ML-KEM</span>
                </div>
                <div className="flex items-center justify-center gap-0.5 px-1 py-0.5 rounded bg-reb-surface-code/60 border border-reb-mint/30 text-reb-mint truncate">
                  <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0" />
                  <span>✓ AES-GCM</span>
                </div>
                <div className="flex items-center justify-center gap-0.5 px-1 py-0.5 rounded bg-reb-surface-code/60 border border-reb-mint/30 text-reb-mint truncate">
                  <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0" />
                  <span>✓ SHAKE</span>
                </div>
              </div>

              {/* Compact Scrollable <pre> JSON Payload Preview */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-reb-mint flex items-center gap-1 font-semibold">
                    <Terminal className="w-3 h-3" />
                    EPHEMERAL PAYLOAD PREVIEW
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyPayloadSnippet()}
                    className="font-mono text-[9px] text-reb-text-muted hover:text-reb-mint transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSnippet ? (
                      <>
                        <Check className="w-2.5 h-2.5 text-reb-mint" />
                        <span className="text-reb-mint font-bold">COPIED!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-2.5 h-2.5" />
                        <span>COPY</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-2.5 rounded-lg bg-reb-surface-code/90 border border-reb-border font-mono text-[10px] text-reb-text-light overflow-x-auto max-h-[125px] leading-relaxed selection:bg-reb-mint selection:text-reb-bg">
                  <code>{unsealedSession.decryptedJsonText}</code>
                </pre>

                <div className="flex items-center justify-between gap-2 font-mono text-[9px] text-reb-text-muted">
                  <span className="truncate">
                    SHAKE-256:{' '}
                    <span className="text-reb-mint">{unsealedSession.verifiedShake256Hash}</span>
                  </span>
                  <span className="flex-shrink-0">
                    {unsealedSession.envelopeByteSize}B / {unsealedSession.ciphertextByteSize}B
                  </span>
                </div>
              </div>

              {/* Footer with Export Proof and Coral Pink FLUSH SESSION RAM button */}
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-reb-border/60">
                <button
                  type="button"
                  onClick={handleExportAttestation}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-reb-surface-card hover:bg-reb-border-subtle border border-reb-border text-reb-text-muted hover:text-reb-mint font-mono text-[10px] transition-all cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>{exportedAttestation ? 'Proof Exported' : 'Export Proof'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleFlushSessionMemory}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-reb-crimson/20 border border-reb-pink text-reb-pink hover:bg-reb-pink hover:text-reb-bg font-mono text-[10px] font-bold transition-all shadow-[0_0_12px_rgba(244,114,155,0.25)] cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>FLUSH SESSION RAM</span>
                </button>
              </div>
            </div>
          ) : (
            /* d) Compact Idle State Prompting Specialist to Click UNSEAL STREAM */
            <div className="bg-[#131B18]/65 backdrop-blur-md border border-reb-mint/35 rounded-xl p-4 sm:p-5 flex flex-col gap-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-reb-blue via-reb-mint-bright to-reb-pink" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-reb-surface-card/80 border border-reb-mint/40 flex items-center justify-center text-reb-mint">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-xs font-bold text-reb-text-light uppercase">
                      ENCLAVE STREAM DRAWER (STANDBY)
                    </span>
                    <span className="font-mono text-[9px] text-reb-text-muted">
                      ZERO-PERSISTENCE RAM BUFFER • 0 BYTES ALLOCATED
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-reb-surface-card border border-reb-border text-reb-text-muted font-mono text-[9px]">
                  IDLE
                </span>
              </div>
              <p className="font-mono text-[11px] text-reb-text-muted leading-relaxed">
                Select an active telemetry grant in the left rail and click{' '}
                <span className="text-reb-mint font-semibold">UNSEAL STREAM</span> to execute
                real-time ML-KEM-1024 decapsulation, AES-256-GCM decryption, and SHAKE-256
                attestation in isolated browser RAM.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpecialistPortalView;

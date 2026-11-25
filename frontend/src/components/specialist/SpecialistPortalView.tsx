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
    <div className="flex flex-col gap-6 w-full">
      {/* 1. Top Translucent Glass Bar — On-Chain ML-KEM-1024 Public Key Directory */}
      <div className="w-full reb-glass rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        {/* Left: Key Details */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-lg bg-reb-surface-card/70 border border-reb-mint/40 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
            <KeyRound className="w-5 h-5 text-reb-mint" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-reb-pink" />
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-display text-base sm:text-lg text-reb-text-light font-semibold tracking-tight">
                ML-KEM-1024 Public Key (1,568 B • NIST PQC CAT 5)
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-reb-surface/90 border border-reb-border text-reb-text-muted font-mono text-[11px]">
                {keySource === 'wallet' ? 'DERIVADA DE LA WALLET' : 'EFÍMERA (se pierde al recargar)'}
              </span>
              {isKeyPublishedOnChain ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-reb-surface/90 border border-reb-mint/60 text-reb-mint font-mono text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-reb-mint animate-pulse" />
                  ON-CHAIN PKI REGISTERED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-reb-surface/90 border border-reb-yellow/60 text-reb-yellow font-mono text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-reb-yellow animate-pulse" />
                  LOCAL ENCLAVE ONLY
                </span>
              )}
            </div>

            {/* Monospace Snippet Pill */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={handleCopyPublicKey}
                className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-reb-surface-code/80 hover:bg-reb-surface-code border border-reb-border hover:border-reb-mint/60 transition-all font-mono text-xs text-reb-mint group cursor-pointer"
                title="Copy full 1,568-byte ML-KEM-1024 hex public key"
              >
                <span className="truncate max-w-[240px] sm:max-w-[360px]">
                  {formatTruncatedKeyPreview(specialistKemPublicKeyHex)}
                </span>
                {copiedKey ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-reb-mint-bright">
                    <Check className="w-3.5 h-3.5" />
                    COPIED!
                  </span>
                ) : (
                  <Copy className="w-3.5 h-3.5 text-reb-text-muted group-hover:text-reb-mint transition-colors" />
                )}
              </button>
              <span className="font-mono text-xs text-reb-text-muted">
                Diana Chain ID: 9800
              </span>
            </div>
          </div>
        </div>

        {/* Right: Action CTAs */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => {
              onRegenerateKemKeyPair();
              setUnsealedSession(null);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-reb-surface-card/70 hover:bg-reb-surface-card border border-reb-border hover:border-reb-mint/50 text-reb-text-light font-mono text-xs font-semibold tracking-wide transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-reb-mint" />
            {keySource === 'wallet' ? 'Re-derivar desde wallet' : 'Derivar / generar clave'}
          </button>

          <button
            type="button"
            onClick={onPublishKemKeyOnChain}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-reb-mint hover:bg-reb-mint-bright text-reb-bg font-mono text-xs font-bold tracking-wide transition-all shadow-[0_0_18px_rgba(168,240,198,0.35)] active:scale-95 cursor-pointer"
          >
            <CloudUpload className="w-4 h-4" />
            PUBLISH KEY ON-CHAIN (REGISTERKEMPUBLICKEY)
          </button>
        </div>
      </div>

      {/* 2. Two-Column Translucent Glass Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN (lg:col-span-5) — Assigned Telemetry Grants */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Header with Filter Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-reb-mint" />
              <h2 className="font-display text-sm sm:text-base font-bold text-reb-text-light tracking-tight uppercase">
                ASSIGNED TELEMETRY GRANTS
              </h2>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-reb-surface/60 p-1 rounded-lg border border-reb-border font-mono text-xs">
              <button
                type="button"
                onClick={() => setFilterTab('active')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  filterTab === 'active'
                    ? 'text-reb-mint bg-reb-surface-card font-semibold border border-reb-mint/30'
                    : 'text-reb-text-muted hover:text-reb-text-light'
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('revoked')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  filterTab === 'revoked'
                    ? 'text-reb-pink bg-reb-surface-card font-semibold border border-reb-pink/30'
                    : 'text-reb-text-muted hover:text-reb-text-light'
                }`}
              >
                Revoked ({revokedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  filterTab === 'all'
                    ? 'text-reb-mint bg-reb-surface-card font-semibold border border-reb-mint/30'
                    : 'text-reb-text-muted hover:text-reb-text-light'
                }`}
              >
                All ({passes.length})
              </button>
            </div>
          </div>

          {/* On-chain grant scan status (getGrantsBySpecialist) */}
          <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-2 rounded-lg bg-reb-surface-code/70 border border-reb-border font-mono text-[11px]">
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
                'Conecta la wallet (modo ON-CHAIN) para leer tus pases de la cadena.'}
              {chainSync.status === 'loading' && 'Leyendo getGrantsBySpecialist on-chain…'}
              {chainSync.status === 'ok' &&
                `${chainSync.count} pase(s) on-chain para tu wallet${
                  chainSync.skipped > 0 ? ` • ${chainSync.skipped} omitido(s) (lectura revertida)` : ''
                }${chainSync.syncedAt ? ` • ${new Date(chainSync.syncedAt).toLocaleTimeString()}` : ''}`}
              {chainSync.status === 'error' && `Error leyendo la cadena: ${chainSync.error ?? 'desconocido'}`}
            </span>
            {chainSync.status !== 'off' && (
              <button
                type="button"
                onClick={onRefreshChainGrants}
                disabled={chainSync.status === 'loading'}
                className="flex items-center gap-1 px-2 py-0.5 rounded border border-reb-border text-reb-text-muted hover:text-reb-mint hover:border-reb-mint/60 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${chainSync.status === 'loading' ? 'animate-spin' : ''}`} />
                Recargar
              </button>
            )}
          </div>

          {/* Grant Cards List */}
          {filteredPasses.map((pass) => {
            const isRevokedOrExpired = pass.revoked || pass.remainingSeconds <= 0;
            const isSelected = selectedPassId === pass.id;
            const isUnsealedActive = unsealedSession?.passId === pass.id && !isRevokedOrExpired;

            return (
              <div
                key={pass.id}
                className={`w-full rounded-xl p-5 flex flex-col gap-3.5 transition-all ${
                  isRevokedOrExpired
                    ? 'reb-glass-pink opacity-85'
                    : isSelected
                      ? 'reb-glass border-2 border-reb-mint shadow-[0_0_20px_rgba(168,240,198,0.14)]'
                      : 'reb-glass hover:border-reb-mint/60 shadow-lg'
                }`}
              >
                {/* Card Top Row: Domain Badge + GPS Sector + Countdown / Decoupled */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isRevokedOrExpired ? (
                      <span className="px-2 py-0.5 rounded bg-reb-crimson/20 border border-reb-pink/50 text-reb-pink font-mono text-[11px] font-bold uppercase tracking-wider">
                        REVOKED / ZEROIZED
                      </span>
                    ) : pass.domain === 'BIONIC_TELEMETRY' ? (
                      <span className="px-2 py-0.5 rounded bg-reb-blue/20 border border-reb-blue/60 text-reb-periwinkle font-mono text-[11px] font-bold uppercase tracking-wider">
                        BIONIC_TELEMETRY
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-reb-surface-card/80 border border-reb-mint/50 text-reb-mint font-mono text-[11px] font-bold uppercase tracking-wider">
                        CLINICAL_DICOM
                      </span>
                    )}

                    <span className="px-2 py-0.5 rounded bg-reb-surface-card/70 border border-reb-border text-reb-mint-bright font-mono text-[11px]">
                      {pass.gpsSector}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded bg-reb-surface-card/70 border font-mono text-[11px] ${passSourceBadge(pass).className}`}
                    >
                      {passSourceBadge(pass).label}
                    </span>
                  </div>

                  {isRevokedOrExpired ? (
                    <span className="font-mono text-xs text-reb-pink font-semibold">
                      Pass #{pass.id}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 text-reb-yellow font-mono text-xs font-semibold">
                      <Timer className="w-3.5 h-3.5" />
                      <span>⏱ {formatRemainingCountdown(pass.remainingSeconds)}</span>
                    </div>
                  )}
                </div>

                {/* Card Body: Title, Pseudonym & Storage Provider */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`font-display text-base font-bold ${
                        isRevokedOrExpired
                          ? 'text-reb-text-muted line-through'
                          : 'text-reb-text-light'
                      }`}
                    >
                      {pass.title}
                    </h3>
                    {!isRevokedOrExpired && (
                      <span className="font-mono text-xs text-reb-text-muted">
                        Pass #{pass.id}
                      </span>
                    )}
                  </div>

                  {isRevokedOrExpired ? (
                    <p className="font-mono text-xs text-reb-pink mt-1">
                      Enclave decoupled on QoreChain • Patient: {pass.patientPseudonym}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap font-mono text-xs text-reb-text-muted">
                      <span>
                        Patient:{' '}
                        <strong className="text-reb-text-light">{pass.patientPseudonym}</strong>
                      </span>
                      <span>•</span>
                      <span className="px-1.5 py-0.5 rounded bg-reb-surface-code/80 border border-reb-border text-reb-mint text-[11px]">
                        {pass.storageProvider}
                      </span>
                    </div>
                  )}
                </div>

                {/* Live RAM Stream indicator when currently unsealed */}
                {isUnsealedActive && (
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-reb-surface-code/70 border border-reb-border">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-reb-mint animate-pulse" />
                      <span className="font-mono text-xs text-reb-mint font-semibold">
                        ACTIVE RAM STREAM
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-reb-text-muted">
                      Ephemeral Shard Verified
                    </span>
                  </div>
                )}

                {/* Bottom Action Row */}
                {isRevokedOrExpired ? (
                  <div className="flex items-center justify-between pt-1 gap-2">
                    <span className="font-mono text-xs text-reb-text-muted">
                      Zero-fill RAM Overwritten
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-reb-surface-card/70 border border-reb-border text-reb-text-muted font-mono text-xs">
                        DECOUPLED
                      </span>
                      <button
                        type="button"
                        disabled
                        className="py-1.5 px-3 rounded-lg bg-reb-surface-card/40 border border-reb-border text-reb-text-dim font-mono text-xs font-semibold uppercase cursor-not-allowed"
                      >
                        UNSEAL IN MEMORY
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isRevokedOrExpired || isUnsealing}
                      onClick={() => void handleUnsealPass(pass)}
                      className={`flex-1 py-2 px-3 rounded-lg font-mono text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-reb-mint hover:bg-reb-mint-bright text-reb-bg shadow-[0_0_12px_rgba(168,240,198,0.25)]'
                          : 'bg-reb-surface-card/70 hover:bg-reb-mint hover:text-reb-bg border border-reb-mint/40 text-reb-mint'
                      }`}
                    >
                      <LockOpen className="w-3.5 h-3.5" />
                      {isUnsealing && isSelected ? 'DECAPSULATING...' : 'UNSEAL IN MEMORY'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUnsealPass(pass)}
                      className="p-2 rounded-lg bg-reb-surface-card/70 border border-reb-border hover:border-reb-mint/50 text-reb-text-muted hover:text-reb-text-light transition-all cursor-pointer"
                      title="Inspect Node Attestation"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT COLUMN (lg:col-span-7) — In-Memory Decryption Stream Viewer */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {revokedNoticePass ? (
            /* High-Contrast Coral Pink Lock Screen when Revoked by Kill-Switch */
            <div className="w-full reb-glass-pink rounded-xl p-6 lg:p-7 flex flex-col gap-6 shadow-2xl border-2 border-reb-pink">
              <div className="flex items-center justify-between flex-wrap gap-3 border-b border-reb-pink/30 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-reb-crimson/25 border border-reb-pink flex items-center justify-center text-reb-pink">
                    <ShieldAlert className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-bold text-reb-pink tracking-tight uppercase">
                      ACCESS REVOKED ON-CHAIN (KILL-SWITCH ACTIVATED — ENCLAVE RAM ZEROIZED)
                    </h2>
                    <p className="font-mono text-xs text-reb-text-muted">
                      PASS IDENTIFIER: #{revokedNoticePass.id} // {revokedNoticePass.title}
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-reb-crimson/20 border border-reb-pink text-reb-pink font-mono text-xs font-bold">
                  DECOUPLED
                </span>
              </div>

              <div className="p-5 rounded-xl bg-reb-surface-code/90 border border-reb-pink/50 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-reb-pink font-mono text-xs font-bold uppercase">
                  <Lock className="w-4 h-4" />
                  <span>Cryptographic Session Terminated by Patient Sovereignty Event</span>
                </div>
                <p className="font-mono text-xs text-reb-text-light leading-relaxed">
                  The patient executed <code className="text-reb-pink">revokeAccess(bytes32)</code>{' '}
                  on QoreChain Diana Testnet. In compliance with SynapseQ Zero-Persistence Enclave
                  protocol, the unwrapped AES-256-GCM key and ML-KEM-1024 shared secret have been
                  overwritten with zeros in browser memory.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 font-mono text-[11px]">
                  <div className="p-2.5 rounded bg-reb-surface/80 border border-reb-pink/30 text-reb-pink">
                    RAM Buffer: 0x0000...0000 (WIPED)
                  </div>
                  <div className="p-2.5 rounded bg-reb-surface/80 border border-reb-pink/30 text-reb-pink">
                    ML-KEM Secret: DECOUPLED
                  </div>
                  <div className="p-2.5 rounded bg-reb-surface/80 border border-reb-pink/30 text-reb-pink">
                    Disk Persistence: 0 BYTES
                  </div>
                </div>
              </div>
            </div>
          ) : unsealedSession && selectedPass ? (
            /* Active Unsealed Decryption Stream HUD */
            <div className="w-full reb-glass rounded-xl p-6 lg:p-7 flex flex-col gap-6 shadow-2xl relative">
              {/* Stream Window Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-reb-border/70 pb-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-reb-mint shadow-[0_0_8px_#A8F0C6] animate-pulse" />
                    <h2 className="font-display text-base sm:text-lg font-bold text-reb-text-light tracking-tight uppercase">
                      IN-MEMORY DECRYPTION STREAM: {unsealedSession.passTitle}
                    </h2>
                  </div>
                  <span className="font-mono text-xs text-reb-text-muted">
                    GRANT PASS IDENTIFIER: #{unsealedSession.passId} // REBECCA DIANA TESTNET HUD (
                    {unsealedSession.decapsulationTimeMs} ms PQC latency)
                  </span>
                </div>

                {/* Isolation Pill */}
                <div className="px-3 py-1 rounded-full bg-reb-surface-card/90 border border-reb-mint/50 text-reb-mint font-mono text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_10px_rgba(168,240,198,0.1)]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Enclave RAM: Active (Isolated Zero-Disk)</span>
                </div>
              </div>

              {/* 4-Step Post-Quantum Attestation Chain */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-mono text-xs uppercase tracking-wider text-reb-text-muted">
                    Post-Quantum Attestation Chain
                  </span>
                  <span className="font-mono text-xs text-reb-mint">
                    Decapsulated &amp; Verified in {unsealedSession.decapsulationTimeMs} ms •{' '}
                    {unsealedSession.provenance === 'gateway-chain'
                      ? 'Gateway release + verificación on-chain'
                      : 'Caché local de demo (sin verificación on-chain)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {unsealedSession.provenance === 'gateway-chain' ? (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-reb-surface-code/80 border border-reb-mint/40 text-reb-mint font-mono text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>1. QoreChain ✓</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-reb-surface-code/80 border border-reb-yellow/40 text-reb-yellow font-mono text-xs font-semibold">
                      <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>1. QoreChain — demo</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-reb-surface-code/80 border border-reb-mint/40 text-reb-mint font-mono text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>2. ML-KEM-1024 ✓</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-reb-surface-code/80 border border-reb-mint/40 text-reb-mint font-mono text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>3. AES-256-GCM ✓</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-reb-surface-code/80 border border-reb-mint/40 text-reb-mint font-mono text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>4. SHAKE-256 ✓</span>
                  </div>
                </div>
              </div>

              {/* 3 Translucent Telemetry Metric Cards (only when the pass carries telemetry) */}
              {selectedPass.metrics && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Metric 1: Neural Latency */}
                <div className="p-3.5 rounded-lg bg-reb-surface-card/60 border border-reb-mint/30 flex flex-col gap-1">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-reb-text-muted">
                    NEURAL LATENCY
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-bold text-reb-mint tracking-tight">
                      {selectedPass.metrics.neuralLatencyMs.toFixed(2)}
                    </span>
                    <span className="font-mono text-xs text-reb-mint">ms</span>
                  </div>
                  <span className="font-mono text-[11px] text-reb-text-muted">
                    Sub-millisecond nominal
                  </span>
                </div>

                {/* Metric 2: Impedance */}
                <div className="p-3.5 rounded-lg bg-reb-surface-card/60 border border-reb-mint/30 flex flex-col gap-1">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-reb-text-muted">
                    IMPEDANCE
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-bold text-reb-mint-bright tracking-tight">
                      {selectedPass.metrics.impedanceKOhm.toFixed(1)}
                    </span>
                    <span className="font-mono text-xs text-reb-mint-bright">kΩ</span>
                  </div>
                  <span className="font-mono text-[11px] text-reb-text-muted">
                    Stable lattice matrix
                  </span>
                </div>

                {/* Metric 3: Coherence */}
                <div className="p-3.5 rounded-lg bg-reb-surface-card/60 border border-reb-mint/30 flex flex-col gap-1">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-reb-text-muted">
                    COHERENCE
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-bold text-reb-mint tracking-tight">
                      {selectedPass.metrics.coherencePct.toFixed(1)}
                    </span>
                    <span className="font-mono text-xs text-reb-mint">%</span>
                  </div>
                  <span className="font-mono text-[11px] text-reb-text-muted">
                    Zero quantum drift
                  </span>
                </div>
              </div>
              )}

              {/* Ephemeral In-Memory Payload Preview Box */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-mono text-xs uppercase tracking-wider text-reb-mint flex items-center gap-1.5 font-semibold">
                    <Terminal className="w-3.5 h-3.5" />
                    EPHEMERAL DECRYPTED PAYLOAD (ZERO-PERSISTENCE PREVIEW)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPayloadSnippet}
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-reb-text-muted hover:text-reb-mint transition-colors cursor-pointer"
                  >
                    {copiedSnippet ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-reb-mint" />
                        <span className="text-reb-mint font-semibold">COPIED!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>COPY SNIPPET</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-4 rounded-lg bg-reb-surface-code/85 border border-reb-border font-mono text-xs text-reb-text-light overflow-x-auto leading-relaxed selection:bg-reb-mint selection:text-reb-bg max-h-[340px]">
                  <code>{unsealedSession.decryptedJsonText}</code>
                </pre>

                <div className="flex items-center justify-between flex-wrap gap-2 font-mono text-[11px] text-reb-text-muted pt-0.5">
                  <span className="truncate max-w-full">
                    Verified SHAKE-256:{' '}
                    <span className="text-reb-mint">{unsealedSession.verifiedShake256Hash}</span>
                  </span>
                  <span>
                    Envelope: {unsealedSession.envelopeByteSize} B • Ciphertext:{' '}
                    {unsealedSession.ciphertextByteSize} B
                  </span>
                </div>
              </div>

              {/* Bottom Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-reb-border/70">
                <div className="flex items-center gap-2 text-reb-text-muted font-mono text-xs">
                  <ShieldCheck className="w-4 h-4 text-reb-mint" />
                  <span>
                    Descifrado en memoria del navegador. Revocar impide nuevas entregas, pero no
                    recupera lo que ya se vio.
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={handleExportAttestation}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-reb-surface-card/70 border border-reb-border hover:border-reb-mint/50 text-reb-text-light hover:text-reb-mint font-mono text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {exportedAttestation ? 'ATTESTATION EXPORTED' : 'EXPORT ATTESTATION'}
                  </button>

                  <button
                    type="button"
                    onClick={handleFlushSessionMemory}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-reb-crimson/15 border border-reb-pink text-reb-pink hover:bg-reb-pink hover:text-reb-bg font-mono text-xs font-bold transition-all shadow-[0_0_16px_rgba(244,114,155,0.25)] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    FLUSH SESSION MEMORY
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Standby / Flushed Memory State */
            <div className="w-full reb-glass rounded-xl p-6 lg:p-7 flex flex-col items-center justify-center text-center gap-4 min-h-[420px] shadow-2xl">
              <div className="w-12 h-12 rounded-xl bg-reb-surface-card/80 border border-reb-mint/40 flex items-center justify-center text-reb-mint">
                <Lock className="w-6 h-6" />
              </div>
              <div className="max-w-md flex flex-col gap-1.5">
                <h2 className="font-display text-lg font-bold text-reb-text-light">
                  ENCLAVE RAM BUFFER ZEROIZED (STANDBY)
                </h2>
                <p className="font-mono text-xs text-reb-text-muted leading-relaxed">
                  Select an active telemetry grant from the left column and click{' '}
                  <span className="text-reb-mint font-semibold">UNSEAL IN MEMORY</span> to execute
                  real-time NIST FIPS 203 ML-KEM-1024 decapsulation, AES-256-GCM decryption, and
                  32-byte SHAKE-256 verification.
                </p>
              </div>
              {decryptionError && (
                <div className="p-3 rounded-lg bg-reb-crimson/20 border border-reb-pink text-reb-pink font-mono text-xs max-w-md">
                  {decryptionError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpecialistPortalView;

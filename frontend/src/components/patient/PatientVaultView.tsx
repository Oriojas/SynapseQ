import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Cpu,
  Database,
  FileCode,
  HardDrive,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react';
import type { DataDomain, RetentionPolicy, StorageMode } from '@sdk/storageStrategy';
import {
  STORAGE_MODE_OPTIONS,
  type MockBionicPart,
  type MockEphemeralPass,
} from '../../data/mockData';

export const ZERO_PART_ID =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

export interface SealGrantRequest {
  readonly payloadBytes: Uint8Array;
  readonly title: string;
  readonly specialistName: string;
  readonly specialistAddress: `0x${string}`;
  readonly domain: DataDomain;
  readonly retention: RetentionPolicy;
  readonly durationSeconds: number;
  readonly linkedPart: MockBionicPart | null;
}

export interface PatientVaultViewProps {
  readonly passes: readonly MockEphemeralPass[];
  readonly bionicParts: readonly MockBionicPart[];
  /** Local demo key (only used when there is no wallet/gateway). */
  readonly specialistKemPublicKeyHex: string;
  /** true when wallet + contract + gateway are configured: everything goes through the chain. */
  readonly liveMode: boolean;
  readonly onSealAndGrant: (request: SealGrantRequest) => Promise<void>;
  readonly onExtendPass: (id: string, extraSeconds: number) => void;
  readonly onRevokePass: (id: string) => void;
  readonly onEmergencyKillSwitch: () => void;
}

const DEFAULT_TELEMETRY_JSON = JSON.stringify(
  {
    schema: 'synapseq://hbom-telemetry/v2.4',
    patientPseudonym: 'AnonPatient-0x94B',
    deviceModel: 'NeuroLink-X9 BCI',
    serialNumber: 'SN-9042-NLX9',
    timestampUtc: '2026-11-25T21:18:00Z',
    corticalChannels: 1024,
    metrics: {
      neuralLatencyMs: 0.39,
      synapticImpedanceKOhm: 11.8,
      phaseCoherencePct: 99.87,
      thermalDeltaC: 0.14,
    },
    pqcCipherSuite: 'AES-256-GCM + ML-KEM-1024 (FIPS 203)',
  },
  null,
  2
);

const DEFAULT_CLINICAL_DICOM_JSON = JSON.stringify(
  {
    schema: 'synapseq://clinical-dicom-shard/v1.9',
    patientPseudonym: 'AnonPatient-0x12A',
    modality: 'CT-SYNAPTIC-VOXEL-3D',
    studyDescription: 'Cranial CT & Synaptic Mesh Interface Audit',
    institution: 'Neo-Geneva BioClinic Quantum Node',
    findings:
      'Sub-millimeter titanium-graphene electrode array stable; zero glial scarring detected across motor cortex.',
    retentionTargetYears: 65,
  },
  null,
  2
);

const DURATION_PRESETS: readonly {
  readonly label: string;
  readonly seconds: number;
  readonly tag: string;
}[] = [
  { label: '1h Emergency', seconds: 3600, tag: 'FAST' },
  { label: '2h Consult', seconds: 7200, tag: 'STD' },
  { label: '24h Diagnostic', seconds: 86400, tag: 'EXT' },
  { label: '7d Monitor', seconds: 604800, tag: 'CONT' },
];

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

export function PatientVaultView({
  passes,
  bionicParts,
  specialistKemPublicKeyHex,
  liveMode,
  onSealAndGrant,
  onExtendPass,
  onRevokePass,
  onEmergencyKillSwitch,
}: Readonly<PatientVaultViewProps>): React.ReactElement {
  const [payloadText, setPayloadText] = useState<string>(DEFAULT_TELEMETRY_JSON);
  const [uploadedFileName, setUploadedFileName] = useState<string>('neurolink-x9-telemetry.json');
  const [recordTitle, setRecordTitle] = useState<string>('NeuroLink-X9 Motor Cortex Shard');
  const [domain, setDomain] = useState<DataDomain>('BIONIC_TELEMETRY');
  const [retention, setRetention] = useState<RetentionPolicy>('ephemeral');
  const [preferredMode, setPreferredMode] = useState<StorageMode>('auto');
  const [selectedPartId, setSelectedPartId] = useState<`0x${string}`>(ZERO_PART_ID);
  const [specialistName, setSpecialistName] = useState<string>(
    'Dr. Elena Rostova (Neo-Geneva BioClinic)'
  );
  const [specialistAddress, setSpecialistAddress] = useState<`0x${string}`>(
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
  );
  const [durationSeconds, setDurationSeconds] = useState<number>(3600);
  const [isSealing, setIsSealing] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeGrantsCount = useMemo(
    () => passes.filter((p) => !p.revoked && p.remainingSeconds > 0).length,
    [passes]
  );

  // @qorechain/rdk is heavy (pulls cosmjs): load it lazily, only to show the roadmap config
  const [sovereignRollup, setSovereignRollup] = useState<{
    readonly rollupId: string;
    readonly valid: boolean;
  } | null>(null);
  useEffect(() => {
    let mounted = true;
    import('@sdk/rdkDa')
      .then((mod) => {
        if (!mounted) return;
        const built = mod.buildSynapseSovereignConfig('synapseq-hbom-v1');
        setSovereignRollup({ rollupId: built.config.rollupId, valid: built.validation.valid });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const payloadBytes = useMemo(
    () => new TextEncoder().encode(payloadText),
    [payloadText]
  );

  // Honest storage preview: what will ACTUALLY happen with the encrypted blob
  const strategyPreview = useMemo(() => {
    const wantsDa =
      preferredMode === 'qorechain-da' ||
      (preferredMode === 'auto' && domain === 'BIONIC_TELEMETRY' && retention === 'ephemeral');
    if (liveMode) {
      return {
        providerId: 'pinata-ipfs' as const,
        label: 'Key-Release Gateway',
        reason: wantsDa
          ? 'x/rdk DA es roadmap (aún no hay rollups en producción): el blob cifrado se guarda vía Key-Release Gateway (Pinata server-side o disco del gateway).'
          : 'El blob cifrado se guarda vía Key-Release Gateway (Pinata server-side o disco del gateway). El JWT nunca llega al navegador.',
        error: false,
      };
    }
    return {
      providerId: 'memory-fallback' as const,
      label: 'Memoria local (demo)',
      reason:
        'Modo demo local: sin wallet, contrato o gateway configurados el blob queda solo en la memoria de esta pestaña y NO se registra on-chain.',
      error: true,
    };
  }, [liveMode, preferredMode, domain, retention]);

  const handleDomainSwitch = (nextDomain: DataDomain): void => {
    setDomain(nextDomain);
    if (nextDomain === 'BIONIC_TELEMETRY') {
      setRetention('ephemeral');
      setPayloadText(DEFAULT_TELEMETRY_JSON);
      setUploadedFileName('neurolink-x9-telemetry.json');
      setRecordTitle('NeuroLink-X9 Motor Cortex Shard');
    } else {
      setRetention('long-term');
      setPayloadText(DEFAULT_CLINICAL_DICOM_JSON);
      setUploadedFileName('cranial-ct-voxel-shard.json');
      setRecordTitle('Cranial CT & Synaptic Mesh Audit');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setRecordTitle(file.name.replace(/\.[^/.]+$/, ''));
    const text = await file.text();
    setPayloadText(text);
  };

  const handleCopyText = (key: string, value: string): void => {
    void navigator.clipboard?.writeText(value);
    setCopiedId(key);
    setTimeout(() => {
      setCopiedId((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const handleSealAndGrant = async (): Promise<void> => {
    setStatusError(null);
    setIsSealing(true);
    try {
      const linkedPart =
        selectedPartId === ZERO_PART_ID
          ? null
          : bionicParts.find((part) => part.partId === selectedPartId) ?? null;
      await onSealAndGrant({
        payloadBytes,
        title: recordTitle.trim() || 'Encrypted Bionic Shard',
        specialistName: specialistName.trim() || 'Authorized Specialist Node',
        specialistAddress,
        domain,
        retention,
        durationSeconds,
        linkedPart,
      });
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSealing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Telemetry Strip (4 Translucent Glass Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Quantum Entropy & Cipher */}
        <div className="reb-glass rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-reb-text-muted">
              QUANTUM ENTROPY &amp; CIPHER
            </span>
            <Lock className="w-4 h-4 text-reb-mint" />
          </div>
          <div className="mt-2">
            <div className="text-sm font-mono font-bold text-reb-mint">
              AES-256-GCM + ML-KEM-1024 (FIPS 203)
            </div>
            <div className="text-[11px] font-mono text-reb-text-muted mt-1">
              SHAKE-256 Digest • 1,568B Lattice Envelope
            </div>
          </div>
        </div>

        {/* Card 2: Smart Storage Router */}
        <div className="reb-glass rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-reb-text-muted">
              SMART STORAGE ROUTER
            </span>
            <Database className="w-4 h-4 text-reb-blue" />
          </div>
          <div className="mt-2">
            <div className="text-sm font-mono font-bold text-reb-text-light flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-reb-mint animate-pulse" />
              {strategyPreview.label}
            </div>
            <div className="text-[11px] font-mono text-reb-text-muted mt-1 truncate">
              Policy: {preferredMode.toUpperCase()} • {domain} ({retention})
            </div>
          </div>
        </div>

        {/* Card 3: Active Ephemeral Grants */}
        <div className="reb-glass rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-reb-text-muted">
              ACTIVE EPHEMERAL GRANTS
            </span>
            <Clock className="w-4 h-4 text-reb-yellow" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-mono font-bold text-reb-yellow">
              {activeGrantsCount}
              <span className="text-xs font-normal text-reb-text-muted ml-2">
                / {passes.length} TOTAL SHARDS
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-reb-yellow/15 text-reb-yellow border border-reb-yellow/30">
              LIVE TTL
            </span>
          </div>
        </div>

        {/* Card 4: Sovereign Rollup Config */}
        <div className="reb-glass rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-reb-text-muted">
              SOVEREIGN ROLLUP CONFIG
            </span>
            <Cpu className="w-4 h-4 text-reb-mint" />
          </div>
          <div className="mt-2">
            <div className="text-xs font-mono font-bold text-reb-mint">
              Rollup ID: {sovereignRollup?.rollupId ?? 'cargando…'} • Sovereign + Native DA{' '}
              {sovereignRollup ? (sovereignRollup.valid ? 'config válida' : 'config con avisos') : ''}
            </div>
            <div className="text-[11px] font-mono text-reb-text-muted mt-1">
              ROADMAP Fase 2 • x/rdk aún sin rollups en producción
            </div>
          </div>
        </div>
      </div>

      {/* Main 12-Col Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (lg:col-span-5) — Encryption & Ephemeral Grant Studio */}
        <div className="lg:col-span-5 reb-glass rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-reb-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-reb-mint" />
                <h2 className="text-base font-display font-bold tracking-wide text-reb-text-light">
                  PQC ENCRYPTION &amp; GRANT STUDIO
                </h2>
              </div>
              <p className="text-xs text-reb-text-muted mt-0.5">
                Client-side AES-256-GCM sealing + ML-KEM-1024 key encapsulation
              </p>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-reb-mint/15 text-reb-mint border border-reb-mint/30">
              ZERO-PLAINTEXT
            </span>
          </div>

          {/* Domain & Retention Toggles */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-reb-text-muted mb-1.5">
                DATA DOMAIN
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-reb-surface-code border border-reb-border">
                <button
                  type="button"
                  onClick={() => handleDomainSwitch('BIONIC_TELEMETRY')}
                  className={`py-1.5 px-2 rounded text-[11px] font-mono font-semibold transition cursor-pointer ${
                    domain === 'BIONIC_TELEMETRY'
                      ? 'bg-reb-blue text-white'
                      : 'text-reb-text-muted hover:text-reb-text-light'
                  }`}
                >
                  BIONIC_TELEMETRY
                </button>
                <button
                  type="button"
                  onClick={() => handleDomainSwitch('CLINICAL')}
                  className={`py-1.5 px-2 rounded text-[11px] font-mono font-semibold transition cursor-pointer ${
                    domain === 'CLINICAL'
                      ? 'bg-reb-mint text-reb-bg'
                      : 'text-reb-text-muted hover:text-reb-text-light'
                  }`}
                >
                  CLINICAL
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-reb-text-muted mb-1.5">
                RETENTION POLICY
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-reb-surface-code border border-reb-border">
                <button
                  type="button"
                  onClick={() => setRetention('ephemeral')}
                  className={`py-1.5 px-2 rounded text-[11px] font-mono font-semibold transition cursor-pointer ${
                    retention === 'ephemeral'
                      ? 'bg-reb-yellow text-reb-bg'
                      : 'text-reb-text-muted hover:text-reb-text-light'
                  }`}
                >
                  ephemeral
                </button>
                <button
                  type="button"
                  onClick={() => setRetention('long-term')}
                  className={`py-1.5 px-2 rounded text-[11px] font-mono font-semibold transition cursor-pointer ${
                    retention === 'long-term'
                      ? 'bg-reb-mint text-reb-bg'
                      : 'text-reb-text-muted hover:text-reb-text-light'
                  }`}
                >
                  long-term
                </button>
              </div>
            </div>
          </div>

          {/* File / Payload Dropzone & Custom Payload Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono uppercase text-reb-text-muted flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-reb-mint" />
                CLINICAL DICOM / NEURAL BCI TELEMETRY PAYLOAD
              </label>
              <label className="inline-flex items-center gap-1.5 text-[11px] font-mono text-reb-mint hover:underline cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Local File</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <input
              type="text"
              value={recordTitle}
              onChange={(e) => setRecordTitle(e.target.value)}
              placeholder="Shard Title (e.g., NeuroLink-X9 Motor Cortex Shard)"
              className="w-full px-3 py-2 rounded-lg bg-reb-surface-code border border-reb-border text-xs font-mono text-reb-text-light focus:outline-none focus:border-reb-mint"
            />

            <textarea
              rows={6}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="w-full p-3 rounded-lg bg-reb-surface-code border border-reb-border text-xs font-mono text-reb-mint focus:outline-none focus:border-reb-mint resize-y"
            />
            <div className="flex items-center justify-between text-[11px] font-mono text-reb-text-muted">
              <span>File: {uploadedFileName}</span>
              <span>Plaintext Size: {payloadBytes.length.toLocaleString()} Bytes</span>
            </div>
          </div>

          {/* Storage Mode Selector + Live SynapseStorageRouter Decision Preview */}
          <div className="space-y-2">
            <label className="block text-[11px] font-mono uppercase text-reb-text-muted">
              STORAGE ROUTING ENGINE (SynapseStorageRouter)
            </label>
            <select
              value={preferredMode}
              onChange={(e) => setPreferredMode(e.target.value as StorageMode)}
              className="w-full px-3 py-2.5 rounded-lg bg-reb-surface-code border border-reb-border text-xs font-mono text-reb-text-light focus:outline-none focus:border-reb-mint"
            >
              {STORAGE_MODE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div
              className={`p-3 rounded-lg border text-xs font-mono space-y-1 ${
                strategyPreview.error
                  ? 'bg-reb-pink/10 border-reb-pink/40 text-reb-pink'
                  : 'bg-reb-surface-code/90 border-reb-mint/30 text-reb-text-light'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase text-reb-text-muted flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-reb-mint" />
                  LIVE ROUTER RESOLUTION:
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    strategyPreview.providerId === 'pinata-ipfs'
                      ? 'bg-reb-mint/20 text-reb-mint border border-reb-mint/40'
                      : 'bg-reb-yellow/20 text-reb-yellow border border-reb-yellow/40'
                  }`}
                >
                  {strategyPreview.label}
                </span>
              </div>
              <p className="text-[11px] text-reb-text-muted leading-relaxed">
                {strategyPreview.reason}
              </p>
            </div>
          </div>

          {/* Linked Bionic Part Selector */}
          <div>
            <label className="block text-[11px] font-mono uppercase text-reb-text-muted mb-1.5">
              LINKED HBOM BIONIC PART
            </label>
            <select
              value={selectedPartId}
              onChange={(e) => setSelectedPartId(e.target.value as `0x${string}`)}
              className="w-full px-3 py-2.5 rounded-lg bg-reb-surface-code border border-reb-border text-xs font-mono text-reb-text-light focus:outline-none focus:border-reb-mint"
            >
              <option value={ZERO_PART_ID}>Sin pieza vinculada (registro clínico)</option>
              {bionicParts.map((part) => (
                <option key={part.partId} value={part.partId}>
                  {part.modelName} ({part.serialNumber}) — [{part.zone} // {part.status}]
                  {part.onChain ? ' • on-chain' : ' • ejemplo (no on-chain)'}
                </option>
              ))}
            </select>
          </div>

          {/* Specialist Wallet Address & On-Chain ML-KEM-1024 Key Preview */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-mono uppercase text-reb-text-muted mb-1">
                  SPECIALIST / CLINIC LABEL
                </label>
                <input
                  type="text"
                  value={specialistName}
                  onChange={(e) => setSpecialistName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-reb-surface-code border border-reb-border text-xs font-mono text-reb-text-light focus:outline-none focus:border-reb-mint"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-reb-text-muted mb-1">
                  SPECIALIST WALLET (EVM)
                </label>
                <input
                  type="text"
                  value={specialistAddress}
                  onChange={(e) =>
                    setSpecialistAddress(e.target.value as `0x${string}`)
                  }
                  className="w-full px-3 py-2 rounded-lg bg-reb-surface-code border border-reb-border text-xs font-mono text-reb-text-light focus:outline-none focus:border-reb-mint"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-reb-surface-code border border-reb-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-reb-mint shrink-0" />
                <span className="text-[11px] font-mono text-reb-mint truncate">
                  {liveMode
                    ? 'getKemPublicKey(especialista) se consulta on-chain al sellar'
                    : `${specialistKemPublicKeyHex.slice(0, 32)}...`}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-reb-mint/15 text-reb-mint border border-reb-mint/30 shrink-0">
                {liveMode ? 'ML-KEM-1024 desde el directorio on-chain' : 'Clave local de demo (no on-chain)'}
              </span>
            </div>
          </div>

          {/* Duration Presets */}
          <div>
            <label className="block text-[11px] font-mono uppercase text-reb-text-muted mb-1.5">
              EPHEMERAL GRANT TTL WINDOW
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DURATION_PRESETS.map((preset) => {
                const active = durationSeconds === preset.seconds;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setDurationSeconds(preset.seconds)}
                    className={`py-2 px-2.5 rounded-lg font-mono text-xs border transition cursor-pointer flex flex-col items-center ${
                      active
                        ? 'bg-reb-mint text-reb-bg border-reb-mint font-bold'
                        : 'bg-reb-surface-code text-reb-text-light border-reb-border hover:border-reb-mint/50'
                    }`}
                  >
                    <span>{preset.label}</span>
                    <span
                      className={`text-[10px] ${
                        active ? 'text-reb-bg/80' : 'text-reb-text-muted'
                      }`}
                    >
                      {preset.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {statusError && (
            <div className="p-3 rounded-lg bg-reb-pink/15 border border-reb-pink text-xs font-mono text-reb-pink flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{statusError}</span>
            </div>
          )}

          {/* Primary Mint CTA Button */}
          <button
            type="button"
            disabled={isSealing}
            onClick={handleSealAndGrant}
            className="w-full py-3.5 px-4 rounded-xl bg-reb-mint text-reb-bg font-display font-bold text-sm tracking-wide hover:brightness-110 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSealing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>ENCAPSULATING ML-KEM-1024 LATTICE...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>SEAL &amp; GRANT TIMED ACCESS (ML-KEM-1024)</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column (lg:col-span-7) — Active Ephemeral Passes & Emergency Kill-Switch */}
        <div className="lg:col-span-7 reb-glass rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-reb-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-reb-mint" />
                <h2 className="text-base font-display font-bold tracking-wide text-reb-text-light">
                  ACTIVE EPHEMERAL PASSES &amp; TELEMETRY SHARDS
                </h2>
              </div>
              <p className="text-xs text-reb-text-muted mt-0.5">
                On-chain `MedicalAccessVault` time-locked DEK envelopes with instant zeroization
              </p>
            </div>

            <button
              type="button"
              onClick={onEmergencyKillSwitch}
              className="px-4 py-2.5 rounded-xl bg-reb-pink/20 hover:bg-reb-pink/30 text-reb-pink border border-reb-pink/60 font-mono font-bold text-xs tracking-wide transition flex items-center gap-2 cursor-pointer shrink-0 shadow-lg"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>EMERGENCY KILL-SWITCH (REVOKE ALL)</span>
            </button>
          </div>

          {/* Passes Cards List */}
          <div className="space-y-4">
            {passes.map((pass) => {
              const isExpiredOrRevoked = pass.revoked || pass.remainingSeconds <= 0;
              return (
                <div
                  key={pass.id}
                  className={`rounded-xl p-4 transition ${
                    isExpiredOrRevoked ? 'reb-glass-pink opacity-85' : 'reb-glass'
                  }`}
                >
                  {/* Top Row: ID, Badges, GPS & Countdown */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-sm text-reb-mint">
                        #{pass.id}
                      </span>

                      {/* Domain Badge */}
                      <span
                        className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                          pass.domain === 'BIONIC_TELEMETRY'
                            ? 'bg-reb-blue/25 text-reb-periwinkle border-reb-blue/50'
                            : 'bg-reb-mint/20 text-reb-mint border-reb-mint/40'
                        }`}
                      >
                        {pass.domain}
                      </span>

                      {/* Storage Provider Pill */}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-reb-surface-code text-reb-text-light border border-reb-border">
                        {pass.storageProvider}
                      </span>

                      {/* GPS Sector Badge */}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-reb-surface-code text-reb-text-muted border border-reb-border flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-reb-mint" />
                        {pass.gpsSector}
                      </span>
                    </div>

                    {/* Countdown Timer or REVOKED Badge */}
                    <div>
                      {isExpiredOrRevoked ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-reb-pink/20 text-reb-pink border border-reb-pink/50 font-mono font-bold text-xs">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          REVOKED / ZEROIZED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-reb-yellow/15 text-reb-yellow border border-reb-yellow/40 font-mono font-bold text-xs">
                          <Clock className="w-3.5 h-3.5" />
                          {formatCountdown(pass.remainingSeconds)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Specialist Row */}
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-display font-bold text-reb-text-light">
                        {pass.title}
                      </h3>
                      <p className="text-xs font-mono text-reb-text-muted">
                        Grantee: {pass.specialistName} ({pass.specialistAddress.slice(0, 10)}...
                        {pass.specialistAddress.slice(-6)})
                      </p>
                    </div>
                    <div className="text-xs font-mono text-reb-mint">
                      Part: {pass.linkedPartName}
                    </div>
                  </div>

                  {/* Copyable SHAKE-256 contentHash & IPFS/DA Reference */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(`hash-${pass.id}`, pass.contentHash)
                      }
                      className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-reb-surface-code border border-reb-border hover:border-reb-mint/40 text-left text-[11px] font-mono transition cursor-pointer"
                    >
                      <span className="truncate text-reb-text-muted">
                        <strong className="text-reb-mint">SHAKE-256:</strong>{' '}
                        {pass.contentHash.slice(0, 22)}...
                      </span>
                      {copiedId === `hash-${pass.id}` ? (
                        <Check className="w-3.5 h-3.5 text-reb-mint shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-reb-text-muted shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyText(`cid-${pass.id}`, pass.ipfsCid)}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-reb-surface-code border border-reb-border hover:border-reb-mint/40 text-left text-[11px] font-mono transition cursor-pointer"
                    >
                      <span className="truncate text-reb-text-muted">
                        <strong className="text-reb-periwinkle">REF:</strong>{' '}
                        {pass.ipfsCid}
                      </span>
                      {copiedId === `cid-${pass.id}` ? (
                        <Check className="w-3.5 h-3.5 text-reb-mint shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-reb-text-muted shrink-0" />
                      )}
                    </button>
                  </div>

                  {/* Footer Actions & Live Neural Telemetry Metrics */}
                  <div className="mt-3 pt-3 border-t border-reb-border/60 flex flex-wrap items-center justify-between gap-3">
                    {pass.metrics ? (
                    <div className="flex items-center gap-4 text-[11px] font-mono text-reb-text-muted">
                      <span>
                        Latency:{' '}
                        <strong className="text-reb-mint">
                          {pass.metrics.neuralLatencyMs}ms
                        </strong>
                      </span>
                      <span>
                        Impedance:{' '}
                        <strong className="text-reb-mint">
                          {pass.metrics.impedanceKOhm}kΩ
                        </strong>
                      </span>
                      <span>
                        Coherence:{' '}
                        <strong className="text-reb-mint">
                          {pass.metrics.coherencePct}%
                        </strong>
                      </span>
                    </div>
                    ) : (
                      <span className="text-[11px] font-mono text-reb-text-muted">Sin telemetría</span>
                    )}

                    {!isExpiredOrRevoked && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onExtendPass(pass.id, 3600)}
                          className="px-3 py-1 rounded-lg bg-reb-mint/15 hover:bg-reb-mint/25 text-reb-mint border border-reb-mint/40 font-mono text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Extend +1h</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRevokePass(pass.id)}
                          className="px-3 py-1 rounded-lg bg-reb-pink/15 hover:bg-reb-pink/25 text-reb-pink border border-reb-pink/40 font-mono text-xs font-semibold transition cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
export default PatientVaultView;

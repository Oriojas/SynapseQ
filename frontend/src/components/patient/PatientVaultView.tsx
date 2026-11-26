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
import { useI18n } from '@/i18n/context';
import {
  STORAGE_MODE_OPTIONS,
  type AnatomicalZoneLabel,
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
  readonly labelEn: string;
  readonly labelEs: string;
  readonly shortLabel: string;
  readonly seconds: number;
  readonly tagEn: string;
  readonly tagEs: string;
}[] = [
  { labelEn: '1h Emergency', labelEs: '1h Emergencia', shortLabel: '1h', seconds: 3600, tagEn: 'FAST', tagEs: 'RÁPIDO' },
  { labelEn: '2h Consult', labelEs: '2h Consulta', shortLabel: '2h', seconds: 7200, tagEn: 'STD', tagEs: 'EST' },
  { labelEn: '24h Diagnostic', labelEs: '24h Diagnóstico', shortLabel: '24h', seconds: 86400, tagEn: 'EXT', tagEs: 'EXT' },
  { labelEn: '7d Monitor', labelEs: '7d Monitoreo', shortLabel: '7d', seconds: 604800, tagEn: 'CONT', tagEs: 'CONT' },
];

type TranslateFn = (en: string, es: string) => string;

function translateStorageModeOption(mode: StorageMode, fallbackLabel: string, tr: TranslateFn): string {
  switch (mode) {
    case 'auto':
      return tr(
        'AUTO SMART ROUTER (SynapseStorageRouter)',
        'ENRUTADOR INTELIGENTE AUTO (SynapseStorageRouter)'
      );
    case 'qorechain-da':
      return tr(
        'QORECHAIN NATIVE DA (x/rdk Sovereign Rollup)',
        'DA NATIVO QORECHAIN (Rollup Soberano x/rdk)'
      );
    case 'pinata-ipfs':
      return tr(
        'PINATA IPFS (50-70yr Long-Term Archive)',
        'PINATA IPFS (Archivo a Largo Plazo 50-70 años)'
      );
    case 'memory-fallback':
      return tr(
        'BROWSER ENCLAVE FALLBACK (Zero-Disk RAM)',
        'RESPALDO ENCLAVE NAVEGADOR (RAM Cero-Disco)'
      );
    default:
      return fallbackLabel;
  }
}

function translateDomainBadge(domain: DataDomain, tr: TranslateFn): string {
  return domain === 'BIONIC_TELEMETRY'
    ? tr('BIONIC_TELEMETRY', 'TELEMETRÍA_BIÓNICA')
    : tr('CLINICAL', 'CLÍNICO');
}

function translateZoneLabel(zone: AnatomicalZoneLabel, tr: TranslateFn): string {
  switch (zone) {
    case 'NEURAL':
      return tr('NEURAL', 'NEURAL');
    case 'OCULAR':
      return tr('OCULAR', 'OCULAR');
    case 'CARDIOVASCULAR':
      return tr('CARDIOVASCULAR', 'CARDIOVASCULAR');
    case 'LOCOMOTOR':
      return tr('LOCOMOTOR', 'LOCOMOTOR');
    case 'ORGAN':
      return tr('ORGAN', 'ÓRGANO');
    case 'SUBDERMAL':
      return tr('SUBDERMAL', 'SUBDÉRMICO');
  }
}

function translateStorageProviderBadge(
  provider: MockEphemeralPass['storageProvider'],
  tr: TranslateFn
): string {
  switch (provider) {
    case 'pinata-ipfs':
      return tr('pinata-ipfs', 'pinata-ipfs');
    case 'qorechain-da':
      return tr('qorechain-da', 'qorechain-da');
    case 'memory-fallback':
      return tr('local-memory (demo)', 'memoria-local (demo)');
    case 'gateway-local':
      return tr('gateway-local', 'gateway-local');
    case 'gateway-custody':
      return tr('gateway-custody', 'custodia-gateway');
  }
}

function translateGpsSector(gpsSector: string, tr: TranslateFn): string {
  return gpsSector.replace('DECOUPLED', tr('DECOUPLED', 'DESACOPLADO'));
}

function translateLinkedPartLabel(linkedPartName: string, tr: TranslateFn): string {
  if (linkedPartName === 'Sin pieza vinculada (clínico)' || linkedPartName === 'No linked part (clinical)') {
    return tr('No linked part (clinical)', 'Sin pieza vinculada (clínico)');
  }
  return linkedPartName;
}

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
  const { tr } = useI18n();
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
        label: tr('Key-Release Gateway', 'Gateway de Liberación de Claves'),
        reason: wantsDa
          ? tr(
              'x/rdk DA is on the roadmap (no production rollups yet): the encrypted blob is stored via the Key-Release Gateway (server-side Pinata or gateway disk).',
              'x/rdk DA es roadmap (aún no hay rollups en producción): el blob cifrado se guarda vía Key-Release Gateway (Pinata server-side o disco del gateway).'
            )
          : tr(
              'The encrypted blob is stored via the Key-Release Gateway (server-side Pinata or gateway disk). The JWT never reaches the browser.',
              'El blob cifrado se guarda vía Key-Release Gateway (Pinata server-side o disco del gateway). El JWT nunca llega al navegador.'
            ),
        error: false,
      };
    }
    return {
      providerId: 'memory-fallback' as const,
      label: tr('Local memory (demo)', 'Memoria local (demo)'),
      reason: tr(
        'Local demo mode: without a configured wallet, contract, or gateway, the blob stays only in this tab memory and is NOT recorded on-chain.',
        'Modo demo local: sin wallet, contrato o gateway configurados el blob queda solo en la memoria de esta pestaña y NO se registra on-chain.'
      ),
      error: true,
    };
  }, [liveMode, preferredMode, domain, retention, tr]);

  const handleDomainSwitch = (nextDomain: DataDomain): void => {
    setDomain(nextDomain);
    if (nextDomain === 'BIONIC_TELEMETRY') {
      setRetention('ephemeral');
      setPayloadText(DEFAULT_TELEMETRY_JSON);
      setUploadedFileName('neurolink-x9-telemetry.json');
      setRecordTitle(
        tr('NeuroLink-X9 Motor Cortex Shard', 'Fragmento de Corteza Motora NeuroLink-X9')
      );
    } else {
      setRetention('long-term');
      setPayloadText(DEFAULT_CLINICAL_DICOM_JSON);
      setUploadedFileName('cranial-ct-voxel-shard.json');
      setRecordTitle(
        tr('Cranial CT & Synaptic Mesh Audit', 'Auditoría de TC Craneal y Malla Sináptica')
      );
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
        title:
          recordTitle.trim() ||
          tr('Encrypted Bionic Shard', 'Fragmento Biónico Cifrado'),
        specialistName:
          specialistName.trim() ||
          tr('Authorized Specialist Node', 'Nodo Especialista Autorizado'),
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
      {/* LEFT FLOATING GLASS HUD SIDEBAR (lg:col-span-4) — Compact PQC Encryption & Grant Studio */}
      <aside className="lg:col-span-4 flex flex-col gap-3.5 pointer-events-auto">
        <div className="bg-[#131B18]/55 backdrop-blur-md border border-reb-mint/30 rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-3">
          {/* Compact Header */}
          <div className="flex items-center justify-between border-b border-reb-border/70 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Shield className="w-4 h-4 text-reb-mint shrink-0" />
              <h2 className="text-xs font-display font-bold tracking-wider text-reb-text-light truncate">
                {tr(
                  'PQC ENCRYPTION & GRANT STUDIO',
                  'ESTUDIO DE CIFRADO PQC Y CONCESIÓN'
                )}
              </h2>
            </div>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-reb-mint/15 text-reb-mint border border-reb-mint/30 shrink-0">
              {tr('ZERO-PLAINTEXT', 'CERO-TEXTO-PLANO')}
            </span>
          </div>

          {/* Compact Domain & Retention Toggle Pills */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-mono uppercase text-reb-text-muted mb-1">
                {tr('DOMAIN', 'DOMINIO')}
              </label>
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-reb-surface-code/90 border border-reb-border">
                <button
                  type="button"
                  onClick={() => handleDomainSwitch('BIONIC_TELEMETRY')}
                  className={`py-1 px-1.5 rounded text-[9px] font-mono font-semibold transition cursor-pointer truncate ${
                    domain === 'BIONIC_TELEMETRY'
                      ? 'bg-reb-blue text-white'
                      : 'text-reb-text-muted hover:text-reb-text-light'
                  }`}
                >
                  {tr('BIONIC_TELEMETRY', 'TELEMETRÍA_BIÓNICA')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDomainSwitch('CLINICAL')}
                  className={`py-1 px-1.5 rounded text-[9px] font-mono font-semibold transition cursor-pointer truncate ${
                    domain === 'CLINICAL'
                      ? 'bg-reb-mint text-reb-bg'
                      : 'text-reb-text-muted hover:text-reb-text-light'
                  }`}
                >
                  {tr('CLINICAL', 'CLÍNICO')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-mono uppercase text-reb-text-muted mb-1">
                {tr('RETENTION', 'RETENCIÓN')}
              </label>
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-reb-surface-code/90 border border-reb-border">
                <button
                  type="button"
                  onClick={() => setRetention('ephemeral')}
                  className={`py-1 px-1.5 rounded text-[9px] font-mono font-semibold transition cursor-pointer truncate ${
                    retention === 'ephemeral'
                      ? 'bg-reb-yellow text-reb-bg'
                      : 'text-reb-text-muted hover:text-reb-text-light'
                  }`}
                >
                  {tr('ephemeral', 'efímero')}
                </button>
                <button
                  type="button"
                  onClick={() => setRetention('long-term')}
                  className={`py-1 px-1.5 rounded text-[9px] font-mono font-semibold transition cursor-pointer truncate ${
                    retention === 'long-term'
                      ? 'bg-reb-mint text-reb-bg'
                      : 'text-reb-text-muted hover:text-reb-text-light'
                  }`}
                >
                  {tr('long-term', 'largo-plazo')}
                </button>
              </div>
            </div>
          </div>

          {/* Shard Title Input + Compact 3-Row Payload Textarea + Upload File Link */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase text-reb-text-muted flex items-center gap-1">
                <FileCode className="w-3 h-3 text-reb-mint" />
                <span>
                  {tr('SHARD PAYLOAD', 'CARGA DEL FRAGMENTO')} ({payloadBytes.length.toLocaleString()} B)
                </span>
              </label>
              <label className="inline-flex items-center gap-1 text-[10px] font-mono text-reb-mint hover:underline cursor-pointer">
                <Upload className="w-3 h-3" />
                <span>{tr('Upload File', 'Subir Archivo')}</span>
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
              placeholder={tr(
                'Shard Title (e.g., NeuroLink-X9 Motor Cortex Shard)',
                'Título del fragmento (ej., Fragmento de Corteza Motora NeuroLink-X9)'
              )}
              className="w-full px-2.5 py-1.5 rounded-lg bg-reb-surface-code/90 border border-reb-border text-xs font-mono text-reb-text-light focus:outline-none focus:border-reb-mint"
            />

            <textarea
              rows={3}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="w-full p-2 rounded-lg bg-reb-surface-code/90 border border-reb-border text-[11px] font-mono text-reb-mint focus:outline-none focus:border-reb-mint resize-y leading-snug"
            />
            <div className="text-[10px] font-mono text-reb-text-muted truncate">
              {tr('File:', 'Archivo:')} {uploadedFileName}
            </div>
          </div>

          {/* Compact Storage Router Selector + 1-line strategyPreview Badge + Linked HBOM Part Dropdown */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-mono uppercase text-reb-text-muted mb-1">
                  {tr('STORAGE ROUTER', 'ENRUTADOR DE ALMACENAMIENTO')}
                </label>
                <select
                  value={preferredMode}
                  onChange={(e) => setPreferredMode(e.target.value as StorageMode)}
                  className="w-full px-2 py-1.5 rounded-lg bg-reb-surface-code/90 border border-reb-border text-[11px] font-mono text-reb-text-light focus:outline-none focus:border-reb-mint"
                >
                  {STORAGE_MODE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {translateStorageModeOption(opt.id, opt.label, tr)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase text-reb-text-muted mb-1">
                  {tr('LINKED HBOM PART', 'PIEZA HBOM VINCULADA')}
                </label>
                <select
                  value={selectedPartId}
                  onChange={(e) => setSelectedPartId(e.target.value as `0x${string}`)}
                  className="w-full px-2 py-1.5 rounded-lg bg-reb-surface-code/90 border border-reb-border text-[11px] font-mono text-reb-text-light focus:outline-none focus:border-reb-mint"
                >
                  <option value={ZERO_PART_ID}>
                    {tr('No linked part (clinical)', 'Sin pieza vinculada (clínico)')}
                  </option>
                  {bionicParts.map((part) => (
                    <option key={part.partId} value={part.partId}>
                      {part.modelName} ({part.serialNumber}) [{translateZoneLabel(part.zone, tr)}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 1-line strategyPreview badge */}
            <div
              title={strategyPreview.reason}
              className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-mono flex items-center justify-between gap-2 ${
                strategyPreview.error
                  ? 'bg-reb-pink/10 border-reb-pink/40 text-reb-pink'
                  : 'bg-reb-surface-code/85 border-reb-mint/30 text-reb-text-light'
              }`}
            >
              <span className="flex items-center gap-1.5 text-reb-text-muted truncate">
                <HardDrive className="w-3 h-3 text-reb-mint shrink-0" />
                <span className="truncate">{tr('Router Target:', 'Destino del Enrutador:')}</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                  strategyPreview.providerId === 'pinata-ipfs'
                    ? 'bg-reb-mint/20 text-reb-mint border border-reb-mint/40'
                    : 'bg-reb-yellow/20 text-reb-yellow border border-reb-yellow/40'
                }`}
              >
                {strategyPreview.label}
              </span>
            </div>
          </div>

          {/* Compact Specialist Label & EVM Wallet Input + 1-line ML-KEM-1024 Directory Status */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-mono uppercase text-reb-text-muted mb-1">
                  {tr('SPECIALIST LABEL', 'ETIQUETA DEL ESPECIALISTA')}
                </label>
                <input
                  type="text"
                  value={specialistName}
                  onChange={(e) => setSpecialistName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-reb-surface-code/90 border border-reb-border text-[11px] font-mono text-reb-text-light focus:outline-none focus:border-reb-mint"
                />
              </div>
              <div>
                <label className="block text-[9px] font-mono uppercase text-reb-text-muted mb-1">
                  {tr('EVM WALLET', 'BILLETERA EVM')}
                </label>
                <input
                  type="text"
                  value={specialistAddress}
                  onChange={(e) =>
                    setSpecialistAddress(e.target.value as `0x${string}`)
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-reb-surface-code/90 border border-reb-border text-[11px] font-mono text-reb-text-light focus:outline-none focus:border-reb-mint"
                />
              </div>
            </div>

            <div className="px-2.5 py-1.5 rounded-lg bg-reb-surface-code/90 border border-reb-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-reb-mint shrink-0" />
                <span className="text-[10px] font-mono text-reb-mint truncate">
                  {liveMode
                    ? tr('getKemPublicKey() on-chain', 'getKemPublicKey() en cadena')
                    : `${specialistKemPublicKeyHex.slice(0, 22)}...`}
                </span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-reb-mint/15 text-reb-mint border border-reb-mint/30 shrink-0">
                {liveMode
                  ? tr('ML-KEM-1024 On-Chain', 'ML-KEM-1024 En Cadena')
                  : tr('ML-KEM-1024 Demo', 'ML-KEM-1024 Demo')}
              </span>
            </div>
          </div>

          {/* 4 Compact TTL Preset Buttons (1h, 2h, 24h, 7d) */}
          <div>
            <label className="block text-[9px] font-mono uppercase text-reb-text-muted mb-1">
              {tr('EPHEMERAL GRANT TTL WINDOW', 'VENTANA TTL DE CONCESIÓN EFÍMERA')}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {DURATION_PRESETS.map((preset) => {
                const active = durationSeconds === preset.seconds;
                return (
                  <button
                    key={preset.labelEn}
                    type="button"
                    title={tr(preset.labelEn, preset.labelEs)}
                    onClick={() => setDurationSeconds(preset.seconds)}
                    className={`py-1.5 px-2 rounded-lg font-mono text-[11px] border transition cursor-pointer flex items-center justify-center gap-1 ${
                      active
                        ? 'bg-reb-mint text-reb-bg border-reb-mint font-bold'
                        : 'bg-reb-surface-code/90 text-reb-text-light border-reb-border hover:border-reb-mint/50'
                    }`}
                  >
                    <span>{preset.shortLabel}</span>
                    <span
                      className={`text-[9px] ${
                        active ? 'text-reb-bg/80' : 'text-reb-text-muted'
                      }`}
                    >
                      {tr(preset.tagEn, preset.tagEs)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {statusError && (
            <div className="p-2.5 rounded-lg bg-reb-pink/15 border border-reb-pink text-[11px] font-mono text-reb-pink flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{statusError}</span>
            </div>
          )}

          {/* Primary Pastel Mint CTA Button */}
          <button
            type="button"
            disabled={isSealing}
            onClick={handleSealAndGrant}
            className="w-full py-2.5 px-3 rounded-xl bg-reb-mint text-reb-bg font-display font-bold text-xs tracking-wide hover:brightness-110 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-[0_0_16px_rgba(168,240,198,0.25)]"
          >
            {isSealing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {tr(
                    'ENCAPSULATING ML-KEM-1024 LATTICE...',
                    'ENCAPSULANDO RETÍCULA ML-KEM-1024...'
                  )}
                </span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>
                  {tr(
                    'SEAL & GRANT TIMED ACCESS (ML-KEM-1024)',
                    'SELLAR Y OTORGAR ACCESO TEMPORAL (ML-KEM-1024)'
                  )}
                </span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* CENTER & RIGHT TACTICAL MAP CORRIDOR (lg:col-span-8) */}
      <div className="lg:col-span-8 min-h-[560px] flex flex-col justify-between pointer-events-none">
        {/* Top Floating Telemetry Pills Bar */}
        <div className="self-center flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="px-3 py-1 rounded-full bg-[#0B100E]/75 backdrop-blur-md border border-reb-mint/30 font-mono text-[11px] text-reb-mint flex items-center gap-1.5 shadow-lg">
            <Lock className="w-3 h-3 text-reb-mint" />
            <span>AES-256-GCM + ML-KEM-1024</span>
          </div>

          <div className="px-3 py-1 rounded-full bg-[#0B100E]/75 backdrop-blur-md border border-reb-blue/40 font-mono text-[11px] text-reb-text-light flex items-center gap-1.5 shadow-lg">
            <Database className="w-3 h-3 text-reb-periwinkle" />
            <span>
              {tr('Router:', 'Enrutador:')} {strategyPreview.label}
            </span>
          </div>

          <div className="px-3 py-1 rounded-full bg-[#0B100E]/75 backdrop-blur-md border border-reb-yellow/40 font-mono text-[11px] text-reb-yellow flex items-center gap-1.5 shadow-lg">
            <Clock className="w-3 h-3 text-reb-yellow" />
            <span>
              {tr('Active Grants:', 'Concesiones Activas:')} {activeGrantsCount}/{passes.length}
            </span>
          </div>

          <div className="px-3 py-1 rounded-full bg-[#0B100E]/75 backdrop-blur-md border border-reb-mint/25 font-mono text-[11px] text-reb-text-muted flex items-center gap-1.5 shadow-lg">
            <Cpu className="w-3 h-3 text-reb-mint" />
            <span>
              {tr('Rollup:', 'Rollup:')} {sovereignRollup?.rollupId ?? 'synapseq-hbom-v1'}
            </span>
          </div>
        </div>

        {/* Open Center Map Space — intentionally unobstructed for GPS vector route */}
        <div className="my-auto" />

        {/* Bottom-Right Floating Glass Active Passes & Kill-Switch Drawer */}
        <div className="self-end w-full max-w-[540px] pointer-events-auto mt-auto bg-[#131B18]/65 backdrop-blur-md border border-reb-mint/30 rounded-xl p-4 shadow-[0_16px_40px_rgba(0,0,0,0.8)] relative overflow-hidden space-y-3">
          {/* Top Gradient Bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-reb-blue via-reb-mint-bright to-reb-pink" />

          {/* Header with ACTIVE EPHEMERAL PASSES & EMERGENCY KILL-SWITCH */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-reb-border/70 pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-reb-mint" />
              <h2 className="text-xs font-display font-bold tracking-wider text-reb-text-light">
                {tr('ACTIVE EPHEMERAL PASSES', 'PASES EFÍMEROS ACTIVOS')}
              </h2>
            </div>

            <button
              type="button"
              onClick={onEmergencyKillSwitch}
              className="px-2.5 py-1.5 rounded-lg bg-reb-pink/20 hover:bg-reb-pink/30 text-reb-pink border border-reb-pink/60 font-mono font-bold text-[10px] tracking-wide transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-md"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>
                {tr(
                  'EMERGENCY KILL-SWITCH (REVOKE ALL)',
                  'CORTE DE EMERGENCIA (REVOCAR TODO)'
                )}
              </span>
            </button>
          </div>

          {/* Scrollable Compact List of Passes */}
          <div className="max-h-[260px] overflow-y-auto space-y-2.5 pr-1">
            {passes.map((pass) => {
              const isExpiredOrRevoked = pass.revoked || pass.remainingSeconds <= 0;
              return (
                <div
                  key={pass.id}
                  className={`rounded-lg p-3 border transition ${
                    isExpiredOrRevoked
                      ? 'bg-[#17221E]/35 border-reb-pink/35 opacity-80'
                      : 'bg-[#17221E]/65 border-reb-border hover:border-reb-mint/40'
                  }`}
                >
                  {/* Top Row: ID, Domain Badge, Storage Provider, GPS Sector & Countdown */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-reb-mint">
                        #{pass.id}
                      </span>

                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          pass.domain === 'BIONIC_TELEMETRY'
                            ? 'bg-reb-blue/25 text-reb-periwinkle border-reb-blue/50'
                            : 'bg-reb-mint/20 text-reb-mint border-reb-mint/40'
                        }`}
                      >
                        {translateDomainBadge(pass.domain, tr)}
                      </span>

                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-reb-surface-code text-reb-text-light border border-reb-border">
                        {translateStorageProviderBadge(pass.storageProvider, tr)}
                      </span>

                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-reb-surface-code text-reb-text-muted border border-reb-border flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 text-reb-mint" />
                        {translateGpsSector(pass.gpsSector, tr)}
                      </span>
                    </div>

                    <div>
                      {isExpiredOrRevoked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-reb-pink/20 text-reb-pink border border-reb-pink/50 font-mono font-bold text-[10px]">
                          <ShieldAlert className="w-3 h-3" />
                          {tr('REVOKED / ZEROIZED', 'REVOCADO / ZEROIZADO')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-reb-yellow/15 text-reb-yellow border border-reb-yellow/40 font-mono font-bold text-[10px]">
                          <Clock className="w-3 h-3" />
                          {formatCountdown(pass.remainingSeconds)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title, Grantee & Linked Part */}
                  <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-1">
                    <div className="min-w-0">
                      <h3 className="text-xs font-display font-bold text-reb-text-light truncate">
                        {pass.title}
                      </h3>
                      <p className="text-[10px] font-mono text-reb-text-muted truncate">
                        {tr('Grantee:', 'Autorizado:')} {pass.specialistName} ({pass.specialistAddress.slice(0, 8)}...
                        {pass.specialistAddress.slice(-4)})
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-reb-mint shrink-0">
                      {translateLinkedPartLabel(pass.linkedPartName, tr)}
                    </span>
                  </div>

                  {/* Copyable SHAKE-256 & REF Pills */}
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      title={tr('Copy SHAKE-256 content hash', 'Copiar hash de contenido SHAKE-256')}
                      onClick={() =>
                        handleCopyText(`hash-${pass.id}`, pass.contentHash)
                      }
                      className="flex items-center justify-between gap-1.5 px-2 py-1 rounded bg-reb-surface-code/90 border border-reb-border hover:border-reb-mint/40 text-left text-[10px] font-mono transition cursor-pointer"
                    >
                      <span className="truncate text-reb-text-muted">
                        <strong className="text-reb-mint">SHAKE-256:</strong>{' '}
                        {pass.contentHash.slice(0, 14)}...
                      </span>
                      {copiedId === `hash-${pass.id}` ? (
                        <Check className="w-3 h-3 text-reb-mint shrink-0" />
                      ) : (
                        <Copy className="w-3 h-3 text-reb-text-muted shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      title={tr('Copy storage reference / CID', 'Copiar referencia de almacenamiento / CID')}
                      onClick={() => handleCopyText(`cid-${pass.id}`, pass.ipfsCid)}
                      className="flex items-center justify-between gap-1.5 px-2 py-1 rounded bg-reb-surface-code/90 border border-reb-border hover:border-reb-mint/40 text-left text-[10px] font-mono transition cursor-pointer"
                    >
                      <span className="truncate text-reb-text-muted">
                        <strong className="text-reb-periwinkle">REF:</strong>{' '}
                        {pass.ipfsCid}
                      </span>
                      {copiedId === `cid-${pass.id}` ? (
                        <Check className="w-3 h-3 text-reb-mint shrink-0" />
                      ) : (
                        <Copy className="w-3 h-3 text-reb-text-muted shrink-0" />
                      )}
                    </button>
                  </div>

                  {/* Footer Metrics & Extend / Revoke Buttons */}
                  <div className="mt-2 pt-2 border-t border-reb-border/60 flex flex-wrap items-center justify-between gap-2">
                    {pass.metrics ? (
                      <div className="flex items-center gap-2.5 text-[10px] font-mono text-reb-text-muted">
                        <span>
                          {tr('Lat:', 'Lat:')}{' '}
                          <strong className="text-reb-mint">
                            {pass.metrics.neuralLatencyMs}ms
                          </strong>
                        </span>
                        <span>
                          {tr('Imp:', 'Imp:')}{' '}
                          <strong className="text-reb-mint">
                            {pass.metrics.impedanceKOhm}kΩ
                          </strong>
                        </span>
                        <span>
                          {tr('Coh:', 'Coh:')}{' '}
                          <strong className="text-reb-mint">
                            {pass.metrics.coherencePct}%
                          </strong>
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-reb-text-muted">
                        {tr('No telemetry', 'Sin telemetría')}
                      </span>
                    )}

                    {!isExpiredOrRevoked && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onExtendPass(pass.id, 3600)}
                          className="px-2 py-0.5 rounded bg-reb-mint/15 hover:bg-reb-mint/25 text-reb-mint border border-reb-mint/40 font-mono text-[10px] font-semibold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{tr('Extend +1h', 'Extender +1h')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRevokePass(pass.id)}
                          className="px-2 py-0.5 rounded bg-reb-pink/15 hover:bg-reb-pink/25 text-reb-pink border border-reb-pink/40 font-mono text-[10px] font-semibold transition cursor-pointer"
                        >
                          {tr('Revoke', 'Revocar')}
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

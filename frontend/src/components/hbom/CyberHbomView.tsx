import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  FileJson,
  Fingerprint,
  HeartPulse,
  Key,
  Layers,
  Lock,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Wrench,
  XCircle,
} from 'lucide-react';
import { computeShake256, signMLDSA87, verifyMLDSA87 } from '@sdk/pqc';
import type {
  AnatomicalZoneLabel,
  MockBionicPart,
  MockFirmwareHistoryEntry,
  PartStatusLabel,
} from '../../data/mockData';

export interface CyberHbomViewProps {
  readonly parts: readonly MockBionicPart[];
  readonly firmwareHistory: readonly MockFirmwareHistoryEntry[];
  readonly oemDsaKeyPair: {
    readonly publicKey: Uint8Array;
    readonly secretKey: Uint8Array;
  };
  /** Resolves with the final partId (the on-chain one in live mode). Rejects on failure. */
  readonly onRegisterPart: (
    newPart: MockBionicPart,
    genesisHistory: MockFirmwareHistoryEntry,
    signatureHex: `0x${string}`
  ) => Promise<`0x${string}`>;
  readonly onPushFirmwareUpdate: (
    partId: `0x${string}`,
    entry: MockFirmwareHistoryEntry,
    signatureHex: `0x${string}`
  ) => Promise<void>;
  readonly onUpdatePartStatus: (
    partId: `0x${string}`,
    newStatus: PartStatusLabel
  ) => Promise<void>;
  /** In live mode the connected wallet is the manufacturer AND the bearer. */
  readonly liveWallet: `0x${string}` | null;
  readonly onGrantTelemetryPassForPart: (part: MockBionicPart) => void;
}

const ANATOMICAL_ZONES: readonly {
  readonly id: 'ALL' | AnatomicalZoneLabel;
  readonly label: string;
  readonly subtitle: string;
  readonly zoneIndex: number;
}[] = [
  { id: 'ALL', label: 'ALL', subtitle: 'Full Cyber-Human Substrate', zoneIndex: -1 },
  { id: 'NEURAL', label: 'NEURAL', subtitle: 'L1 BCI Synaptic Mesh', zoneIndex: 0 },
  { id: 'OCULAR', label: 'OCULAR', subtitle: 'Photonic Retina & HUD', zoneIndex: 1 },
  { id: 'CARDIOVASCULAR', label: 'CARDIOVASCULAR', subtitle: 'Hemodynamic Nano-Valves', zoneIndex: 2 },
  { id: 'LOCOMOTOR', label: 'LOCOMOTOR', subtitle: 'Titan-7 Myo-Prosthetics', zoneIndex: 3 },
  { id: 'ORGAN', label: 'ORGAN', subtitle: 'Hepatic / Renal Scaffolds', zoneIndex: 4 },
  { id: 'SUBDERMAL', label: 'SUBDERMAL', subtitle: 'Lattice NFC & Sensory Skin', zoneIndex: 5 },
];

const STATUS_TABS: readonly ('ALL' | PartStatusLabel)[] = [
  'ALL',
  'ACTIVE',
  'MAINTENANCE',
  'DECOMMISSIONED',
];

function getStatusIndex(status: PartStatusLabel): number {
  if (status === 'ACTIVE') return 0;
  if (status === 'MAINTENANCE') return 1;
  return 2;
}

function getZoneIndex(zone: AnatomicalZoneLabel): number {
  const found = ANATOMICAL_ZONES.find((z) => z.id === zone);
  return found ? found.zoneIndex : 0;
}

export const CyberHbomView: React.FC<Readonly<CyberHbomViewProps>> = ({
  parts,
  firmwareHistory,
  oemDsaKeyPair,
  onRegisterPart,
  onPushFirmwareUpdate,
  onUpdatePartStatus,
  onGrantTelemetryPassForPart,
  liveWallet,
}) => {
  const [regError, setRegError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  // Filter & selection states
  const [selectedZone, setSelectedZone] = useState<'ALL' | AnatomicalZoneLabel>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | PartStatusLabel>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPartId, setSelectedPartId] = useState<`0x${string}`>(
    parts[0]?.partId ?? '0x4b7f8c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6fc18a'
  );

  // Registration Form state
  const [regModelName, setRegModelName] = useState<string>('Neuro-Synapse Gen 5');
  const [regSerialNumber, setRegSerialNumber] = useState<string>('SN-8820-BCI-X');
  const [regManufacturerName, setRegManufacturerName] = useState<string>('BioNeural Dynamics');
  const [regManufacturerAddress, setRegManufacturerAddress] = useState<`0x${string}`>(
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
  );
  const [regZone, setRegZone] = useState<AnatomicalZoneLabel>('NEURAL');
  const [regFirmwareSemver, setRegFirmwareSemver] = useState<string>('v1.0.0');
  const [regPayloadText, setRegPayloadText] = useState<string>(
    'SYNAPSEQ_GENESIS_FIRMWARE_ATTESTATION::FIPS_204_ML_DSA_87::CORTEX_TELEMETRY_V1'
  );

  // Registration PQC Attestation result banner
  const [regSignatureResult, setRegSignatureResult] = useState<{
    readonly verified: boolean;
    readonly signatureBytesLen: number;
    readonly signatureHexPreview: string;
    readonly firmwareHash: `0x${string}`;
    readonly calibrationHash: `0x${string}`;
    readonly serial: string;
  } | null>(null);

  // Inline Firmware Patcher state per part
  const [patchingPartId, setPatchingPartId] = useState<`0x${string}` | null>(null);
  const [patchSemver, setPatchSemver] = useState<string>('v2.5.0');
  const [patchDescription, setPatchDescription] = useState<string>(
    'Post-quantum lattice noise filter & zero-drift synaptic impedance calibration patch.'
  );
  const [patchErrorMsg, setPatchErrorMsg] = useState<string | null>(null);
  const [patchSuccessBanner, setPatchSuccessBanner] = useState<{
    readonly partId: `0x${string}`;
    readonly semver: string;
    readonly firmwareHash: `0x${string}`;
    readonly sigBytes: number;
    readonly verified: boolean;
  } | null>(null);

  // Copy feedback & JSON-LD preview
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [jsonLdPreview, setJsonLdPreview] = useState<string | null>(null);

  const selectedPart =
    parts.find((p) => p.partId === selectedPartId) ?? parts[0] ?? null;

  // Filtered parts list
  const filteredParts = parts.filter((part) => {
    const matchesZone = selectedZone === 'ALL' || part.zone === selectedZone;
    const matchesStatus = selectedStatus === 'ALL' || part.status === selectedStatus;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query === '' ||
      part.modelName.toLowerCase().includes(query) ||
      part.serialNumber.toLowerCase().includes(query) ||
      part.manufacturerName.toLowerCase().includes(query) ||
      part.manufacturerAddress.toLowerCase().includes(query) ||
      part.zone.toLowerCase().includes(query);
    return matchesZone && matchesStatus && matchesSearch;
  });

  // Counts
  const activeCount = parts.filter((p) => p.status === 'ACTIVE').length;
  const maintenanceCount = parts.filter((p) => p.status === 'MAINTENANCE').length;
  const decommissionedCount = parts.filter((p) => p.status === 'DECOMMISSIONED').length;

  const handleCopyHash = (hash: string) => {
    void navigator.clipboard?.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => {
      setCopiedHash((prev) => (prev === hash ? null : prev));
    }, 1800);
  };

  // Sign & Register New Bionic Part with Felipe's @sdk/pqc ML-DSA-87 & SHAKE-256
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    const encoder = new TextEncoder();
    const cleanSerial = regSerialNumber.trim() || `SN-${Math.floor(1000 + Math.random() * 9000)}`;
    const cleanModel = regModelName.trim() || 'Cyber-Synapse Implant';
    const cleanSemver = regFirmwareSemver.trim() || 'v1.0.0';

    const fwBytes = encoder.encode(
      `${cleanModel}::${cleanSerial}::${cleanSemver}::${regPayloadText}::${Date.now()}`
    );
    const calBytes = encoder.encode(
      `CALIBRATION::${cleanSerial}::${regZone}::ISO-11073-PQC`
    );
    const partIdSeed = encoder.encode(`PART_ID::${cleanSerial}::${Date.now()}`);

    const firmwareHash = computeShake256(fwBytes);
    const calibrationHash = computeShake256(calBytes);
    const partId = computeShake256(partIdSeed);

    // Sign with NIST FIPS 204 ML-DSA-87 (4,627-byte signature)
    const signatureHex = signMLDSA87(fwBytes, oemDsaKeyPair.secretKey);
    const verified = verifyMLDSA87(fwBytes, signatureHex, oemDsaKeyPair.publicKey);
    const signatureBytesLen = (signatureHex.length - 2) / 2;

    const currentBlock = 4892106 + parts.length;
    const nowUtc = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

    const newPart: MockBionicPart = {
      partId,
      modelName: cleanModel,
      serialNumber: cleanSerial,
      zone: regZone,
      zoneIndex: getZoneIndex(regZone),
      status: 'ACTIVE',
      statusIndex: 0,
      manufacturerName: regManufacturerName.trim() || 'BioNeural OEM Enclave',
      manufacturerAddress: liveWallet ?? regManufacturerAddress,
      firmwareVersion: 1,
      firmwareSemver: cleanSemver,
      firmwareHash,
      calibrationHash,
      calibrationScorePct: 99.95,
      implantedBlock: currentBlock,
    };

    const genesisHistory: MockFirmwareHistoryEntry = {
      version: 1,
      semver: cleanSemver,
      badge: `${cleanSemver} [GENESIS IMPLANT - ML-DSA-87]`,
      timestampUtc: nowUtc,
      blockNumber: currentBlock,
      firmwareHash,
      calibrationHash,
      signerAddress: liveWallet ?? regManufacturerAddress,
      description: `Genesis HBOM surgical registration for ${cleanModel} (${cleanSerial}). Attested via NIST FIPS 204 ML-DSA-87 (${signatureBytesLen.toLocaleString()} bytes).`,
    };

    setRegSignatureResult({
      verified,
      signatureBytesLen,
      signatureHexPreview: `${signatureHex.slice(0, 22)}...${signatureHex.slice(-14)}`,
      firmwareHash,
      calibrationHash,
      serial: cleanSerial,
    });

    setIsRegistering(true);
    try {
      const finalPartId = await onRegisterPart(newPart, genesisHistory, signatureHex);
      setSelectedPartId(finalPartId);
    } catch (err) {
      setRegSignatureResult(null);
      setRegError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRegistering(false);
    }
  };

  // Open Firmware Patcher for a Bionic Part
  const handleOpenPatcher = (part: MockBionicPart) => {
    setSelectedPartId(part.partId);
    setPatchErrorMsg(null);
    if (part.status === 'DECOMMISSIONED') {
      setPatchingPartId(part.partId);
      setPatchErrorMsg(
        'SynapseVaultRegistry__PartAlreadyDecommissioned: Cannot push firmware updates to a DECOMMISSIONED bionic implant with zeroized enclave tombstone hashes.'
      );
      return;
    }
    const nextMinor = part.firmwareVersion + 1;
    setPatchSemver(`v${nextMinor}.0.0`);
    setPatchDescription(
      `Monotonic revision #${nextMinor} lattice telemetry firmware upgrade for ${part.modelName}.`
    );
    setPatchingPartId(part.partId);
  };

  // Execute ML-DSA-87 Firmware Patch
  const handleExecuteFirmwarePatch = async (part: MockBionicPart) => {
    if (part.status === 'DECOMMISSIONED') {
      setPatchErrorMsg(
        'REVERTED: SynapseVaultRegistry__PartAlreadyDecommissioned() — Decommissioned implants reject all firmware mutations on QoreChain L1.'
      );
      return;
    }

    const encoder = new TextEncoder();
    const nextVersion = part.firmwareVersion + 1;
    const cleanSemver = patchSemver.trim() || `v${nextVersion}.0.0`;
    const payloadBytes = encoder.encode(
      `FW_PATCH::${part.partId}::v${nextVersion}::${cleanSemver}::${patchDescription}::${Date.now()}`
    );
    const calBytes = encoder.encode(
      `CAL_PATCH::${part.partId}::v${nextVersion}::${Date.now()}`
    );

    const firmwareHash = computeShake256(payloadBytes);
    const calibrationHash = computeShake256(calBytes);

    const signatureHex = signMLDSA87(payloadBytes, oemDsaKeyPair.secretKey);
    const verified = verifyMLDSA87(payloadBytes, signatureHex, oemDsaKeyPair.publicKey);
    const sigBytes = (signatureHex.length - 2) / 2;

    const nowUtc = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    const nextBlock = 4892120 + firmwareHistory.length;

    const entry: MockFirmwareHistoryEntry = {
      version: nextVersion,
      semver: cleanSemver,
      badge: `${cleanSemver} [LATEST - MONOTONIC #${nextVersion}]`,
      timestampUtc: nowUtc,
      blockNumber: nextBlock,
      firmwareHash,
      calibrationHash,
      signerAddress: part.manufacturerAddress,
      description: `${patchDescription} (ML-DSA-87 verified: ${sigBytes.toLocaleString()}B sig).`,
    };

    try {
      await onPushFirmwareUpdate(part.partId, entry, signatureHex);
    } catch (err) {
      setPatchErrorMsg(err instanceof Error ? err.message : String(err));
      return;
    }
    setPatchSuccessBanner({
      partId: part.partId,
      semver: cleanSemver,
      firmwareHash,
      sigBytes,
      verified,
    });
    setPatchingPartId(null);
  };

  // Export or preview Full HBOM Merkle Proof (JSON-LD)
  const handleExportMerkleProof = () => {
    const target = selectedPart ?? parts[0];
    const encoder = new TextEncoder();
    const merkleSeed = encoder.encode(
      `HBOM_MERKLE_ROOT::${target?.partId ?? '0x0'}::${firmwareHistory.length}::9800`
    );
    const merkleRoot = computeShake256(merkleSeed);
    const sigHex = signMLDSA87(merkleSeed, oemDsaKeyPair.secretKey);
    const isVerified = verifyMLDSA87(merkleSeed, sigHex, oemDsaKeyPair.publicKey);

    const jsonLdDoc = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://qorechain.network/schemas/cyber-hbom-v4.jsonld',
      ],
      type: ['VerifiableCredential', 'CyberHumanHBOMAttestation'],
      issuer: target?.manufacturerAddress ?? '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      chainId: 9800,
      network: 'QoreChain Diana Testnet',
      cryptographicSuite: {
        signatureStandard: 'NIST FIPS 204 (ML-DSA-87)',
        signatureSizeBytes: (sigHex.length - 2) / 2,
        hashPrimitive: 'SHAKE-256 (256-bit)',
        verifiedInEnclave: isVerified,
      },
      bionicComponent: target
        ? {
            partId: target.partId,
            modelName: target.modelName,
            serialNumber: target.serialNumber,
            anatomicalZone: target.zone,
            lifecycleStatus: target.status,
            firmwareVersion: target.firmwareVersion,
            firmwareSemver: target.firmwareSemver,
            firmwareHash: target.firmwareHash,
            calibrationHash: target.calibrationHash,
            calibrationScorePct: target.calibrationScorePct,
            implantedBlock: target.implantedBlock,
          }
        : null,
      merkleRoot,
      auditTrailEntries: firmwareHistory.length,
      signaturePreview: `${sigHex.slice(0, 34)}...${sigHex.slice(-16)}`,
      exportedAtUtc: new Date().toISOString(),
    };

    const formatted = JSON.stringify(jsonLdDoc, null, 2);
    setJsonLdPreview(formatted);

    try {
      const blob = new Blob([formatted], { type: 'application/ld+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HBOM_MerkleProof_${target?.serialNumber ?? 'SynapseQ'}.jsonld`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: preview remains open in UI
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start text-reb-text-light">
      {/* =================================================================== */}
      {/* LEFT FLOATING GLASS HUD SIDEBAR (lg:col-span-4)                     */}
      {/* =================================================================== */}
      <aside className="lg:col-span-4 flex flex-col gap-3.5 pointer-events-auto">
        {/* Card 1: Compact Anatomical Zone Filter Chips & Register Bionic Part HUD Card */}
        <div className="bg-[#131B18]/55 backdrop-blur-md border border-reb-mint/30 rounded-xl p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-2.5">
          {/* Header & Zone Filter Pills */}
          <div className="flex items-center justify-between border-b border-reb-border/60 pb-2">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-reb-mint" />
              <span className="font-display text-xs font-bold uppercase tracking-wider text-reb-text-light">
                ANATOMICAL ZONE FILTER
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-reb-mint/15 text-reb-mint font-mono text-[9px] font-bold">
              {selectedZone}
            </span>
          </div>

          {/* Compact Zone Pills */}
          <div className="flex flex-wrap gap-1.5">
            {ANATOMICAL_ZONES.map((zone) => {
              const count =
                zone.id === 'ALL'
                  ? parts.length
                  : parts.filter((p) => p.zone === zone.id).length;
              const isSelected = selectedZone === zone.id;

              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => setSelectedZone(zone.id)}
                  title={zone.subtitle}
                  className={`px-2 py-1 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? 'bg-reb-mint text-reb-bg border-reb-mint shadow-[0_0_12px_rgba(168,240,198,0.25)]'
                      : 'bg-reb-surface-code/70 border-reb-border/70 text-reb-text-muted hover:text-reb-text-light hover:border-reb-mint/50'
                  }`}
                >
                  <span>{zone.label}</span>
                  <span
                    className={`px-1 py-0.2 rounded text-[9px] ${
                      isSelected
                        ? 'bg-reb-bg/20 text-reb-bg'
                        : 'bg-reb-blue/25 text-reb-periwinkle'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Compact Register Form */}
          <div className="pt-2 border-t border-reb-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-reb-mint" />
                <h2 className="font-display text-xs font-bold uppercase tracking-wider text-reb-text-light">
                  REGISTER NEW BIONIC PART (ML-DSA-87)
                </h2>
              </div>
              <span className="font-mono text-[9px] text-reb-mint">FIPS 204</span>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-reb-text-muted">
                    Model Name
                  </label>
                  <input
                    type="text"
                    required
                    value={regModelName}
                    onChange={(e) => setRegModelName(e.target.value)}
                    placeholder="Neuro-Synapse Gen 5"
                    className="w-full rounded-md bg-reb-surface-code/85 border border-reb-border px-2.5 py-1 font-mono text-[11px] text-reb-text-light focus:outline-none focus:border-reb-mint"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-reb-text-muted">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    required
                    value={regSerialNumber}
                    onChange={(e) => setRegSerialNumber(e.target.value)}
                    placeholder="SN-8820-BCI-X"
                    className="w-full rounded-md bg-reb-surface-code/85 border border-reb-border px-2.5 py-1 font-mono text-[11px] text-reb-text-light focus:outline-none focus:border-reb-mint"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-reb-text-muted">
                    Zone
                  </label>
                  <select
                    value={regZone}
                    onChange={(e) => setRegZone(e.target.value as AnatomicalZoneLabel)}
                    className="w-full rounded-md bg-reb-surface-code/85 border border-reb-border px-1.5 py-1 font-mono text-[10px] text-reb-text-light focus:outline-none focus:border-reb-mint"
                  >
                    <option value="NEURAL">NEURAL</option>
                    <option value="OCULAR">OCULAR</option>
                    <option value="CARDIOVASCULAR">CARDIOVASCULAR</option>
                    <option value="LOCOMOTOR">LOCOMOTOR</option>
                    <option value="ORGAN">ORGAN</option>
                    <option value="SUBDERMAL">SUBDERMAL</option>
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-reb-text-muted">
                    OEM Name
                  </label>
                  <input
                    type="text"
                    required
                    value={regManufacturerName}
                    onChange={(e) => setRegManufacturerName(e.target.value)}
                    className="w-full rounded-md bg-reb-surface-code/85 border border-reb-border px-2 py-1 font-mono text-[11px] text-reb-text-light focus:outline-none focus:border-reb-mint"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-reb-text-muted">
                    Semver
                  </label>
                  <input
                    type="text"
                    required
                    value={regFirmwareSemver}
                    onChange={(e) => setRegFirmwareSemver(e.target.value)}
                    placeholder="v1.0.0"
                    className="w-full rounded-md bg-reb-surface-code/85 border border-reb-border px-2 py-1 font-mono text-[11px] text-reb-mint focus:outline-none focus:border-reb-mint"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-reb-text-muted">
                    OEM Address (QoreChain)
                  </label>
                  <input
                    type="text"
                    required
                    value={liveWallet ?? regManufacturerAddress}
                    disabled={Boolean(liveWallet)}
                    title={
                      liveWallet
                        ? 'En modo on-chain el fabricante es la wallet conectada (el contrato lo exige)'
                        : undefined
                    }
                    onChange={(e) =>
                      setRegManufacturerAddress(e.target.value as `0x${string}`)
                    }
                    className="w-full rounded-md bg-reb-surface-code/85 border border-reb-border px-2 py-1 font-mono text-[10px] text-reb-mint focus:outline-none focus:border-reb-mint"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-reb-text-muted">
                    Firmware Payload Image
                  </label>
                  <input
                    type="text"
                    value={regPayloadText}
                    onChange={(e) => setRegPayloadText(e.target.value)}
                    className="w-full rounded-md bg-reb-surface-code/85 border border-reb-border px-2 py-1 font-mono text-[10px] text-reb-text-light focus:outline-none focus:border-reb-mint"
                  />
                </div>
              </div>

              {regError && (
                <div className="p-2 rounded-md bg-reb-pink/15 border border-reb-pink text-[10px] font-mono text-reb-pink">
                  {regError}
                </div>
              )}

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full py-2 disabled:opacity-50 px-3 rounded-lg bg-reb-mint text-reb-bg font-mono text-[11px] font-bold uppercase tracking-wider hover:brightness-110 transition-all shadow-[0_0_16px_rgba(168,240,198,0.3)] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Fingerprint className="w-3.5 h-3.5" />
                <span>
                  {isRegistering
                    ? 'Registrando…'
                    : liveWallet
                      ? 'Sign with ML-DSA-87 & Register (on-chain)'
                      : 'Sign with ML-DSA-87 & Register'}
                </span>
              </button>
            </form>

            {/* Compact Real-Time ML-DSA-87 Verification Result Banner */}
            {regSignatureResult && (
              <div className="p-2 rounded-lg bg-reb-surface-code/90 border border-reb-mint/60 flex flex-col gap-1 font-mono text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-reb-mint font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    ML-DSA-87 VERIFIED: {regSignatureResult.verified ? 'TRUE' : 'FALSE'}
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-reb-mint/20 text-reb-mint text-[9px] font-bold">
                    {regSignatureResult.signatureBytesLen.toLocaleString()} B
                  </span>
                </div>
                <div className="text-reb-text-muted text-[9px] flex justify-between">
                  <span>{regSignatureResult.serial} • SHAKE-256:</span>
                  <span className="text-reb-mint">
                    {regSignatureResult.firmwareHash.slice(0, 12)}...
                    {regSignatureResult.firmwareHash.slice(-6)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Registered Bionic Implants Compact List */}
        <div className="bg-[#131B18]/50 backdrop-blur-md border border-reb-mint/25 rounded-xl p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-2.5">
          <div className="flex items-center justify-between border-b border-reb-border/60 pb-2">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-reb-mint" />
              <span className="font-display text-xs font-bold uppercase tracking-wider text-reb-text-light">
                REGISTERED BIONIC IMPLANTS ({filteredParts.length})
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[9px]">
              <span className="text-reb-mint">{activeCount} ACT</span>
              <span className="text-reb-yellow">{maintenanceCount} MNT</span>
              <span className="text-reb-pink">{decommissionedCount} DEC</span>
            </div>
          </div>

          {/* Search input */}
          <div className="flex items-center gap-2 bg-reb-surface-code/80 border border-reb-border px-2.5 py-1.5 rounded-lg">
            <Search className="w-3.5 h-3.5 text-reb-text-muted shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search model, serial, OEM, or zone..."
              className="w-full bg-transparent font-mono text-[11px] text-reb-text-light placeholder:text-reb-text-dim focus:outline-none"
            />
          </div>

          {/* Compact Status Tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_TABS.map((tab) => {
              const count =
                tab === 'ALL'
                  ? parts.length
                  : parts.filter((p) => p.status === tab).length;
              const isSelected = selectedStatus === tab;

              let tabColorClass =
                'bg-reb-surface/60 text-reb-text-muted border-reb-border hover:text-reb-text-light';
              if (isSelected) {
                if (tab === 'DECOMMISSIONED') {
                  tabColorClass = 'bg-reb-pink text-reb-bg border-reb-pink font-bold';
                } else if (tab === 'MAINTENANCE') {
                  tabColorClass = 'bg-reb-yellow text-reb-bg border-reb-yellow font-bold';
                } else {
                  tabColorClass = 'bg-reb-mint text-reb-bg border-reb-mint font-bold';
                }
              }

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSelectedStatus(tab)}
                  className={`px-2 py-0.5 rounded border font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer ${tabColorClass}`}
                >
                  {tab === 'DECOMMISSIONED'
                    ? 'DECOM'
                    : tab === 'MAINTENANCE'
                      ? 'MAINT'
                      : tab}{' '}
                  ({count})
                </button>
              );
            })}
          </div>

          {/* Latest Firmware Patch Success Notification */}
          {patchSuccessBanner && (
            <div className="p-2 rounded-lg bg-reb-surface-code/90 border border-reb-mint flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-reb-mint shrink-0" />
                <div>
                  <span className="text-reb-mint font-bold">
                    FW {patchSuccessBanner.semver} COMMITTED
                  </span>
                  <p className="text-[9px] text-reb-text-muted">
                    ML-DSA-87 ({patchSuccessBanner.sigBytes.toLocaleString()}B) •{' '}
                    {patchSuccessBanner.firmwareHash.slice(0, 10)}...
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPatchSuccessBanner(null)}
                className="text-[9px] font-mono text-reb-text-muted hover:text-reb-text-light cursor-pointer"
              >
                [X]
              </button>
            </div>
          )}

          {/* Scrollable Compact Implant Cards */}
          <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
            {filteredParts.map((part) => {
              const isSelected = selectedPart?.partId === part.partId;
              const isDecommissioned = part.status === 'DECOMMISSIONED';
              const isMaintenance = part.status === 'MAINTENANCE';

              return (
                <article
                  key={part.partId}
                  onClick={() => setSelectedPartId(part.partId)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer space-y-2 ${
                    isDecommissioned
                      ? 'bg-reb-pink/10 border-reb-pink/40'
                      : isSelected
                        ? 'bg-[#17221E]/85 border-reb-mint shadow-[0_0_16px_rgba(168,240,198,0.16)]'
                        : 'bg-[#17221E]/50 border-reb-border hover:border-reb-mint/50'
                  }`}
                >
                  {/* Top Row: Model, Zone Badge, Status Badge */}
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3
                          className={`font-display text-xs font-bold truncate ${
                            isDecommissioned
                              ? 'text-reb-pink line-through'
                              : 'text-reb-text-light'
                          }`}
                        >
                          {part.modelName}
                        </h3>
                        <span
                          className="px-1.5 py-0.2 rounded font-mono text-[8px] font-bold uppercase tracking-wider text-white"
                          style={{ backgroundColor: '#3B66E8' }}
                        >
                          {part.zone}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-reb-text-muted truncate">
                        {part.serialNumber} • {part.manufacturerName}
                      </p>
                    </div>

                    {part.status === 'ACTIVE' && (
                      <span className="px-1.5 py-0.5 rounded bg-reb-mint/20 border border-reb-mint/50 text-reb-mint font-mono text-[9px] font-bold uppercase flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-reb-mint animate-pulse" />
                        ACTIVE
                      </span>
                    )}
                    {part.status === 'MAINTENANCE' && (
                      <span className="px-1.5 py-0.5 rounded bg-reb-yellow/20 border border-reb-yellow/50 text-reb-yellow font-mono text-[9px] font-bold uppercase flex items-center gap-1 shrink-0">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        MAINT
                      </span>
                    )}
                    {part.status === 'DECOMMISSIONED' && (
                      <span className="px-1.5 py-0.5 rounded bg-reb-pink/20 border border-reb-pink/50 text-reb-pink font-mono text-[9px] font-bold uppercase flex items-center gap-1 shrink-0">
                        <XCircle className="w-2.5 h-2.5" />
                        DECOM
                      </span>
                    )}
                  </div>

                  {/* Firmware & Hash Row */}
                  <div className="flex items-center justify-between px-2 py-1 rounded bg-reb-surface-code/75 border border-reb-border/60 font-mono text-[10px]">
                    <span className="text-reb-mint font-bold">
                      {part.firmwareSemver} (#{part.firmwareVersion})
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className={
                          isDecommissioned
                            ? 'text-reb-pink'
                            : isMaintenance
                              ? 'text-reb-yellow'
                              : 'text-reb-text-muted'
                        }
                      >
                        {part.firmwareHash.slice(0, 8)}...{part.firmwareHash.slice(-4)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyHash(part.firmwareHash);
                        }}
                        className="text-reb-text-muted hover:text-reb-mint cursor-pointer"
                        title="Copy SHAKE-256 Firmware Hash"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Action Controls Row */}
                  <div
                    className="flex items-center justify-between gap-1.5 flex-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Quick status selector */}
                    <div className="flex items-center gap-0.5 bg-reb-surface-code/90 p-0.5 rounded border border-reb-border">
                      {(['ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED'] as const).map(
                        (statusOption) => {
                          const activeBtn = part.status === statusOption;
                          let activeStyle = 'text-reb-text-muted hover:text-reb-text-light';
                          if (activeBtn) {
                            if (statusOption === 'ACTIVE') {
                              activeStyle = 'bg-reb-mint text-reb-bg font-bold';
                            } else if (statusOption === 'MAINTENANCE') {
                              activeStyle = 'bg-reb-yellow text-reb-bg font-bold';
                            } else {
                              activeStyle = 'bg-reb-pink text-reb-bg font-bold';
                            }
                          }
                          return (
                            <button
                              key={statusOption}
                              type="button"
                              onClick={() => {
                                setPatchErrorMsg(null);
                                onUpdatePartStatus(part.partId, statusOption).catch(
                                  (err: unknown) =>
                                    setPatchErrorMsg(
                                      err instanceof Error ? err.message : String(err)
                                    )
                                );
                              }}
                              className={`px-1.5 py-0.5 rounded font-mono text-[8px] uppercase transition-all cursor-pointer ${activeStyle}`}
                              title={`Set lifecycle status to ${statusOption} (Index ${getStatusIndex(statusOption)})`}
                            >
                              {statusOption === 'DECOMMISSIONED'
                                ? 'DECOM'
                                : statusOption === 'MAINTENANCE'
                                  ? 'MAINT'
                                  : 'ACTIVE'}
                            </button>
                          );
                        }
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenPatcher(part)}
                        className={`px-2 py-1 rounded font-mono text-[9px] font-bold uppercase flex items-center gap-1 transition-all cursor-pointer ${
                          isDecommissioned
                            ? 'bg-reb-pink/20 border border-reb-pink/50 text-reb-pink'
                            : 'bg-reb-mint text-reb-bg hover:brightness-110'
                        }`}
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>Patch FW</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onGrantTelemetryPassForPart(part)}
                        className="px-2 py-1 rounded bg-reb-blue/25 border border-reb-blue/60 text-reb-periwinkle hover:bg-reb-blue hover:text-white font-mono text-[9px] font-bold uppercase flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Key className="w-2.5 h-2.5" />
                        <span>2h Pass</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </aside>

      {/* =================================================================== */}
      {/* CENTER & RIGHT TACTICAL MAP CORRIDOR (lg:col-span-8)                */}
      {/* =================================================================== */}
      <div className="lg:col-span-8 min-h-[560px] flex flex-col justify-between pointer-events-none">
        {/* Top Floating HBOM Telemetry Pill Bar */}
        <div className="self-center flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0B100E]/75 backdrop-blur-md border border-reb-mint/30 font-mono text-[11px] text-reb-text-light shadow-lg">
            <Cpu className="w-3.5 h-3.5 text-reb-mint" />
            <span>
              <strong className="text-reb-mint">{parts.length}</strong> HBOM Implants (
              <span className="text-reb-mint">{activeCount} Active</span>)
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0B100E]/75 backdrop-blur-md border border-reb-mint/30 font-mono text-[11px] text-reb-mint shadow-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-reb-mint" />
            <span>100% SHAKE-256 Verified</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0B100E]/75 backdrop-blur-md border border-reb-blue/50 font-mono text-[11px] text-reb-periwinkle shadow-lg">
            <Lock className="w-3.5 h-3.5 text-reb-periwinkle" />
            <span>NIST FIPS 204 ML-DSA-87 (4,627 B)</span>
          </div>
        </div>

        {/* Open Center Map Space: leaves the central tactical GPS map corridor unobstructed */}
        <div className="my-auto" />

        {/* Bottom-Right Floating Glass Firmware Audit & Patcher Drawer */}
        <div className="self-end w-full max-w-[520px] pointer-events-auto mt-auto bg-[#131B18]/65 backdrop-blur-md border border-reb-mint/35 rounded-xl p-4 sm:p-5 shadow-[0_16px_40px_rgba(0,0,0,0.8)] relative overflow-hidden space-y-3">
          {/* Top Gradient Bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-reb-blue via-reb-mint-bright to-reb-pink" />

          {/* Drawer Header */}
          <div className="flex items-start justify-between border-b border-reb-border/70 pb-2.5">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-reb-mint animate-pulse shadow-[0_0_8px_#A8F0C6]" />
                <span className="font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-reb-text-light truncate">
                  IMMUTABLE FIRMWARE &amp; CALIBRATION AUDIT
                </span>
              </div>
              <span className="font-mono text-[11px] text-reb-mint mt-0.5 truncate">
                Target: {selectedPart?.modelName ?? 'NeuroLink-X9'} (
                {selectedPart?.serialNumber ?? 'SN-9042-NLX9'}) • Cal:{' '}
                {selectedPart ? `${selectedPart.calibrationScorePct.toFixed(2)}%` : '99.95%'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {selectedPart && (
                <button
                  type="button"
                  onClick={() => handleOpenPatcher(selectedPart)}
                  className="px-2 py-1 rounded bg-reb-mint/20 border border-reb-mint/50 text-reb-mint hover:bg-reb-mint hover:text-reb-bg font-mono text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1"
                >
                  <Wrench className="w-3 h-3" />
                  <span>Patch</span>
                </button>
              )}
              <HeartPulse className="w-4 h-4 text-reb-mint shrink-0" />
            </div>
          </div>

          {/* Inline ML-DSA-87 Firmware Patcher Form (if open for selectedPart or any active patching target) */}
          {selectedPart && patchingPartId === selectedPart.partId && (
            <div className="p-3 rounded-lg bg-reb-surface-code/95 border border-reb-mint/50 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-reb-mint uppercase flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  OEM ML-DSA-87 Firmware Patcher ({selectedPart.serialNumber})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPatchingPartId(null);
                    setPatchErrorMsg(null);
                  }}
                  className="font-mono text-[10px] text-reb-text-muted hover:text-reb-pink cursor-pointer"
                >
                  CLOSE [X]
                </button>
              </div>

              {patchErrorMsg ? (
                <div className="p-2 rounded bg-reb-pink/20 border border-reb-pink text-reb-pink font-mono text-[11px] flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{patchErrorMsg}</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="flex flex-col gap-0.5">
                      <label className="font-mono text-[9px] text-reb-text-muted uppercase">
                        Rev #{selectedPart.firmwareVersion + 1} Semver
                      </label>
                      <input
                        type="text"
                        value={patchSemver}
                        onChange={(e) => setPatchSemver(e.target.value)}
                        className="rounded bg-reb-surface border border-reb-border px-2 py-1 font-mono text-[11px] text-reb-mint focus:outline-none focus:border-reb-mint"
                      />
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-0.5">
                      <label className="font-mono text-[9px] text-reb-text-muted uppercase">
                        Clinical / Telemetry Patch Notes
                      </label>
                      <input
                        type="text"
                        value={patchDescription}
                        onChange={(e) => setPatchDescription(e.target.value)}
                        className="rounded bg-reb-surface border border-reb-border px-2 py-1 font-mono text-[11px] text-reb-text-light focus:outline-none focus:border-reb-mint"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => void handleExecuteFirmwarePatch(selectedPart)}
                      className="px-3 py-1.5 rounded-lg bg-reb-mint text-reb-bg font-mono text-[10px] font-bold uppercase tracking-wider hover:brightness-110 cursor-pointer flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>
                        Sign ML-DSA-87 &amp; Commit Rev #{selectedPart.firmwareVersion + 1}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Compact Monotonic Firmware Audit Timeline */}
          <div className="max-h-[170px] overflow-y-auto pr-1 space-y-2.5 relative pl-4">
            <div className="absolute left-1.5 top-1.5 bottom-1.5 w-0.5 bg-reb-border" />
            {firmwareHistory.map((item, idx) => {
              const isLatest = idx === 0;
              const isCopied = copiedHash === item.firmwareHash;

              return (
                <div
                  key={`${item.version}-${item.blockNumber}-${idx}`}
                  className="relative flex flex-col gap-1"
                >
                  <span
                    className={`absolute -left-4 top-1.5 w-2 h-2 rounded-full ${
                      isLatest ? 'bg-reb-mint shadow-[0_0_8px_#A8F0C6]' : 'bg-reb-blue'
                    }`}
                  />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold uppercase ${
                        isLatest
                          ? 'bg-reb-mint/20 text-reb-mint border border-reb-mint/40'
                          : 'bg-reb-surface-code text-reb-text-muted border border-reb-border'
                      }`}
                    >
                      {item.badge}
                    </span>
                    <span className="font-mono text-[9px] text-reb-text-muted">
                      Block #{item.blockNumber.toLocaleString()}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-reb-surface-code/85 border border-reb-border/70 flex flex-col gap-1 font-mono text-[10px]">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleCopyHash(item.firmwareHash)}
                        className="px-1.5 py-0.5 rounded bg-reb-mint/10 text-reb-mint hover:bg-reb-mint/20 flex items-center gap-1 cursor-pointer"
                        title="Copy SHAKE-256 Digest"
                      >
                        <span>
                          SHAKE-256: {item.firmwareHash.slice(0, 10)}...
                          {item.firmwareHash.slice(-6)}
                        </span>
                        <Copy className="w-2.5 h-2.5" />
                        {isCopied && (
                          <span className="text-[8px] text-reb-yellow font-bold">COPIED</span>
                        )}
                      </button>
                      <span className="text-reb-mint font-bold text-[9px]">
                        ML-DSA-87 VERIFIED
                      </span>
                    </div>
                    <p className="font-sans text-[10px] text-reb-text-muted leading-snug">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export HBOM Merkle Proof (JSON-LD) & Live Diana Stream */}
          <div className="pt-2 border-t border-reb-border/60 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-reb-text-muted truncate">
                <Terminal className="w-3.5 h-3.5 text-reb-mint shrink-0" />
                <span className="truncate">
                  [L1:9800] PK ({oemDsaKeyPair.publicKey.length}B) Armed
                </span>
              </div>
              <button
                type="button"
                onClick={handleExportMerkleProof}
                className="px-3 py-1.5 rounded-lg bg-reb-mint text-reb-bg font-mono text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_14px_rgba(168,240,198,0.25)] shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export HBOM Merkle Proof (JSON-LD)</span>
              </button>
            </div>

            {jsonLdPreview && (
              <div className="p-2.5 rounded-lg bg-reb-surface-code/95 border border-reb-mint/40 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold text-reb-mint uppercase flex items-center gap-1">
                    <FileJson className="w-3 h-3" />
                    JSON-LD HBOM MERKLE ATTESTATION
                  </span>
                  <button
                    type="button"
                    onClick={() => setJsonLdPreview(null)}
                    className="font-mono text-[9px] text-reb-text-muted hover:text-reb-pink cursor-pointer"
                  >
                    HIDE
                  </button>
                </div>
                <pre className="font-mono text-[9px] text-reb-text-light overflow-x-auto max-h-32 leading-relaxed">
                  {jsonLdPreview}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CyberHbomView;

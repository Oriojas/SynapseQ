import type { DataDomain, RetentionPolicy, StorageMode } from '@sdk/storageStrategy';

export type AnatomicalZoneLabel =
  | 'NEURAL'
  | 'OCULAR'
  | 'CARDIOVASCULAR'
  | 'LOCOMOTOR'
  | 'ORGAN'
  | 'SUBDERMAL';

export type PartStatusLabel = 'ACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED';

export interface MockEphemeralPass {
  readonly id: string;
  readonly recordIdHex: `0x${string}`;
  readonly title: string;
  readonly specialistName: string;
  readonly specialistAddress: `0x${string}`;
  readonly patientPseudonym: string;
  readonly domain: DataDomain;
  readonly retention: RetentionPolicy;
  readonly storageProvider: 'pinata-ipfs' | 'qorechain-da' | 'memory-fallback' | 'gateway-local';
  /** Hard-coded example shown for the UI demo: it has no real ciphertext and is NOT on-chain. */
  readonly isSample?: boolean;
  /** true only when grantTimedAccess succeeded on-chain and the envelope is in the gateway. */
  readonly onChain?: boolean;
  readonly linkedPartName: string;
  readonly linkedPartId: `0x${string}`;
  readonly contentHash: `0x${string}`;
  readonly ipfsCid: string;
  readonly remainingSeconds: number;
  readonly revoked: boolean;
  readonly gpsSector: string;
  readonly metrics: {
    readonly neuralLatencyMs: number;
    readonly impedanceKOhm: number;
    readonly coherencePct: number;
  };
}

export interface MockBionicPart {
  readonly partId: `0x${string}`;
  /** Hard-coded example (not registered on-chain). */
  readonly isSample?: boolean;
  /** true only when registerBionicPart succeeded on-chain. */
  readonly onChain?: boolean;
  readonly modelName: string;
  readonly serialNumber: string;
  readonly zone: AnatomicalZoneLabel;
  readonly zoneIndex: number;
  readonly status: PartStatusLabel;
  readonly statusIndex: number;
  readonly manufacturerName: string;
  readonly manufacturerAddress: `0x${string}`;
  readonly firmwareVersion: number;
  readonly firmwareSemver: string;
  readonly firmwareHash: `0x${string}`;
  readonly calibrationHash: `0x${string}`;
  readonly calibrationScorePct: number;
  readonly implantedBlock: number;
}

export interface MockFirmwareHistoryEntry {
  readonly version: number;
  readonly semver: string;
  readonly badge: string;
  readonly timestampUtc: string;
  readonly blockNumber: number;
  readonly firmwareHash: `0x${string}`;
  readonly calibrationHash: `0x${string}`;
  readonly signerAddress: `0x${string}`;
  readonly description: string;
}

export const INITIAL_EPHEMERAL_PASSES: readonly MockEphemeralPass[] = [
  {
    id: 'EQ-9042',
    recordIdHex: '0x9042a1b2c3d4e5f60102030405060708090a0b0c0d0e0f101112131415169042',
    title: 'NeuroLink-X9 BCI Shard',
    specialistName: 'Dr. Elena Rostova (Neo-Geneva BioClinic)',
    specialistAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    patientPseudonym: 'AnonPatient-0x94B',
    domain: 'BIONIC_TELEMETRY',
    retention: 'ephemeral',
    storageProvider: 'qorechain-da',
    linkedPartName: 'NeuroLink-X9 BCI (SN-9042-NLX9)',
    linkedPartId: '0x4b7f8c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6fc18a',
    contentHash: '0x4f82e91c44b78a1290bcde441239876543210fedcba9876543210fedcba991ab',
    ipfsCid: 'qorechain-da://0x4f82e91c44b78a1290bcde4412398765',
    remainingSeconds: 2598,
    revoked: false,
    gpsSector: 'SEC-09 // 2.4 KM',
    metrics: {
      neuralLatencyMs: 0.42,
      impedanceKOhm: 12.4,
      coherencePct: 99.8,
    },
  },
  {
    id: 'EQ-8819',
    recordIdHex: '0x8819a1b2c3d4e5f60102030405060708090a0b0c0d0e0f101112131415168819',
    title: 'Cranial CT & Synaptic Mesh Shard Vol. 3',
    specialistName: 'Diagnostic Oracle Node-07 (QoreChain)',
    specialistAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    patientPseudonym: 'AnonPatient-0x12A',
    domain: 'CLINICAL',
    retention: 'long-term',
    storageProvider: 'pinata-ipfs',
    linkedPartName: 'Cranial CT Shard Vol. 3 (420MB Spatial Voxel)',
    linkedPartId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    contentHash: '0x9e12a08934bc77123890ab451234567890abcdef1234567890abcdef1234ff03',
    ipfsCid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    remainingSeconds: 4492,
    revoked: false,
    gpsSector: 'BUFFER 4 // 1.8 KM',
    metrics: {
      neuralLatencyMs: 1.15,
      impedanceKOhm: 8.2,
      coherencePct: 99.4,
    },
  },
  {
    id: 'EQ-6211',
    recordIdHex: '0x6211a1b2c3d4e5f60102030405060708090a0b0c0d0e0f101112131415166211',
    title: 'CardioPulse Nano-Mesh Shard',
    specialistName: 'Biomarker Audit Corp',
    specialistAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    patientPseudonym: 'AnonPatient-0x77C',
    domain: 'BIONIC_TELEMETRY',
    retention: 'ephemeral',
    storageProvider: 'memory-fallback',
    linkedPartName: 'CardioPulse Nano-Mesh (HBOM #032)',
    linkedPartId: '0x82f1a08934bc77123890ab451234567890abcdef1234567890abcdef1234d8a1',
    contentHash: '0x1a88c08934bc77123890ab451234567890abcdef1234567890abcdef123433d2',
    ipfsCid: 'bafy-synapseq-1a88c08934bc77123890ab4512345678',
    remainingSeconds: 0,
    revoked: true,
    gpsSector: 'SEC-04 // DECOUPLED',
    metrics: {
      neuralLatencyMs: 0,
      impedanceKOhm: 0,
      coherencePct: 0,
    },
  },
];

export const INITIAL_BIONIC_PARTS: readonly MockBionicPart[] = [
  {
    partId: '0x4b7f8c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6fc18a',
    modelName: 'NeuroLink-X9 BCI',
    serialNumber: 'SN-9042-NLX9',
    zone: 'NEURAL',
    zoneIndex: 0,
    status: 'ACTIVE',
    statusIndex: 0,
    manufacturerName: 'BioNeural Dynamics',
    manufacturerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    firmwareVersion: 2,
    firmwareSemver: 'v2.4.1',
    firmwareHash: '0x4f82e91c44b78a1290bcde441239876543210fedcba9876543210fedcba991ab',
    calibrationHash: '0x33b1e91c44b78a1290bcde441239876543210fedcba9876543210fedcba9c089',
    calibrationScorePct: 99.84,
    implantedBlock: 4891920,
  },
  {
    partId: '0x1a888c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f33d2',
    modelName: 'Titan-7 Myo-Dex Bionic Arm',
    serialNumber: 'SN-7704-T7MD',
    zone: 'LOCOMOTOR',
    zoneIndex: 3,
    status: 'ACTIVE',
    statusIndex: 0,
    manufacturerName: 'Aetheric Prosthetics',
    manufacturerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    firmwareVersion: 3,
    firmwareSemver: 'v3.1.0',
    firmwareHash: '0x7c11e91c44b78a1290bcde441239876543210fedcba9876543210fedcba9889e',
    calibrationHash: '0x99a4e91c44b78a1290bcde441239876543210fedcba9876543210fedcba91102',
    calibrationScorePct: 99.91,
    implantedBlock: 4720104,
  },
  {
    partId: '0x9e128c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6fff03',
    modelName: 'Optic-Q4 Photonic Retina',
    serialNumber: 'SN-8819-OPQ4',
    zone: 'OCULAR',
    zoneIndex: 1,
    status: 'MAINTENANCE',
    statusIndex: 1,
    manufacturerName: 'Neo-Geneva Ocular',
    manufacturerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    firmwareVersion: 1,
    firmwareSemver: 'v1.9.8',
    firmwareHash: '0x55d2e91c44b78a1290bcde441239876543210fedcba9876543210fedcba944a1',
    calibrationHash: '0x11e9e91c44b78a1290bcde441239876543210fedcba9876543210fedcba9aa54',
    calibrationScorePct: 97.4,
    implantedBlock: 4510220,
  },
  {
    partId: '0x82f18c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6fd8a1',
    modelName: 'CardioPulse Nano-Mesh',
    serialNumber: 'SN-6211-CPNM',
    zone: 'CARDIOVASCULAR',
    zoneIndex: 2,
    status: 'DECOMMISSIONED',
    statusIndex: 2,
    manufacturerName: 'Vascular Lattice Labs',
    manufacturerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    firmwareVersion: 1,
    firmwareSemver: 'v1.0.0',
    firmwareHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    calibrationHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    calibrationScorePct: 0,
    implantedBlock: 4110880,
  },
];

export const INITIAL_FIRMWARE_HISTORY: readonly MockFirmwareHistoryEntry[] = [
  {
    version: 2,
    semver: 'v2.4.1',
    badge: 'v2.4.1 [LATEST - MONOTONIC]',
    timestampUtc: '2026-11-25 08:32 UTC',
    blockNumber: 4891920,
    firmwareHash: '0x4f82e91c44b78a1290bcde441239876543210fedcba9876543210fedcba991ab',
    calibrationHash: '0x33b1e91c44b78a1290bcde441239876543210fedcba9876543210fedcba9c089',
    signerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    description:
      'Lattice-resistant quantum noise filter patch applied to motor cortex telemetry channel.',
  },
  {
    version: 1,
    semver: 'v1.0.0',
    badge: 'v1.0.0 [GENESIS IMPLANT]',
    timestampUtc: '2026-10-10 14:00 UTC',
    blockNumber: 4100500,
    firmwareHash: '0x11e9e91c44b78a1290bcde441239876543210fedcba9876543210fedcba9aa54',
    calibrationHash: '0x11e9e91c44b78a1290bcde441239876543210fedcba9876543210fedcba9aa54',
    signerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    description:
      'Surgical implant registry root anchor on QoreChain Diana Testnet (ML-DSA-87 attested).',
  },
];

export const STORAGE_MODE_OPTIONS: readonly {
  readonly id: StorageMode;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    id: 'auto',
    label: 'AUTO SMART ROUTER (SynapseStorageRouter)',
    description: 'Routes ephemeral bionic telemetry to QoreChain x/rdk DA & clinical DICOM to Pinata IPFS',
  },
  {
    id: 'qorechain-da',
    label: 'QORECHAIN NATIVE DA (x/rdk Sovereign Rollup)',
    description: 'Auto-pruned EndBlocker DA blob (<= 2 MiB) for high-frequency bionic telemetry',
  },
  {
    id: 'pinata-ipfs',
    label: 'PINATA IPFS (50-70yr Long-Term Archive)',
    description: 'Persistent content-addressed encrypted storage for clinical DICOM & HBOM specs',
  },
  {
    id: 'memory-fallback',
    label: 'BROWSER ENCLAVE FALLBACK (Zero-Disk RAM)',
    description: 'Local memory fallback when offline or without Pinata JWT',
  },
];

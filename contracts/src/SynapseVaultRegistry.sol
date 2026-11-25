// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SynapseVaultRegistry
 * @notice Post-Quantum Ephemeral Health Vault & Cyber-Human HBOM Registry.
 * @dev Built for the QoreChain "Build Before Q-Day" Hackathon (Diana Testnet, Chain ID 9800).
 *
 *      Security model (v2):
 *      - The contract is the on-chain *policy & audit* layer. It NEVER receives the ML-KEM-1024
 *        envelope or the storage CID: EVM storage and calldata are public, so anything sent here
 *        is readable forever (`private` does not hide storage, and `msg.sender` in a `view` call
 *        is spoofable). Only 32-byte commitments are stored.
 *      - Envelopes are held by the off-chain Key-Release Gateway, which releases them only to a
 *        wallet that proves key possession (signature) while `isAccessValid(recordId)` is true.
 *      - Revocation stops *future* releases. It cannot recall a key that was already delivered.
 */
contract SynapseVaultRegistry {
    // =========================================================================
    // Custom Errors
    // =========================================================================

    error ZeroAddress();
    error InvalidDuration();
    error InvalidHash();
    error RecordAlreadyExists();
    error RecordNotFound();
    error Unauthorized();
    error AccessAlreadyRevoked();
    error AccessExpired();
    error PartAlreadyRegistered();
    error PartNotFound();
    error PartDecommissioned();
    error InvalidKemPublicKey();
    error EmptySignature();

    // =========================================================================
    // Enums & Structs
    // =========================================================================

    enum RecordDomain {
        CLINICAL,
        BIONIC_TELEMETRY
    }

    enum AnatomicalZone {
        NEURAL,
        OCULAR,
        CARDIOVASCULAR,
        LOCOMOTOR,
        ORGAN,
        SUBDERMAL
    }

    enum PartStatus {
        ACTIVE,
        MAINTENANCE,
        DECOMMISSIONED
    }

    struct AccessGrant {
        // Slot 0 (30/32 bytes)
        address patient; // 20B - Data owner / cyber-human bearer
        uint64 createdAt; // 8B
        RecordDomain domain; // 1B
        bool revoked; // 1B - Manual revocation flag
        // Slot 1 (32/32 bytes)
        address specialist; // 20B - Authorized doctor or bio-engineer
        uint64 validUntil; // 8B
        uint32 epoch; // 4B - Patient kill-switch epoch at grant time
        // Slot 2..4
        bytes32 contentHash; // SHAKE-256 of the *ciphertext* (integrity, no plaintext oracle)
        bytes32 envelopeHash; // keccak256 of the ML-KEM-1024 envelope held by the gateway
        bytes32 linkedPartId; // bytes32(0) for pure clinical records, or HBOM partId
    }

    struct GrantMetadata {
        bytes32 contentHash;
        bytes32 envelopeHash;
        bytes32 linkedPartId;
        address patient;
        address specialist;
        RecordDomain domain;
        uint64 createdAt;
        uint64 validUntil;
        bool revoked;
        bool isActive;
    }

    struct BionicPart {
        // Slot 0 (32/32 bytes)
        address bearer; // 20B - Cyber-human owner wallet
        uint64 implantedAt; // 8B
        uint32 firmwareVersion; // 4B - Monotonic firmware counter
        // Slot 1 (30/32 bytes)
        address manufacturer; // 20B - OEM that registered the part (msg.sender)
        uint64 lastUpdatedAt; // 8B
        AnatomicalZone zone; // 1B
        PartStatus status; // 1B
        // Slot 2..
        bytes32 partId; // keccak256(abi.encode(manufacturer, serialNumber))
        bytes32 firmwareHash; // Active firmware SHAKE-256 hash
        bytes32 calibrationHash; // Calibration parameters hash
        bytes32 pqcSignatureHash; // keccak256 of the ML-DSA-87 attestation (full bytes in event)
        string modelName;
        string serialNumber;
    }

    struct FirmwareRecord {
        // Slot 0 (32/32 bytes)
        address updatedBy; // 20B
        uint64 timestamp; // 8B
        uint32 version; // 4B
        // Slot 1..3
        bytes32 firmwareHash;
        bytes32 calibrationHash;
        bytes32 pqcSignatureHash;
    }

    // =========================================================================
    // Constants
    // =========================================================================

    /// @notice Maximum validity window for a single ephemeral access pass.
    uint256 public constant MAX_ACCESS_DURATION = 365 days;

    /// @notice NIST FIPS 203 ML-KEM-1024 public key size in bytes.
    uint256 public constant ML_KEM_1024_PUBLIC_KEY_BYTES = 1568;

    // =========================================================================
    // Storage
    // =========================================================================

    mapping(bytes32 => AccessGrant) private _grants;
    mapping(address => bytes32[]) private _specialistGrants;
    mapping(address => bytes32[]) private _patientGrants;

    /// @dev Kill-switch epoch per patient. Bumping it invalidates every earlier grant in O(1).
    mapping(address => uint32) public patientEpoch;

    mapping(bytes32 => BionicPart) private _bionicParts;
    mapping(address => bytes32[]) private _bearerParts;
    mapping(bytes32 => FirmwareRecord[]) private _firmwareHistory;

    /// @dev On-chain ML-KEM-1024 public key directory.
    mapping(address => bytes) private _kemPublicKeys;

    // =========================================================================
    // Events
    // =========================================================================

    event AccessGranted(
        bytes32 indexed recordId,
        address indexed patient,
        address indexed specialist,
        bytes32 linkedPartId,
        RecordDomain domain,
        uint64 validUntil,
        bytes32 contentHash,
        bytes32 envelopeHash
    );

    event AccessExtended(bytes32 indexed recordId, address indexed patient, uint64 newValidUntil);

    event AccessRevoked(bytes32 indexed recordId, address indexed patient, uint64 revokedAt);

    event EmergencyKillSwitchActivated(address indexed patient, uint32 newEpoch, uint64 timestamp);

    event BionicPartRegistered(
        bytes32 indexed partId,
        address indexed bearer,
        address indexed manufacturer,
        AnatomicalZone zone,
        string modelName,
        bytes32 firmwareHash
    );

    /// @notice Carries the full ML-DSA-87 signature in cheap log storage for off-chain verification.
    event FirmwareAttestation(
        bytes32 indexed partId, uint32 indexed version, bytes32 signatureHash, bytes pqcSignature
    );

    event FirmwareUpdated(
        bytes32 indexed partId,
        uint32 indexed version,
        bytes32 firmwareHash,
        address indexed updatedBy,
        uint64 timestamp
    );

    event PartStatusChanged(
        bytes32 indexed partId, PartStatus oldStatus, PartStatus newStatus, uint64 timestamp
    );

    event KemPublicKeyRegistered(address indexed account, uint256 keyLength, uint64 timestamp);

    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier onlyPatient(bytes32 recordId) {
        address patient = _grants[recordId].patient;
        if (patient == address(0)) revert RecordNotFound();
        if (patient != msg.sender) revert Unauthorized();
        _;
    }

    modifier onlyPartBearer(bytes32 partId) {
        address bearer = _bionicParts[partId].bearer;
        if (bearer == address(0)) revert PartNotFound();
        if (bearer != msg.sender) revert Unauthorized();
        _;
    }

    // =========================================================================
    // Identifier helpers (clients can precompute these offline)
    // =========================================================================

    /// @notice recordId is namespaced by the patient, so nobody can front-run or squat it.
    function computeRecordId(address patient, bytes32 salt) public pure returns (bytes32) {
        return keccak256(abi.encode(patient, salt));
    }

    /// @notice partId is namespaced by the manufacturer that registers it.
    function computePartId(address manufacturer, string memory serialNumber)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(manufacturer, serialNumber));
    }

    // =========================================================================
    // Module 1: Ephemeral Post-Quantum Access (Clinical & Bionic Telemetry)
    // =========================================================================

    /**
     * @notice Grants a time-limited ephemeral access pass to a doctor or bio-engineer.
     * @param salt Client-chosen salt; recordId = computeRecordId(msg.sender, salt).
     * @param contentHash SHAKE-256 hash of the encrypted payload (ciphertext).
     * @param envelopeHash keccak256 of the ML-KEM-1024 envelope stored in the Key-Release Gateway.
     * @param linkedPartId Optional HBOM partId (bytes32(0) for clinical records).
     * @param specialist Wallet address of the authorized doctor or bio-engineer.
     * @param domain CLINICAL or BIONIC_TELEMETRY.
     * @param durationInSeconds Validity window in seconds.
     */
    function grantTimedAccess(
        bytes32 salt,
        bytes32 contentHash,
        bytes32 envelopeHash,
        bytes32 linkedPartId,
        address specialist,
        RecordDomain domain,
        uint256 durationInSeconds
    ) external returns (bytes32 recordId) {
        if (specialist == address(0)) revert ZeroAddress();
        if (durationInSeconds == 0 || durationInSeconds > MAX_ACCESS_DURATION) {
            revert InvalidDuration();
        }
        if (contentHash == bytes32(0) || envelopeHash == bytes32(0)) revert InvalidHash();

        recordId = computeRecordId(msg.sender, salt);
        if (_grants[recordId].patient != address(0)) revert RecordAlreadyExists();

        if (linkedPartId != bytes32(0)) {
            BionicPart storage part = _bionicParts[linkedPartId];
            if (part.bearer == address(0)) revert PartNotFound();
            if (part.bearer != msg.sender) revert Unauthorized();
        }

        // casting to 'uint64' is safe: block.timestamp fits in uint64 and duration <= 365 days
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 nowTs = uint64(block.timestamp);
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 expiry = uint64(block.timestamp + durationInSeconds);

        _grants[recordId] = AccessGrant({
            patient: msg.sender,
            createdAt: nowTs,
            domain: domain,
            revoked: false,
            specialist: specialist,
            validUntil: expiry,
            epoch: patientEpoch[msg.sender],
            contentHash: contentHash,
            envelopeHash: envelopeHash,
            linkedPartId: linkedPartId
        });

        _specialistGrants[specialist].push(recordId);
        _patientGrants[msg.sender].push(recordId);

        emit AccessGranted(
            recordId, msg.sender, specialist, linkedPartId, domain, expiry, contentHash, envelopeHash
        );
    }

    /**
     * @notice Extends an *active* pass. Expired, revoked or kill-switched passes cannot be revived.
     */
    function extendAccess(bytes32 recordId, uint256 extraSeconds) external onlyPatient(recordId) {
        if (extraSeconds == 0 || extraSeconds > MAX_ACCESS_DURATION) revert InvalidDuration();
        AccessGrant storage grant = _grants[recordId];
        if (grant.revoked || grant.epoch != patientEpoch[grant.patient]) {
            revert AccessAlreadyRevoked();
        }
        if (block.timestamp > grant.validUntil) revert AccessExpired();

        uint256 newExpiry256 = uint256(grant.validUntil) + extraSeconds;
        if (newExpiry256 > block.timestamp + MAX_ACCESS_DURATION) revert InvalidDuration();

        // casting to 'uint64' is safe because newExpiry256 <= block.timestamp + 365 days
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 newExpiry = uint64(newExpiry256);
        grant.validUntil = newExpiry;

        emit AccessExtended(recordId, msg.sender, newExpiry);
    }

    /**
     * @notice Immediately revokes a single ephemeral pass before expiration.
     */
    function revokeAccess(bytes32 recordId) external onlyPatient(recordId) {
        AccessGrant storage grant = _grants[recordId];
        if (grant.revoked || grant.epoch != patientEpoch[grant.patient]) {
            revert AccessAlreadyRevoked();
        }

        grant.revoked = true;
        // forge-lint: disable-next-line(unsafe-typecast)
        emit AccessRevoked(recordId, msg.sender, uint64(block.timestamp));
    }

    /**
     * @notice Emergency Kill-Switch: invalidates every pass issued by the caller in O(1) gas,
     *         no matter how many passes exist (bumps the patient's epoch).
     */
    function emergencyRevokeAll() external returns (uint32 newEpoch) {
        newEpoch = patientEpoch[msg.sender] + 1;
        patientEpoch[msg.sender] = newEpoch;
        // forge-lint: disable-next-line(unsafe-typecast)
        emit EmergencyKillSwitchActivated(msg.sender, newEpoch, uint64(block.timestamp));
    }

    function _isActive(AccessGrant storage grant) private view returns (bool) {
        return grant.patient != address(0) && !grant.revoked
            && grant.epoch == patientEpoch[grant.patient] && block.timestamp <= grant.validUntil;
    }

    /**
     * @notice Returns whether an ephemeral pass is currently valid (queried by the gateway).
     */
    function isAccessValid(bytes32 recordId) external view returns (bool) {
        return _isActive(_grants[recordId]);
    }

    /**
     * @notice Public policy metadata. Contains only commitments, never the envelope or CID.
     */
    function getGrantMetadata(bytes32 recordId) external view returns (GrantMetadata memory) {
        AccessGrant storage grant = _grants[recordId];
        if (grant.patient == address(0)) revert RecordNotFound();

        return GrantMetadata({
            contentHash: grant.contentHash,
            envelopeHash: grant.envelopeHash,
            linkedPartId: grant.linkedPartId,
            patient: grant.patient,
            specialist: grant.specialist,
            domain: grant.domain,
            createdAt: grant.createdAt,
            validUntil: grant.validUntil,
            revoked: grant.revoked || grant.epoch != patientEpoch[grant.patient],
            isActive: _isActive(grant)
        });
    }

    function getGrantsBySpecialist(address specialist) external view returns (bytes32[] memory) {
        return _specialistGrants[specialist];
    }

    function getGrantsByPatient(address patient) external view returns (bytes32[] memory) {
        return _patientGrants[patient];
    }

    // =========================================================================
    // Module 2: Cyber-Human HBOM & Firmware Traceability
    // =========================================================================

    /**
     * @notice Registers a bionic implant. Called by the manufacturer (OEM / implant clinic),
     *         which becomes `manufacturer`; partId is namespaced by it, preventing squatting.
     * @return partId keccak256(abi.encode(msg.sender, serialNumber)).
     */
    function registerBionicPart(
        address bearer,
        AnatomicalZone zone,
        string calldata modelName,
        string calldata serialNumber,
        bytes32 firmwareHash,
        bytes32 calibrationHash,
        bytes calldata pqcSignature
    ) external returns (bytes32 partId) {
        if (bearer == address(0)) revert ZeroAddress();
        if (firmwareHash == bytes32(0)) revert InvalidHash();
        if (pqcSignature.length == 0) revert EmptySignature();

        partId = computePartId(msg.sender, serialNumber);
        if (_bionicParts[partId].bearer != address(0)) revert PartAlreadyRegistered();

        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 nowTs = uint64(block.timestamp);
        bytes32 sigHash = keccak256(pqcSignature);

        _bionicParts[partId] = BionicPart({
            bearer: bearer,
            implantedAt: nowTs,
            firmwareVersion: 1,
            manufacturer: msg.sender,
            lastUpdatedAt: nowTs,
            zone: zone,
            status: PartStatus.ACTIVE,
            partId: partId,
            firmwareHash: firmwareHash,
            calibrationHash: calibrationHash,
            pqcSignatureHash: sigHash,
            modelName: modelName,
            serialNumber: serialNumber
        });

        _bearerParts[bearer].push(partId);
        _firmwareHistory[partId].push(
            FirmwareRecord({
                updatedBy: msg.sender,
                timestamp: nowTs,
                version: 1,
                firmwareHash: firmwareHash,
                calibrationHash: calibrationHash,
                pqcSignatureHash: sigHash
            })
        );

        emit BionicPartRegistered(partId, bearer, msg.sender, zone, modelName, firmwareHash);
        emit FirmwareAttestation(partId, 1, sigHash, pqcSignature);
    }

    /**
     * @notice Logs an ML-DSA-87 signed firmware/calibration update. Only the manufacturer can push
     *         firmware; the bearer cannot inject unsigned firmware into the history.
     */
    function logFirmwareUpdate(
        bytes32 partId,
        bytes32 newFirmwareHash,
        bytes32 newCalibrationHash,
        bytes calldata pqcSignature
    ) external {
        BionicPart storage part = _bionicParts[partId];
        if (part.bearer == address(0)) revert PartNotFound();
        if (msg.sender != part.manufacturer) revert Unauthorized();
        if (part.status == PartStatus.DECOMMISSIONED) revert PartDecommissioned();
        if (newFirmwareHash == bytes32(0)) revert InvalidHash();
        if (pqcSignature.length == 0) revert EmptySignature();

        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 nowTs = uint64(block.timestamp);
        uint32 nextVersion = part.firmwareVersion + 1;
        bytes32 sigHash = keccak256(pqcSignature);

        part.firmwareHash = newFirmwareHash;
        part.calibrationHash = newCalibrationHash;
        part.pqcSignatureHash = sigHash;
        part.lastUpdatedAt = nowTs;
        part.firmwareVersion = nextVersion;

        _firmwareHistory[partId].push(
            FirmwareRecord({
                updatedBy: msg.sender,
                timestamp: nowTs,
                version: nextVersion,
                firmwareHash: newFirmwareHash,
                calibrationHash: newCalibrationHash,
                pqcSignatureHash: sigHash
            })
        );

        emit FirmwareUpdated(partId, nextVersion, newFirmwareHash, msg.sender, nowTs);
        emit FirmwareAttestation(partId, nextVersion, sigHash, pqcSignature);
    }

    /**
     * @notice Updates lifecycle status. DECOMMISSIONED is terminal and cannot be reverted.
     */
    function updatePartStatus(bytes32 partId, PartStatus newStatus)
        external
        onlyPartBearer(partId)
    {
        BionicPart storage part = _bionicParts[partId];
        PartStatus oldStatus = part.status;
        if (oldStatus == PartStatus.DECOMMISSIONED) revert PartDecommissioned();

        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 nowTs = uint64(block.timestamp);
        part.status = newStatus;
        part.lastUpdatedAt = nowTs;

        emit PartStatusChanged(partId, oldStatus, newStatus, nowTs);
    }

    function getBionicPart(bytes32 partId) external view returns (BionicPart memory) {
        if (_bionicParts[partId].bearer == address(0)) revert PartNotFound();
        return _bionicParts[partId];
    }

    function getPartsByBearer(address bearer) external view returns (bytes32[] memory) {
        return _bearerParts[bearer];
    }

    function getFirmwareHistory(bytes32 partId) external view returns (FirmwareRecord[] memory) {
        if (_bionicParts[partId].bearer == address(0)) revert PartNotFound();
        return _firmwareHistory[partId];
    }

    // =========================================================================
    // Module 3: On-Chain ML-KEM-1024 Public Key Directory
    // =========================================================================

    /**
     * @notice Registers or rotates the caller's ML-KEM-1024 public key (1568 bytes).
     */
    function registerKemPublicKey(bytes calldata pubKey) external {
        if (pubKey.length != ML_KEM_1024_PUBLIC_KEY_BYTES) revert InvalidKemPublicKey();
        _kemPublicKeys[msg.sender] = pubKey;
        // forge-lint: disable-next-line(unsafe-typecast)
        emit KemPublicKeyRegistered(msg.sender, pubKey.length, uint64(block.timestamp));
    }

    function getKemPublicKey(address account) external view returns (bytes memory) {
        return _kemPublicKeys[account];
    }

    function hasKemPublicKey(address account) external view returns (bool) {
        return _kemPublicKeys[account].length == ML_KEM_1024_PUBLIC_KEY_BYTES;
    }
}

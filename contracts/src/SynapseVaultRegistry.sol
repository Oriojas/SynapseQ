// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SynapseVaultRegistry
 * @notice Post-Quantum Ephemeral Health Vault & Cyber-Human HBOM Registry.
 * @dev Built for the QoreChain "Build Before Q-Day" Hackathon (Diana Testnet, Chain ID 9800).
 *      Combines:
 *      1) Time-locked ephemeral access passes carrying ML-KEM-1024 (QoreSeal) key envelopes.
 *      2) Human Bill of Materials (HBOM) registry for bionic implants, neural interfaces, and
 *         ML-DSA-87 signed firmware traceability.
 *      3) Emergency Kill-Switch allowing the patient/bearer to extinguish all active passes.
 */
contract SynapseVaultRegistry {
    // =========================================================================
    // Custom Errors
    // =========================================================================

    error ZeroAddress();
    error InvalidDuration();
    error EmptyCID();
    error InvalidHash();
    error RecordAlreadyExists();
    error RecordNotFound();
    error Unauthorized();
    error AccessAlreadyRevoked();
    error AccessExpired();
    error PartAlreadyRegistered();
    error PartNotFound();
    error PartDecommissioned();

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
        string ipfsCID; // IPFS CID of AES-256-GCM encrypted payload
        bytes32 contentHash; // SHAKE-256 integrity hash (also compatible with x/rdk DA commitment)
        bytes32 linkedPartId; // bytes32(0) for pure clinical records, or HBOM partId for bionic passes
        address patient; // Data owner / cyber-human bearer
        address specialist; // Authorized doctor or bio-engineer
        bytes encryptedKeyEnvelope; // ML-KEM-1024 (QoreSeal) encapsulated symmetric key
        RecordDomain domain; // CLINICAL or BIONIC_TELEMETRY
        uint64 createdAt; // Creation timestamp
        uint64 validUntil; // Expiration timestamp
        bool revoked; // Manual or Kill-Switch revocation flag
    }

    struct GrantMetadata {
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
        bytes32 partId; // Unique Cyber-Part ID
        address bearer; // Cyber-human owner wallet
        address manufacturer; // OEM / implant clinic wallet
        AnatomicalZone zone; // Anatomical implant zone
        PartStatus status; // Lifecycle status
        string modelName; // e.g. "NeuroLink-X9 BCI"
        string serialNumber; // Factory serial number
        bytes32 firmwareHash; // Active firmware SHAKE-256 hash
        bytes32 calibrationHash; // Calibration parameters hash
        bytes pqcSignature; // ML-DSA-87 attestation signature
        uint64 implantedAt; // Registration timestamp
        uint64 lastUpdatedAt; // Last firmware/status update timestamp
        uint32 firmwareVersion; // Monotonic firmware counter
    }

    struct FirmwareRecord {
        uint32 version;
        bytes32 firmwareHash;
        bytes32 calibrationHash;
        bytes pqcSignature; // ML-DSA-87 signature of the firmware patch
        address updatedBy;
        uint64 timestamp;
    }

    // =========================================================================
    // Constants
    // =========================================================================

    /// @notice Maximum validity window for a single ephemeral access pass (prevents unbounded grants & uint64 truncation).
    uint256 public constant MAX_ACCESS_DURATION = 365 days;

    // =========================================================================
    // Storage
    // =========================================================================

    /// @dev Private so expired/revoked envelopes and CIDs cannot be read bypassing access checks.
    mapping(bytes32 => AccessGrant) private _grants;
    mapping(address => bytes32[]) private _specialistGrants;
    mapping(address => bytes32[]) private _patientGrants;

    /// @dev HBOM registry of cyber-human bionic components.
    mapping(bytes32 => BionicPart) private _bionicParts;
    mapping(address => bytes32[]) private _bearerParts;
    mapping(bytes32 => FirmwareRecord[]) private _firmwareHistory;

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
        bytes32 contentHash
    );

    event AccessExtended(bytes32 indexed recordId, address indexed patient, uint64 newValidUntil);

    event AccessRevoked(bytes32 indexed recordId, address indexed patient, uint64 revokedAt);

    event EmergencyKillSwitchActivated(
        address indexed patient, uint256 revokedCount, uint64 timestamp
    );

    event BionicPartRegistered(
        bytes32 indexed partId,
        address indexed bearer,
        address indexed manufacturer,
        AnatomicalZone zone,
        string modelName,
        bytes32 firmwareHash
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

    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier onlyPatient(bytes32 recordId) {
        if (_grants[recordId].patient == address(0)) revert RecordNotFound();
        if (_grants[recordId].patient != msg.sender) revert Unauthorized();
        _;
    }

    modifier onlyPartBearer(bytes32 partId) {
        if (_bionicParts[partId].bearer == address(0)) revert PartNotFound();
        if (_bionicParts[partId].bearer != msg.sender) revert Unauthorized();
        _;
    }

    // =========================================================================
    // Module 1: Ephemeral Post-Quantum Access (Clinical & Bionic Telemetry)
    // =========================================================================

    /**
     * @notice Grants a time-limited ephemeral access pass to a doctor or bio-engineer.
     * @param recordId Unique identifier for the record/pass (e.g., keccak256 hash).
     * @param ipfsCID IPFS CID pointing to the AES-256-GCM encrypted payload.
     * @param contentHash SHAKE-256 hash of the payload (also supports QoreChain x/rdk DA commitment).
     * @param linkedPartId Optional HBOM partId (pass bytes32(0) for standard clinical records).
     * @param specialist Wallet address of the authorized doctor or bio-engineer.
     * @param encryptedKeyEnvelope ML-KEM-1024 (QoreSeal) encapsulated symmetric key.
     * @param domain CLINICAL or BIONIC_TELEMETRY.
     * @param durationInSeconds Validity window in seconds (e.g., 7200 for 2 hours).
     */
    function grantTimedAccess(
        bytes32 recordId,
        string calldata ipfsCID,
        bytes32 contentHash,
        bytes32 linkedPartId,
        address specialist,
        bytes calldata encryptedKeyEnvelope,
        RecordDomain domain,
        uint256 durationInSeconds
    ) external {
        if (specialist == address(0)) revert ZeroAddress();
        if (durationInSeconds == 0 || durationInSeconds > MAX_ACCESS_DURATION) {
            revert InvalidDuration();
        }
        if (bytes(ipfsCID).length == 0 && contentHash == bytes32(0)) revert EmptyCID();
        if (_grants[recordId].patient != address(0)) revert RecordAlreadyExists();

        // If linked to a bionic part, ensure the part exists and belongs to msg.sender
        if (linkedPartId != bytes32(0)) {
            BionicPart storage part = _bionicParts[linkedPartId];
            if (part.bearer == address(0)) revert PartNotFound();
            if (part.bearer != msg.sender) revert Unauthorized();
        }

        uint256 expiry256 = block.timestamp + durationInSeconds;
        if (expiry256 > type(uint64).max) revert InvalidDuration();

        // casting to 'uint64' is safe because block.timestamp fits in uint64 for ~584 billion years
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 nowTs = uint64(block.timestamp);
        // casting to 'uint64' is safe because expiry256 was explicitly bounds-checked against type(uint64).max
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 expiry = uint64(expiry256);

        _grants[recordId] = AccessGrant({
            ipfsCID: ipfsCID,
            contentHash: contentHash,
            linkedPartId: linkedPartId,
            patient: msg.sender,
            specialist: specialist,
            encryptedKeyEnvelope: encryptedKeyEnvelope,
            domain: domain,
            createdAt: nowTs,
            validUntil: expiry,
            revoked: false
        });

        _specialistGrants[specialist].push(recordId);
        _patientGrants[msg.sender].push(recordId);

        emit AccessGranted(
            recordId, msg.sender, specialist, linkedPartId, domain, expiry, contentHash
        );
    }

    /**
     * @notice Extends an active, non-revoked ephemeral pass.
     */
    function extendAccess(bytes32 recordId, uint256 extraSeconds) external onlyPatient(recordId) {
        if (extraSeconds == 0 || extraSeconds > MAX_ACCESS_DURATION) revert InvalidDuration();
        AccessGrant storage grant = _grants[recordId];
        if (grant.revoked) revert AccessAlreadyRevoked();

        uint256 baseTime =
            block.timestamp > grant.validUntil ? block.timestamp : uint256(grant.validUntil);
        uint256 newExpiry256 = baseTime + extraSeconds;
        if (newExpiry256 > type(uint64).max) revert InvalidDuration();

        // casting to 'uint64' is safe because newExpiry256 was explicitly bounds-checked against type(uint64).max
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
        if (grant.revoked) revert AccessAlreadyRevoked();

        grant.revoked = true;
        emit AccessRevoked(recordId, msg.sender, uint64(block.timestamp));
    }

    /**
     * @notice Emergency Kill-Switch: revokes all active passes issued by the caller in one tx.
     */
    function emergencyRevokeAll() external returns (uint256 revokedCount) {
        bytes32[] storage ids = _patientGrants[msg.sender];
        uint64 nowTs = uint64(block.timestamp);

        for (uint256 i = 0; i < ids.length; i++) {
            AccessGrant storage grant = _grants[ids[i]];
            if (!grant.revoked && nowTs <= grant.validUntil) {
                grant.revoked = true;
                revokedCount++;
                emit AccessRevoked(ids[i], msg.sender, nowTs);
            }
        }

        emit EmergencyKillSwitchActivated(msg.sender, revokedCount, nowTs);
    }

    /**
     * @notice Called by the authorized doctor or bio-engineer to retrieve the encrypted envelope.
     * @dev Strictly enforces specialist identity, non-revocation, and block.timestamp <= validUntil.
     */
    function getRecordForSpecialist(bytes32 recordId)
        external
        view
        returns (
            string memory ipfsCID,
            bytes32 contentHash,
            bytes32 linkedPartId,
            bytes memory encryptedKeyEnvelope,
            RecordDomain domain,
            uint64 validUntil
        )
    {
        AccessGrant storage grant = _grants[recordId];
        if (grant.patient == address(0)) revert RecordNotFound();
        if (grant.specialist != msg.sender) revert Unauthorized();
        if (grant.revoked) revert AccessAlreadyRevoked();
        if (block.timestamp > grant.validUntil) revert AccessExpired();

        return (
            grant.ipfsCID,
            grant.contentHash,
            grant.linkedPartId,
            grant.encryptedKeyEnvelope,
            grant.domain,
            grant.validUntil
        );
    }

    /**
     * @notice Returns whether an ephemeral pass is currently valid.
     */
    function isAccessValid(bytes32 recordId) external view returns (bool) {
        AccessGrant storage grant = _grants[recordId];
        return
            (grant.patient != address(0) && !grant.revoked && block.timestamp <= grant.validUntil);
    }

    /**
     * @notice Public non-sensitive metadata for UI dashboards (never leaks CID or ML-KEM envelope).
     */
    function getGrantMetadata(bytes32 recordId) external view returns (GrantMetadata memory) {
        AccessGrant storage grant = _grants[recordId];
        if (grant.patient == address(0)) revert RecordNotFound();

        return GrantMetadata({
            linkedPartId: grant.linkedPartId,
            patient: grant.patient,
            specialist: grant.specialist,
            domain: grant.domain,
            createdAt: grant.createdAt,
            validUntil: grant.validUntil,
            revoked: grant.revoked,
            isActive: (!grant.revoked && block.timestamp <= grant.validUntil)
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
     * @notice Registers a bionic implant, neuro-prosthesis, or synthetic organ in the HBOM.
     * @param partId Unique Cyber-Part identifier (DID/hash).
     * @param manufacturer Wallet of the certified OEM or implant clinic.
     * @param zone Anatomical zone of the implant.
     * @param modelName Human-readable model designation.
     * @param serialNumber Factory serial number.
     * @param firmwareHash SHAKE-256 hash of the initial firmware image.
     * @param calibrationHash Hash of the surgical/biomechanical calibration profile.
     * @param pqcSignature ML-DSA-87 post-quantum attestation signature.
     */
    function registerBionicPart(
        bytes32 partId,
        address manufacturer,
        AnatomicalZone zone,
        string calldata modelName,
        string calldata serialNumber,
        bytes32 firmwareHash,
        bytes32 calibrationHash,
        bytes calldata pqcSignature
    ) external {
        if (manufacturer == address(0)) revert ZeroAddress();
        if (firmwareHash == bytes32(0)) revert InvalidHash();
        if (_bionicParts[partId].bearer != address(0)) revert PartAlreadyRegistered();

        uint64 nowTs = uint64(block.timestamp);

        _bionicParts[partId] = BionicPart({
            partId: partId,
            bearer: msg.sender,
            manufacturer: manufacturer,
            zone: zone,
            status: PartStatus.ACTIVE,
            modelName: modelName,
            serialNumber: serialNumber,
            firmwareHash: firmwareHash,
            calibrationHash: calibrationHash,
            pqcSignature: pqcSignature,
            implantedAt: nowTs,
            lastUpdatedAt: nowTs,
            firmwareVersion: 1
        });

        _bearerParts[msg.sender].push(partId);

        _firmwareHistory[partId].push(
            FirmwareRecord({
                version: 1,
                firmwareHash: firmwareHash,
                calibrationHash: calibrationHash,
                pqcSignature: pqcSignature,
                updatedBy: msg.sender,
                timestamp: nowTs
            })
        );

        emit BionicPartRegistered(partId, msg.sender, manufacturer, zone, modelName, firmwareHash);
    }

    /**
     * @notice Logs an ML-DSA-87 signed firmware or calibration update for an active bionic part.
     * @dev Callable only by the cyber-human bearer or the registered OEM manufacturer.
     */
    function logFirmwareUpdate(
        bytes32 partId,
        bytes32 newFirmwareHash,
        bytes32 newCalibrationHash,
        bytes calldata pqcSignature
    ) external {
        BionicPart storage part = _bionicParts[partId];
        if (part.bearer == address(0)) revert PartNotFound();
        if (msg.sender != part.bearer && msg.sender != part.manufacturer) revert Unauthorized();
        if (part.status == PartStatus.DECOMMISSIONED) revert PartDecommissioned();
        if (newFirmwareHash == bytes32(0)) revert InvalidHash();

        uint64 nowTs = uint64(block.timestamp);
        uint32 nextVersion = part.firmwareVersion + 1;

        part.firmwareHash = newFirmwareHash;
        part.calibrationHash = newCalibrationHash;
        part.pqcSignature = pqcSignature;
        part.lastUpdatedAt = nowTs;
        part.firmwareVersion = nextVersion;

        _firmwareHistory[partId].push(
            FirmwareRecord({
                version: nextVersion,
                firmwareHash: newFirmwareHash,
                calibrationHash: newCalibrationHash,
                pqcSignature: pqcSignature,
                updatedBy: msg.sender,
                timestamp: nowTs
            })
        );

        emit FirmwareUpdated(partId, nextVersion, newFirmwareHash, msg.sender, nowTs);
    }

    /**
     * @notice Updates the lifecycle status of a registered bionic part (ACTIVE, MAINTENANCE, DECOMMISSIONED).
     */
    function updatePartStatus(bytes32 partId, PartStatus newStatus)
        external
        onlyPartBearer(partId)
    {
        BionicPart storage part = _bionicParts[partId];
        PartStatus oldStatus = part.status;
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
}

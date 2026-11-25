// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SynapseVaultRegistry} from "../src/SynapseVaultRegistry.sol";

contract SynapseVaultRegistryTest is Test {
    SynapseVaultRegistry public vault;

    address public patient = makeAddr("patient");
    address public doctor = makeAddr("doctor");
    address public bioEngineer = makeAddr("bioEngineer");
    address public manufacturer = makeAddr("manufacturer");
    address public attacker = makeAddr("attacker");

    bytes32 public constant SALT_MRI = keccak256("MRI-CRANIAL-2026-001");
    bytes32 public constant SALT_TELEMETRY = keccak256("BCI-TELEMETRY-2026-001");
    bytes32 public constant CONTENT_HASH = keccak256("shake256-ciphertext-digest");
    bytes32 public constant ENVELOPE_HASH = keccak256("mlkem1024-envelope");
    bytes32 public constant FW_V1 = keccak256("firmware-v1.0.0-mldsa87");
    bytes32 public constant FW_V2 = keccak256("firmware-v2.0.0-mldsa87");
    bytes32 public constant CALIBRATION_HASH = keccak256("calibration-profile-v1");
    string public constant SERIAL = "SN-0042";

    bytes public constant MLDSA_SIG = hex"deadbeefcafebabe1122334455667788";

    function setUp() public {
        vault = new SynapseVaultRegistry();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _grant(bytes32 salt, bytes32 partId, address specialist, uint256 duration)
        internal
        returns (bytes32)
    {
        vm.prank(patient);
        return vault.grantTimedAccess(
            salt,
            CONTENT_HASH,
            ENVELOPE_HASH,
            partId,
            specialist,
            partId == bytes32(0)
                ? SynapseVaultRegistry.RecordDomain.CLINICAL
                : SynapseVaultRegistry.RecordDomain.BIONIC_TELEMETRY,
            duration
        );
    }

    function _registerPart(address bearer) internal returns (bytes32) {
        vm.prank(manufacturer);
        return vault.registerBionicPart(
            bearer,
            SynapseVaultRegistry.AnatomicalZone.NEURAL,
            "NeuroLink-X9 BCI",
            SERIAL,
            FW_V1,
            CALIBRATION_HASH,
            MLDSA_SIG
        );
    }

    // =========================================================================
    // Module 1: Ephemeral Access
    // =========================================================================

    function test_GrantStoresOnlyCommitments() public {
        bytes32 recordId = _grant(SALT_MRI, bytes32(0), doctor, 2 hours);
        assertEq(recordId, vault.computeRecordId(patient, SALT_MRI));
        assertTrue(vault.isAccessValid(recordId));

        SynapseVaultRegistry.GrantMetadata memory meta = vault.getGrantMetadata(recordId);
        assertEq(meta.patient, patient);
        assertEq(meta.specialist, doctor);
        assertEq(meta.contentHash, CONTENT_HASH);
        assertEq(meta.envelopeHash, ENVELOPE_HASH);
        assertEq(meta.validUntil, uint64(block.timestamp + 2 hours));
        assertTrue(meta.isActive);
    }

    function test_RejectsEmptyCommitments() public {
        vm.startPrank(patient);
        vm.expectRevert(SynapseVaultRegistry.InvalidHash.selector);
        vault.grantTimedAccess(
            SALT_MRI,
            bytes32(0),
            ENVELOPE_HASH,
            bytes32(0),
            doctor,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            1 hours
        );
        vm.expectRevert(SynapseVaultRegistry.InvalidHash.selector);
        vault.grantTimedAccess(
            SALT_MRI,
            CONTENT_HASH,
            bytes32(0),
            bytes32(0),
            doctor,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            1 hours
        );
        vm.stopPrank();
    }

    /// Regression (A3): a third party using the same salt gets a different recordId,
    /// so it can no longer squat/front-run the patient's grant.
    function test_RecordIdIsNamespacedByPatient() public {
        vm.prank(attacker);
        bytes32 attackerId = vault.grantTimedAccess(
            SALT_MRI,
            CONTENT_HASH,
            ENVELOPE_HASH,
            bytes32(0),
            attacker,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            1 hours
        );
        bytes32 patientId = _grant(SALT_MRI, bytes32(0), doctor, 1 hours);
        assertTrue(attackerId != patientId);
        assertEq(vault.getGrantMetadata(patientId).patient, patient);
    }

    function test_SameSaltTwiceReverts() public {
        _grant(SALT_MRI, bytes32(0), doctor, 1 hours);
        vm.prank(patient);
        vm.expectRevert(SynapseVaultRegistry.RecordAlreadyExists.selector);
        vault.grantTimedAccess(
            SALT_MRI,
            CONTENT_HASH,
            ENVELOPE_HASH,
            bytes32(0),
            doctor,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            1 hours
        );
    }

    function test_AccessExpiresExactlyAfterDuration() public {
        bytes32 recordId = _grant(SALT_MRI, bytes32(0), doctor, 1 hours);
        vm.warp(block.timestamp + 1 hours);
        assertTrue(vault.isAccessValid(recordId));
        vm.warp(block.timestamp + 1);
        assertFalse(vault.isAccessValid(recordId));
        assertFalse(vault.getGrantMetadata(recordId).isActive);
    }

    function test_ManualRevocationBlocksAccessImmediately() public {
        bytes32 recordId = _grant(SALT_MRI, bytes32(0), doctor, 24 hours);

        vm.prank(attacker);
        vm.expectRevert(SynapseVaultRegistry.Unauthorized.selector);
        vault.revokeAccess(recordId);

        vm.prank(patient);
        vault.revokeAccess(recordId);
        assertFalse(vault.isAccessValid(recordId));

        vm.prank(patient);
        vm.expectRevert(SynapseVaultRegistry.AccessAlreadyRevoked.selector);
        vault.revokeAccess(recordId);
    }

    function test_RevokeUnknownRecordReverts() public {
        vm.prank(patient);
        vm.expectRevert(SynapseVaultRegistry.RecordNotFound.selector);
        vault.revokeAccess(keccak256("missing"));
    }

    function test_ExtendAccessExtendsExpiry() public {
        bytes32 recordId = _grant(SALT_MRI, bytes32(0), doctor, 1 hours);
        uint64 originalExpiry = vault.getGrantMetadata(recordId).validUntil;

        vm.prank(patient);
        vault.extendAccess(recordId, 30 minutes);
        assertEq(vault.getGrantMetadata(recordId).validUntil, originalExpiry + 30 minutes);
    }

    function test_CannotReviveExpiredPass() public {
        bytes32 recordId = _grant(SALT_MRI, bytes32(0), doctor, 1 hours);
        vm.warp(block.timestamp + 2 hours);
        vm.prank(patient);
        vm.expectRevert(SynapseVaultRegistry.AccessExpired.selector);
        vault.extendAccess(recordId, 1 hours);
    }

    function test_EmergencyKillSwitchRevokesAllActivePasses() public {
        bytes32 partId = _registerPart(patient);
        bytes32 mri = _grant(SALT_MRI, bytes32(0), doctor, 24 hours);
        bytes32 tele = _grant(SALT_TELEMETRY, partId, bioEngineer, 2 hours);

        vm.prank(patient);
        uint32 epoch = vault.emergencyRevokeAll();

        assertEq(epoch, 1);
        assertFalse(vault.isAccessValid(mri));
        assertFalse(vault.isAccessValid(tele));
        assertTrue(vault.getGrantMetadata(mri).revoked);

        // Kill-switched passes cannot be extended back to life
        vm.prank(patient);
        vm.expectRevert(SynapseVaultRegistry.AccessAlreadyRevoked.selector);
        vault.extendAccess(mri, 1 hours);

        // New grants after the kill-switch work normally
        bytes32 fresh = _grant(keccak256("after-kill"), bytes32(0), doctor, 1 hours);
        assertTrue(vault.isAccessValid(fresh));
    }

    /// Regression: the kill-switch is O(1) and cannot run out of gas with many passes.
    function test_KillSwitchGasIsConstant() public {
        for (uint256 i = 0; i < 200; i++) {
            _grant(bytes32(i + 1), bytes32(0), doctor, 1 hours);
        }
        vm.prank(patient);
        uint256 gasBefore = gasleft();
        vault.emergencyRevokeAll();
        assertLt(gasBefore - gasleft(), 50_000);
    }

    // =========================================================================
    // Module 2: HBOM
    // =========================================================================

    function test_RegisterBionicPartAndUpdateFirmware() public {
        bytes32 partId = _registerPart(patient);
        assertEq(partId, vault.computePartId(manufacturer, SERIAL));

        SynapseVaultRegistry.BionicPart memory part = vault.getBionicPart(partId);
        assertEq(part.bearer, patient);
        assertEq(part.manufacturer, manufacturer);
        assertEq(part.firmwareVersion, 1);
        assertEq(part.pqcSignatureHash, keccak256(MLDSA_SIG));

        vm.prank(manufacturer);
        vault.logFirmwareUpdate(partId, FW_V2, CALIBRATION_HASH, MLDSA_SIG);

        SynapseVaultRegistry.FirmwareRecord[] memory history = vault.getFirmwareHistory(partId);
        assertEq(history.length, 2);
        assertEq(history[1].updatedBy, manufacturer);
        assertEq(history[1].firmwareHash, FW_V2);
    }

    /// Regression (A2): an attacker registering the "same serial" lands in its own namespace.
    function test_PartIdCannotBeSquatted() public {
        vm.prank(attacker);
        bytes32 fake = vault.registerBionicPart(
            attacker,
            SynapseVaultRegistry.AnatomicalZone.NEURAL,
            "Fake",
            SERIAL,
            FW_V1,
            CALIBRATION_HASH,
            MLDSA_SIG
        );
        bytes32 real = _registerPart(patient);
        assertTrue(fake != real);
        assertEq(vault.getBionicPart(real).manufacturer, manufacturer);
    }

    function test_RejectsEmptySignature() public {
        vm.prank(manufacturer);
        vm.expectRevert(SynapseVaultRegistry.EmptySignature.selector);
        vault.registerBionicPart(
            patient,
            SynapseVaultRegistry.AnatomicalZone.NEURAL,
            "X",
            SERIAL,
            FW_V1,
            CALIBRATION_HASH,
            ""
        );
    }

    /// Regression (A2): the bearer can no longer push firmware without the manufacturer.
    function test_OnlyManufacturerCanUpdateFirmware() public {
        bytes32 partId = _registerPart(patient);

        vm.prank(attacker);
        vm.expectRevert(SynapseVaultRegistry.Unauthorized.selector);
        vault.logFirmwareUpdate(partId, FW_V2, CALIBRATION_HASH, MLDSA_SIG);

        vm.prank(patient);
        vm.expectRevert(SynapseVaultRegistry.Unauthorized.selector);
        vault.logFirmwareUpdate(partId, FW_V2, CALIBRATION_HASH, MLDSA_SIG);
    }

    function test_DecommissionedPartBlocksFirmwareUpdates() public {
        bytes32 partId = _registerPart(patient);
        vm.prank(patient);
        vault.updatePartStatus(partId, SynapseVaultRegistry.PartStatus.DECOMMISSIONED);

        vm.prank(manufacturer);
        vm.expectRevert(SynapseVaultRegistry.PartDecommissioned.selector);
        vault.logFirmwareUpdate(partId, FW_V2, CALIBRATION_HASH, MLDSA_SIG);
    }

    /// Regression (A2): DECOMMISSIONED is terminal.
    function test_DecommissionedIsTerminal() public {
        bytes32 partId = _registerPart(patient);
        vm.startPrank(patient);
        vault.updatePartStatus(partId, SynapseVaultRegistry.PartStatus.DECOMMISSIONED);
        vm.expectRevert(SynapseVaultRegistry.PartDecommissioned.selector);
        vault.updatePartStatus(partId, SynapseVaultRegistry.PartStatus.ACTIVE);
        vm.stopPrank();
    }

    function test_CannotLinkPassToAnotherBearersPart() public {
        bytes32 partId = _registerPart(patient);
        vm.prank(attacker);
        vm.expectRevert(SynapseVaultRegistry.Unauthorized.selector);
        vault.grantTimedAccess(
            SALT_TELEMETRY,
            CONTENT_HASH,
            ENVELOPE_HASH,
            partId,
            bioEngineer,
            SynapseVaultRegistry.RecordDomain.BIONIC_TELEMETRY,
            1 hours
        );
    }

    function test_RejectsDurationExceedingMax() public {
        uint256 tooLong = vault.MAX_ACCESS_DURATION() + 1;
        vm.prank(patient);
        vm.expectRevert(SynapseVaultRegistry.InvalidDuration.selector);
        vault.grantTimedAccess(
            SALT_MRI,
            CONTENT_HASH,
            ENVELOPE_HASH,
            bytes32(0),
            doctor,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            tooLong
        );
    }

    // =========================================================================
    // Gas with realistic post-quantum sizes (A4)
    // =========================================================================

    /// A real ML-DSA-87 signature is 4627 bytes. Registration must stay far below the
    /// ~6.9M gas the v1 contract used when it stored the signature twice.
    function test_RealisticMlDsaSignatureGas() public {
        bytes memory realSig = new bytes(4627);
        vm.prank(manufacturer);
        uint256 gasBefore = gasleft();
        vault.registerBionicPart(
            patient,
            SynapseVaultRegistry.AnatomicalZone.NEURAL,
            "NeuroLink-X9 BCI",
            SERIAL,
            FW_V1,
            CALIBRATION_HASH,
            realSig
        );
        assertLt(gasBefore - gasleft(), 700_000);
    }

    function test_GrantGasIsSmall() public {
        vm.prank(patient);
        uint256 gasBefore = gasleft();
        vault.grantTimedAccess(
            SALT_MRI,
            CONTENT_HASH,
            ENVELOPE_HASH,
            bytes32(0),
            doctor,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            1 hours
        );
        assertLt(gasBefore - gasleft(), 250_000);
    }

    // =========================================================================
    // Module 3: ML-KEM-1024 directory
    // =========================================================================

    function test_RegisterAndGetKemPublicKey() public {
        assertFalse(vault.hasKemPublicKey(doctor));
        bytes memory dummyPubKey = new bytes(1568);
        dummyPubKey[0] = 0x42;
        dummyPubKey[1567] = 0x99;

        vm.prank(doctor);
        vault.registerKemPublicKey(dummyPubKey);

        assertTrue(vault.hasKemPublicKey(doctor));
        bytes memory storedKey = vault.getKemPublicKey(doctor);
        assertEq(storedKey.length, 1568);
        assertEq(storedKey[0], bytes1(0x42));
        assertEq(storedKey[1567], bytes1(0x99));
    }

    function test_RejectsInvalidKemPublicKeyLength() public {
        vm.startPrank(doctor);
        vm.expectRevert(SynapseVaultRegistry.InvalidKemPublicKey.selector);
        vault.registerKemPublicKey(new bytes(0));
        vm.expectRevert(SynapseVaultRegistry.InvalidKemPublicKey.selector);
        vault.registerKemPublicKey(new bytes(32));
        vm.stopPrank();
    }

    // =========================================================================
    // Fuzz
    // =========================================================================

    function testFuzz_TimedAccessExpiry(uint32 duration, uint32 elapsed) public {
        uint256 boundedDuration = bound(duration, 1, vault.MAX_ACCESS_DURATION());
        bytes32 salt = keccak256(abi.encodePacked("FUZZ", boundedDuration, elapsed));
        bytes32 recordId = _grant(salt, bytes32(0), doctor, boundedDuration);

        vm.warp(block.timestamp + elapsed);
        if (elapsed <= boundedDuration) {
            assertTrue(vault.isAccessValid(recordId));
        } else {
            assertFalse(vault.isAccessValid(recordId));
        }
    }
}

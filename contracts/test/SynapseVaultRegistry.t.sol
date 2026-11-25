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

    bytes32 public constant RECORD_MRI = keccak256("MRI-CRANIAL-2026-001");
    bytes32 public constant RECORD_TELEMETRY = keccak256("BCI-TELEMETRY-2026-001");
    bytes32 public constant PART_BCI = keccak256("NEUROLINK-X9-SN-0042");
    bytes32 public constant CONTENT_HASH = keccak256("shake256-encrypted-payload-digest");
    bytes32 public constant FW_V1 = keccak256("firmware-v1.0.0-mldsa87");
    bytes32 public constant FW_V2 = keccak256("firmware-v2.0.0-mldsa87");
    bytes32 public constant CALIBRATION_HASH = keccak256("calibration-profile-v1");

    string public constant SAMPLE_CID =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    bytes public constant MLKEM_ENVELOPE = hex"a1b2c3d4e5f60102030405060708090a";
    bytes public constant MLDSA_SIG = hex"deadbeefcafebabe1122334455667788";

    function setUp() public {
        vault = new SynapseVaultRegistry();
    }

    // =========================================================================
    // Module 1: Clinical & Ephemeral Access Tests
    // =========================================================================

    function test_GrantAndRetrieveClinicalAccess() public {
        vm.prank(patient);
        vault.grantTimedAccess(
            RECORD_MRI,
            SAMPLE_CID,
            CONTENT_HASH,
            bytes32(0),
            doctor,
            MLKEM_ENVELOPE,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            2 hours
        );

        assertTrue(vault.isAccessValid(RECORD_MRI));

        vm.prank(doctor);
        (
            string memory cid,
            bytes32 hash,
            bytes32 linkedPart,
            bytes memory envelope,
            SynapseVaultRegistry.RecordDomain domain,
            uint64 validUntil
        ) = vault.getRecordForSpecialist(RECORD_MRI);

        assertEq(cid, SAMPLE_CID);
        assertEq(hash, CONTENT_HASH);
        assertEq(linkedPart, bytes32(0));
        assertEq(envelope, MLKEM_ENVELOPE);
        assertEq(uint8(domain), uint8(SynapseVaultRegistry.RecordDomain.CLINICAL));
        assertEq(validUntil, uint64(block.timestamp + 2 hours));
    }

    function test_AccessExpiresExactlyAfterDuration() public {
        vm.prank(patient);
        vault.grantTimedAccess(
            RECORD_MRI,
            SAMPLE_CID,
            CONTENT_HASH,
            bytes32(0),
            doctor,
            MLKEM_ENVELOPE,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            1 hours
        );

        // Still valid at the exact boundary second
        vm.warp(block.timestamp + 1 hours);
        assertTrue(vault.isAccessValid(RECORD_MRI));

        // 1 second after expiry -> rejected on-chain
        vm.warp(block.timestamp + 1);
        assertFalse(vault.isAccessValid(RECORD_MRI));

        vm.prank(doctor);
        vm.expectRevert(SynapseVaultRegistry.AccessExpired.selector);
        vault.getRecordForSpecialist(RECORD_MRI);
    }

    function test_UnauthorizedSpecialistCannotReadRecord() public {
        vm.prank(patient);
        vault.grantTimedAccess(
            RECORD_MRI,
            SAMPLE_CID,
            CONTENT_HASH,
            bytes32(0),
            doctor,
            MLKEM_ENVELOPE,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            1 days
        );

        vm.prank(attacker);
        vm.expectRevert(SynapseVaultRegistry.Unauthorized.selector);
        vault.getRecordForSpecialist(RECORD_MRI);
    }

    function test_ManualRevocationBlocksAccessImmediately() public {
        vm.prank(patient);
        vault.grantTimedAccess(
            RECORD_MRI,
            SAMPLE_CID,
            CONTENT_HASH,
            bytes32(0),
            doctor,
            MLKEM_ENVELOPE,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            24 hours
        );

        // Attacker cannot revoke
        vm.prank(attacker);
        vm.expectRevert(SynapseVaultRegistry.Unauthorized.selector);
        vault.revokeAccess(RECORD_MRI);

        // Patient revokes
        vm.prank(patient);
        vault.revokeAccess(RECORD_MRI);

        assertFalse(vault.isAccessValid(RECORD_MRI));

        vm.prank(doctor);
        vm.expectRevert(SynapseVaultRegistry.AccessAlreadyRevoked.selector);
        vault.getRecordForSpecialist(RECORD_MRI);
    }

    function test_ExtendAccessExtendsExpiry() public {
        vm.prank(patient);
        vault.grantTimedAccess(
            RECORD_MRI,
            SAMPLE_CID,
            CONTENT_HASH,
            bytes32(0),
            doctor,
            MLKEM_ENVELOPE,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            1 hours
        );

        uint64 originalExpiry = vault.getGrantMetadata(RECORD_MRI).validUntil;

        vm.prank(patient);
        vault.extendAccess(RECORD_MRI, 30 minutes);

        uint64 updatedExpiry = vault.getGrantMetadata(RECORD_MRI).validUntil;
        assertEq(updatedExpiry, originalExpiry + 30 minutes);
    }

    function test_EmergencyKillSwitchRevokesAllActivePasses() public {
        vm.startPrank(patient);
        vault.registerBionicPart(
            PART_BCI,
            manufacturer,
            SynapseVaultRegistry.AnatomicalZone.NEURAL,
            "NeuroLink-X9 BCI",
            "SN-0042",
            FW_V1,
            CALIBRATION_HASH,
            MLDSA_SIG
        );

        vault.grantTimedAccess(
            RECORD_MRI,
            SAMPLE_CID,
            CONTENT_HASH,
            bytes32(0),
            doctor,
            MLKEM_ENVELOPE,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            24 hours
        );

        vault.grantTimedAccess(
            RECORD_TELEMETRY,
            SAMPLE_CID,
            CONTENT_HASH,
            PART_BCI,
            bioEngineer,
            MLKEM_ENVELOPE,
            SynapseVaultRegistry.RecordDomain.BIONIC_TELEMETRY,
            2 hours
        );

        uint256 revokedCount = vault.emergencyRevokeAll();
        vm.stopPrank();

        assertEq(revokedCount, 2);
        assertFalse(vault.isAccessValid(RECORD_MRI));
        assertFalse(vault.isAccessValid(RECORD_TELEMETRY));
    }

    // =========================================================================
    // Module 2: Cyber-Human HBOM & Firmware Traceability Tests
    // =========================================================================

    function test_RegisterBionicPartAndUpdateFirmware() public {
        vm.prank(patient);
        vault.registerBionicPart(
            PART_BCI,
            manufacturer,
            SynapseVaultRegistry.AnatomicalZone.NEURAL,
            "NeuroLink-X9 BCI",
            "SN-0042",
            FW_V1,
            CALIBRATION_HASH,
            MLDSA_SIG
        );

        SynapseVaultRegistry.BionicPart memory part = vault.getBionicPart(PART_BCI);
        assertEq(part.bearer, patient);
        assertEq(part.manufacturer, manufacturer);
        assertEq(part.firmwareVersion, 1);
        assertEq(part.firmwareHash, FW_V1);

        // Manufacturer pushes ML-DSA-87 signed firmware patch v2
        vm.prank(manufacturer);
        vault.logFirmwareUpdate(PART_BCI, FW_V2, CALIBRATION_HASH, MLDSA_SIG);

        SynapseVaultRegistry.BionicPart memory updated = vault.getBionicPart(PART_BCI);
        assertEq(updated.firmwareVersion, 2);
        assertEq(updated.firmwareHash, FW_V2);

        SynapseVaultRegistry.FirmwareRecord[] memory history = vault.getFirmwareHistory(PART_BCI);
        assertEq(history.length, 2);
        assertEq(history[1].updatedBy, manufacturer);
        assertEq(history[1].firmwareHash, FW_V2);
    }

    function test_UnauthorizedCannotUpdateFirmware() public {
        vm.prank(patient);
        vault.registerBionicPart(
            PART_BCI,
            manufacturer,
            SynapseVaultRegistry.AnatomicalZone.NEURAL,
            "NeuroLink-X9 BCI",
            "SN-0042",
            FW_V1,
            CALIBRATION_HASH,
            MLDSA_SIG
        );

        vm.prank(attacker);
        vm.expectRevert(SynapseVaultRegistry.Unauthorized.selector);
        vault.logFirmwareUpdate(PART_BCI, FW_V2, CALIBRATION_HASH, MLDSA_SIG);
    }

    function test_DecommissionedPartBlocksFirmwareUpdates() public {
        vm.startPrank(patient);
        vault.registerBionicPart(
            PART_BCI,
            manufacturer,
            SynapseVaultRegistry.AnatomicalZone.LOCOMOTOR,
            "Titan-7 Bionic Arm",
            "ARM-9901",
            FW_V1,
            CALIBRATION_HASH,
            MLDSA_SIG
        );
        vault.updatePartStatus(PART_BCI, SynapseVaultRegistry.PartStatus.DECOMMISSIONED);
        vm.stopPrank();

        vm.prank(manufacturer);
        vm.expectRevert(SynapseVaultRegistry.PartDecommissioned.selector);
        vault.logFirmwareUpdate(PART_BCI, FW_V2, CALIBRATION_HASH, MLDSA_SIG);
    }

    function test_CannotLinkPassToAnotherBearersPart() public {
        vm.prank(patient);
        vault.registerBionicPart(
            PART_BCI,
            manufacturer,
            SynapseVaultRegistry.AnatomicalZone.NEURAL,
            "NeuroLink-X9 BCI",
            "SN-0042",
            FW_V1,
            CALIBRATION_HASH,
            MLDSA_SIG
        );

        vm.prank(attacker);
        vm.expectRevert(SynapseVaultRegistry.Unauthorized.selector);
        vault.grantTimedAccess(
            RECORD_TELEMETRY,
            SAMPLE_CID,
            CONTENT_HASH,
            PART_BCI,
            bioEngineer,
            MLKEM_ENVELOPE,
            SynapseVaultRegistry.RecordDomain.BIONIC_TELEMETRY,
            1 hours
        );
    }

    function test_RejectsDurationExceedingMax() public {
        uint256 tooLong = vault.MAX_ACCESS_DURATION() + 1;
        vm.prank(patient);
        vm.expectRevert(SynapseVaultRegistry.InvalidDuration.selector);
        vault.grantTimedAccess(
            RECORD_MRI,
            SAMPLE_CID,
            CONTENT_HASH,
            bytes32(0),
            doctor,
            MLKEM_ENVELOPE,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            tooLong
        );
    }

    // =========================================================================
    // Fuzz Tests
    // =========================================================================

    function testFuzz_TimedAccessExpiry(uint32 duration, uint32 elapsed) public {
        uint256 boundedDuration = bound(duration, 1, vault.MAX_ACCESS_DURATION());
        bytes32 recordId = keccak256(abi.encodePacked("FUZZ", boundedDuration, elapsed));

        vm.prank(patient);
        vault.grantTimedAccess(
            recordId,
            SAMPLE_CID,
            CONTENT_HASH,
            bytes32(0),
            doctor,
            MLKEM_ENVELOPE,
            SynapseVaultRegistry.RecordDomain.CLINICAL,
            boundedDuration
        );

        vm.warp(block.timestamp + elapsed);

        if (elapsed <= boundedDuration) {
            assertTrue(vault.isAccessValid(recordId));
        } else {
            assertFalse(vault.isAccessValid(recordId));
        }
    }
}

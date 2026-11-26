// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SynapseVaultRegistry} from "../src/SynapseVaultRegistry.sol";
import {MockQorePqc} from "../src/dev/MockQorePqc.sol";

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

    // QoreChain PQC precompiles, emulated with MockQorePqc (runtime code etched at both addresses)
    MockQorePqc internal constant PQC_VERIFY = MockQorePqc(address(0x0a01));
    MockQorePqc internal constant PQC_KEY_STATUS = MockQorePqc(address(0x0a02));

    function setUp() public {
        vault = new SynapseVaultRegistry(true);
        MockQorePqc impl = new MockQorePqc();
        vm.etch(address(0x0a01), address(impl).code);
        vm.etch(address(0x0a02), address(impl).code);
        _registerPqKey(manufacturer, true);
        _registerPqKey(attacker, true);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _grant(bytes32 salt, bytes32 partId, address specialist, uint256 duration)
        internal
        returns (bytes32)
    {
        SynapseVaultRegistry.RecordDomain domain = partId == bytes32(0)
            ? SynapseVaultRegistry.RecordDomain.CLINICAL
            : SynapseVaultRegistry.RecordDomain.BIONIC_TELEMETRY;
        vm.prank(patient);
        return vault.grantTimedAccess(
            salt, CONTENT_HASH, ENVELOPE_HASH, partId, specialist, domain, duration
        );
    }

    /// @dev Deterministic 2592-byte "ML-DSA-87 public key" unique per account.
    function _pubkey(address account) internal pure returns (bytes memory key) {
        key = new bytes(2592);
        bytes20 a = bytes20(account);
        for (uint256 i = 0; i < 20; i++) {
            key[i] = a[i];
        }
    }

    /// @dev 4627-byte "ML-DSA-87 signature" with a tag so different signatures differ.
    function _sig(uint8 tag) internal pure returns (bytes memory sig) {
        sig = new bytes(4627);
        sig[0] = bytes1(tag);
        sig[4626] = bytes1(tag);
    }

    function _registerPqKey(address account, bool possessionProven) internal {
        PQC_KEY_STATUS.setKeyStatus(account, _pubkey(account), possessionProven);
    }

    /// @dev Emulates "the manufacturer signed this exact attestation message" (off-chain ML-DSA).
    function _attest(
        address signer,
        bytes32 partId,
        uint32 version,
        bytes32 fw,
        bytes32 cal,
        uint8 tag
    ) internal returns (bytes memory sig) {
        sig = _sig(tag);
        PQC_VERIFY.approveSignature(
            _pubkey(signer), sig, vault.firmwareAttestationMessage(partId, version, fw, cal)
        );
    }

    function _register(address oem, string memory serial, bytes memory sig)
        internal
        returns (bytes32)
    {
        vm.prank(oem);
        return vault.registerBionicPart(
            patient,
            SynapseVaultRegistry.AnatomicalZone.NEURAL,
            "NeuroLink-X9 BCI",
            serial,
            FW_V1,
            CALIBRATION_HASH,
            sig
        );
    }

    function _registerPart(address bearer) internal returns (bytes32) {
        bytes32 partId = vault.computePartId(manufacturer, SERIAL);
        bytes memory sig = _attest(manufacturer, partId, 1, FW_V1, CALIBRATION_HASH, 1);
        vm.prank(manufacturer);
        return vault.registerBionicPart(
            bearer,
            SynapseVaultRegistry.AnatomicalZone.NEURAL,
            "NeuroLink-X9 BCI",
            SERIAL,
            FW_V1,
            CALIBRATION_HASH,
            sig
        );
    }

    /// @dev External on purpose: decoding the full BionicPart struct in its own call frame
    ///      avoids a via_ir "stack too deep" in the test contract.
    function partSummary(bytes32 partId)
        external
        view
        returns (address bearer, address manuf, uint32 fwVersion, bytes32 sigHash)
    {
        // Read the ABI-encoded struct head directly (word 0 = tuple offset, then fields in order)
        (bool ok, bytes memory data) =
            address(vault).staticcall(abi.encodeCall(vault.getBionicPart, (partId)));
        require(ok, "getBionicPart reverted");
        assembly {
            let head := add(add(data, 0x20), mload(add(data, 0x20)))
            bearer := mload(head)
            fwVersion := mload(add(head, 0x40))
            manuf := mload(add(head, 0x60))
            sigHash := mload(add(head, 0x120))
        }
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

        (address bearer, address manuf, uint32 fwVersion, bytes32 sigHash) =
            this.partSummary(partId);
        assertEq(bearer, patient);
        assertEq(manuf, manufacturer);
        assertEq(fwVersion, 1);
        assertEq(sigHash, keccak256(_sig(1)));

        bytes memory sigV2 = _attest(manufacturer, partId, 2, FW_V2, CALIBRATION_HASH, 2);
        vm.prank(manufacturer);
        vault.logFirmwareUpdate(partId, FW_V2, CALIBRATION_HASH, sigV2);

        SynapseVaultRegistry.FirmwareRecord[] memory history = vault.getFirmwareHistory(partId);
        assertEq(history.length, 2);
        assertEq(history[1].updatedBy, manufacturer);
        assertEq(history[1].firmwareHash, FW_V2);
    }

    /// Regression (A2): an attacker registering the "same serial" lands in its own namespace.
    function test_PartIdCannotBeSquatted() public {
        bytes32 fakeId = vault.computePartId(attacker, SERIAL);
        bytes memory atkSig = _attest(attacker, fakeId, 1, FW_V1, CALIBRATION_HASH, 9);
        bytes32 fake = _register(attacker, SERIAL, atkSig);
        bytes32 real = _registerPart(patient);
        assertTrue(fake != real);
        (, address realManufacturer,,) = this.partSummary(real);
        assertEq(realManufacturer, manufacturer);
    }

    function test_RejectsEmptySignature() public {
        vm.expectRevert(SynapseVaultRegistry.EmptySignature.selector);
        _register(manufacturer, SERIAL, "");
    }

    // ------------------------------------------------------------------------
    // On-chain ML-DSA-87 verification (pqcKeyStatus + pqcVerify precompiles)
    // ------------------------------------------------------------------------

    function test_PqcRejectsUnapprovedSignature() public {
        vm.expectRevert(SynapseVaultRegistry.PqcSignatureInvalid.selector);
        _register(manufacturer, SERIAL, _sig(7));
    }

    /// A signature over firmware A cannot register firmware B (message binding).
    function test_PqcSignatureBoundToFirmwareHash() public {
        bytes32 partId = vault.computePartId(manufacturer, SERIAL);
        bytes memory sigForV2Hash = _attest(manufacturer, partId, 1, FW_V2, CALIBRATION_HASH, 3);
        vm.expectRevert(SynapseVaultRegistry.PqcSignatureInvalid.selector);
        _register(manufacturer, SERIAL, sigForV2Hash); // registers FW_V1
    }

    /// The v1 signature cannot be replayed to push v2 (version is part of the message).
    function test_PqcFirmwareSignatureNotReplayable() public {
        bytes32 partId = _registerPart(patient);
        vm.prank(manufacturer);
        vm.expectRevert(SynapseVaultRegistry.PqcSignatureInvalid.selector);
        vault.logFirmwareUpdate(partId, FW_V1, CALIBRATION_HASH, _sig(1));
    }

    /// Another account's approved signature does not work for msg.sender (key comes from chain).
    function test_PqcKeyComesFromSenderRegistration() public {
        bytes32 partId = vault.computePartId(manufacturer, SERIAL);
        // signed by attacker's key, but submitted by manufacturer
        bytes memory sig = _sig(4);
        PQC_VERIFY.approveSignature(
            _pubkey(attacker),
            sig,
            vault.firmwareAttestationMessage(partId, 1, FW_V1, CALIBRATION_HASH)
        );
        vm.expectRevert(SynapseVaultRegistry.PqcSignatureInvalid.selector);
        _register(manufacturer, SERIAL, sig);
    }

    function test_PqcRejectsUnregisteredManufacturer() public {
        address stranger = makeAddr("stranger");
        vm.expectRevert(
            abi.encodeWithSelector(SynapseVaultRegistry.PqcKeyNotRegistered.selector, stranger)
        );
        _register(stranger, SERIAL, _sig(1));
    }

    function test_PqcRequiresPossessionProof() public {
        _registerPqKey(manufacturer, false);
        vm.expectRevert(
            abi.encodeWithSelector(
                SynapseVaultRegistry.PqcPossessionNotProven.selector, manufacturer
            )
        );
        _register(manufacturer, SERIAL, _sig(1));
    }

    function test_PqcPossessionOptionalWhenDisabled() public {
        vault = new SynapseVaultRegistry(false);
        _registerPqKey(manufacturer, false);
        bytes32 partId = _registerPart(patient);
        assertEq(partId, vault.computePartId(manufacturer, SERIAL));
    }

    function test_PqcRejectsNonMlDsaKey() public {
        PQC_KEY_STATUS.setRawKeyStatus(manufacturer, true, 2, _pubkey(manufacturer), true);
        vm.expectRevert(
            abi.encodeWithSelector(SynapseVaultRegistry.PqcUnsupportedAlgorithm.selector, 2)
        );
        _register(manufacturer, SERIAL, _sig(1));
    }

    function test_PqcRejectsWrongSignatureLength() public {
        vm.expectRevert(
            abi.encodeWithSelector(SynapseVaultRegistry.InvalidSignatureLength.selector, 16)
        );
        _register(manufacturer, SERIAL, hex"deadbeefcafebabe1122334455667788");
    }

    /// Off Diana (local chain without the precompile, or mainnet where it is inactive) the call
    /// returns empty data: the contract must FAIL CLOSED, never accept the signature.
    function test_PqcFailsClosedWhenPrecompileMissing() public {
        vm.etch(address(0x0a01), "");
        vm.expectRevert(SynapseVaultRegistry.PqcUnavailable.selector);
        _register(manufacturer, SERIAL, _sig(1));
    }

    function test_PqcFailsClosedWhenKeyStatusMissing() public {
        vm.etch(address(0x0a02), "");
        vm.expectRevert(SynapseVaultRegistry.PqcUnavailable.selector);
        _register(manufacturer, SERIAL, _sig(1));
    }

    function test_AttestationMessageIsBoundToChainAndContract() public {
        bytes memory m1 =
            vault.firmwareAttestationMessage(bytes32(uint256(1)), 1, FW_V1, CALIBRATION_HASH);
        SynapseVaultRegistry other = new SynapseVaultRegistry(true);
        bytes memory m2 =
            other.firmwareAttestationMessage(bytes32(uint256(1)), 1, FW_V1, CALIBRATION_HASH);
        assertTrue(keccak256(m1) != keccak256(m2));
        vm.chainId(1);
        bytes memory m3 =
            vault.firmwareAttestationMessage(bytes32(uint256(1)), 1, FW_V1, CALIBRATION_HASH);
        assertTrue(keccak256(m1) != keccak256(m3));
    }

    /// Regression (A2): the bearer can no longer push firmware without the manufacturer.
    function test_OnlyManufacturerCanUpdateFirmware() public {
        bytes32 partId = _registerPart(patient);

        vm.prank(attacker);
        vm.expectRevert(SynapseVaultRegistry.Unauthorized.selector);
        vault.logFirmwareUpdate(partId, FW_V2, CALIBRATION_HASH, _sig(2));

        vm.prank(patient);
        vm.expectRevert(SynapseVaultRegistry.Unauthorized.selector);
        vault.logFirmwareUpdate(partId, FW_V2, CALIBRATION_HASH, _sig(2));
    }

    function test_DecommissionedPartBlocksFirmwareUpdates() public {
        bytes32 partId = _registerPart(patient);
        vm.prank(patient);
        vault.updatePartStatus(partId, SynapseVaultRegistry.PartStatus.DECOMMISSIONED);

        vm.prank(manufacturer);
        vm.expectRevert(SynapseVaultRegistry.PartDecommissioned.selector);
        vault.logFirmwareUpdate(partId, FW_V2, CALIBRATION_HASH, _sig(2));
    }

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

    /// A real ML-DSA-87 signature is 4627 bytes. Registration (incl. the on-chain verification
    /// calls) must stay far below the ~6.9M gas the v1 contract used. Note: the mock does not
    /// charge the real precompile gas (~85-90k for pqcVerify on Diana).
    function test_RealisticMlDsaSignatureGas() public {
        bytes32 partId = vault.computePartId(manufacturer, SERIAL);
        bytes memory sig = _attest(manufacturer, partId, 1, FW_V1, CALIBRATION_HASH, 5);
        uint256 gasBefore = gasleft();
        _register(manufacturer, SERIAL, sig);
        assertLt(gasBefore - gasleft(), 900_000);
    }

    function test_GrantGasIsSmall() public {
        uint256 gasBefore = gasleft();
        _grant(SALT_MRI, bytes32(0), doctor, 1 hours);
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

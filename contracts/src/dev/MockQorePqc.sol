// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockQorePqc — DEV/TEST ONLY. NEVER deploy to a public network.
 * @notice Emulates QoreChain's PQC precompiles for Foundry tests and local Anvil, where the real
 *         precompiles (pqcVerify 0x…0a01, pqcKeyStatus 0x…0a02) do not exist. Its runtime code is
 *         placed at BOTH precompile addresses (vm.etch / anvil_setCode); each copy has its own storage.
 *
 *         It does NOT implement ML-DSA-87 in Solidity. It is a signature *oracle*: `pqcVerify`
 *         returns true only for exact (pubkey, signature, message) triples that an off-chain verifier
 *         (noble ML-DSA-87 in the dev scripts) already checked and approved. This keeps the contract's
 *         message-binding semantics testable: changing any byte of the message makes it fail.
 */
contract MockQorePqc {
    struct KeyStatus {
        bool registered;
        uint8 algorithmId;
        bytes pubkey;
        bool possessionProven;
    }

    mapping(address => KeyStatus) private _keys;
    mapping(bytes32 => bool) private _approved;

    // --- dev setters ---------------------------------------------------------

    function setKeyStatus(address account, bytes calldata pubkey, bool possessionProven) external {
        _keys[account] = KeyStatus(true, 1, pubkey, possessionProven);
    }

    function setRawKeyStatus(
        address account,
        bool registered,
        uint8 algorithmId,
        bytes calldata pubkey,
        bool proven
    ) external {
        _keys[account] = KeyStatus(registered, algorithmId, pubkey, proven);
    }

    function approveSignature(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes calldata message
    ) external {
        _approved[keccak256(abi.encode(pubkey, signature, message))] = true;
    }

    // --- precompile ABI --------------------------------------------------------

    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message)
        external
        view
        returns (bool valid)
    {
        return _approved[keccak256(abi.encode(pubkey, signature, message))];
    }

    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven)
    {
        KeyStatus storage k = _keys[account];
        return (k.registered, k.algorithmId, k.pubkey, k.possessionProven);
    }
}

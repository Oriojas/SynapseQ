// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SynapseVaultRegistry} from "../src/SynapseVaultRegistry.sol";

contract DeploySynapseVault is Script {
    function run() external returns (SynapseVaultRegistry deployed) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        // Require proof of possession of the manufacturer's ML-DSA-87 key (recommended by QoreChain).
        // Set REQUIRE_PQC_POSSESSION=false only if your registered keys have no PoP.
        bool requirePossession = vm.envOr("REQUIRE_PQC_POSSESSION", true);

        vm.startBroadcast(deployerPrivateKey);
        deployed = new SynapseVaultRegistry(requirePossession);
        vm.stopBroadcast();

        console2.log("==========================================");
        console2.log("SynapseVaultRegistry deployed at:", address(deployed));
        console2.log("Chain ID:", block.chainid);
        console2.log("requirePossessionProof:", requirePossession);
        console2.log("==========================================");
    }
}

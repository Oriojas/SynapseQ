// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SynapseVaultRegistry} from "../src/SynapseVaultRegistry.sol";

contract DeploySynapseVault is Script {
    function run() external returns (SynapseVaultRegistry deployed) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        deployed = new SynapseVaultRegistry();
        vm.stopBroadcast();

        console2.log("==========================================");
        console2.log("SynapseVaultRegistry deployed at:", address(deployed));
        console2.log("Chain ID:", block.chainid);
        console2.log("==========================================");
    }
}

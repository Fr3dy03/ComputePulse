// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ProviderIncidentRegistry} from "../src/ProviderIncidentRegistry.sol";

/// @notice Deploys ProviderIncidentRegistry and optionally grants the operational roles.
/// @dev Required env: PRIVATE_KEY. Optional: PROVIDER_OPERATOR_ADDRESS, INCIDENT_ATTESTOR_ADDRESS.
///      The deployer receives DEFAULT_ADMIN_ROLE in the constructor. Use a multisig in production.
contract DeployProviderIncidentRegistry is Script {
  function run() external returns (ProviderIncidentRegistry registry) {
    uint256 deployerKey = vm.envUint("PRIVATE_KEY");
    address operator = vm.envOr("PROVIDER_OPERATOR_ADDRESS", address(0));
    address attestor = vm.envOr("INCIDENT_ATTESTOR_ADDRESS", address(0));

    vm.startBroadcast(deployerKey);
    registry = new ProviderIncidentRegistry();
    if (operator != address(0)) {
      registry.grantRole(registry.PROVIDER_OPERATOR_ROLE(), operator);
    }
    if (attestor != address(0)) {
      registry.grantRole(registry.INCIDENT_ATTESTOR_ROLE(), attestor);
    }
    vm.stopBroadcast();

    console2.log("ProviderIncidentRegistry:", address(registry));
    console2.log("Admin (deployer):", msg.sender);
    console2.log("Provider operator role granted to:", operator);
    console2.log("Incident attestor role granted to:", attestor);
  }
}

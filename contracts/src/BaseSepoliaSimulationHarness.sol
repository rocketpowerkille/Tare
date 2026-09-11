// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BaseSepoliaControlAsset, BaseSepoliaControlVault} from "./BaseSepoliaHarness.sol";
import {BoundedVaultExit} from "./BoundedVaultExit.sol";

/// @notice Simulation-only receiver for Chainlink's MockKeystoneForwarder.
/// @dev The current mock omits workflow metadata, so this preserves only forwarder authentication.
///      Deploy a separate BoundedVaultExit with full identity checks for hosted CRE execution.
contract BaseSepoliaSimulationExit is BoundedVaultExit {
    bool public constant SIMULATION_ONLY = true;

    constructor(address mockForwarder, address positionOwner)
        BoundedVaultExit(mockForwarder, keccak256("simulation-only"), bytes10("simulation"), positionOwner)
    {}

    function _authorizeReport(bytes calldata) internal view override {
        if (msg.sender != forwarder) revert Unauthorized();
    }
}

/// @notice Creates a fresh fixed-supply position for an official CRE simulator write.
contract BaseSepoliaSimulationHarness {
    address public constant MOCK_KEYSTONE_FORWARDER = 0x82300bd7c3958625581cc2F77bC6464dcEcDF3e5;
    uint256 public constant UNITS = 100 ether;

    address public immutable owner;
    BaseSepoliaControlAsset public immutable terminalAsset;
    BaseSepoliaControlVault public immutable innerVault;
    BaseSepoliaControlVault public immutable outerVault;
    BaseSepoliaSimulationExit public immutable receiver;

    error Unauthorized();

    constructor(address positionOwner) {
        if (block.chainid != 84532 || positionOwner == address(0)) revert Unauthorized();
        owner = positionOwner;
        terminalAsset = new BaseSepoliaControlAsset();
        innerVault = new BaseSepoliaControlVault(address(terminalAsset));
        outerVault = new BaseSepoliaControlVault(address(innerVault));
        receiver = new BaseSepoliaSimulationExit(MOCK_KEYSTONE_FORWARDER, positionOwner);
        terminalAsset.seed(address(innerVault), UNITS);
        innerVault.seed(address(outerVault), UNITS);
        outerVault.seed(positionOwner, UNITS);
    }
}

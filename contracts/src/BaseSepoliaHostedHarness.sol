// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BaseSepoliaControlAsset, BaseSepoliaControlVault} from "./BaseSepoliaHarness.sol";
import {BoundedVaultExit} from "./BoundedVaultExit.sol";

/// @notice Creates a fresh fixed-supply position for a hosted CRE write acceptance test.
/// @dev Assets are test controls, but the receiver is pinned to the production KeystoneForwarder.
contract BaseSepoliaHostedHarness {
    address public constant KEYSTONE_FORWARDER = 0xF8344CFd5c43616a4366C34E3EEE75af79a74482;
    address public constant WORKFLOW_OWNER = 0xF7A77F49bf7f9805baa01BEe187Ca1feD6d64767;
    bytes10 public constant WORKFLOW_NAME = 0x63306563326530663834;
    uint256 public constant UNITS = 100 ether;

    address public immutable owner;
    BaseSepoliaControlAsset public immutable terminalAsset;
    BaseSepoliaControlVault public immutable innerVault;
    BaseSepoliaControlVault public immutable outerVault;
    BoundedVaultExit public immutable receiver;

    error Unauthorized();

    constructor(address positionOwner) {
        if (block.chainid != 84532 || positionOwner == address(0)) revert Unauthorized();
        owner = positionOwner;
        terminalAsset = new BaseSepoliaControlAsset();
        innerVault = new BaseSepoliaControlVault(address(terminalAsset));
        outerVault = new BaseSepoliaControlVault(address(innerVault));
        receiver = new BoundedVaultExit(
            KEYSTONE_FORWARDER,
            bytes32(0),
            WORKFLOW_NAME,
            WORKFLOW_OWNER
        );
        terminalAsset.seed(address(innerVault), UNITS);
        innerVault.seed(address(outerVault), UNITS);
        outerVault.seed(positionOwner, UNITS);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BoundedVaultExit} from "./BoundedVaultExit.sol";

interface IControlToken {
    function balanceOf(address owner) external view returns (uint256);
    function transfer(address receiver, uint256 amount) external returns (bool);
}

/// @dev Fixed-supply test asset. This contract is only for the Base Sepolia E2E harness.
contract BaseSepoliaControlAsset {
    address private immutable seeder;
    bool public finalized;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    error Unauthorized();
    error InvalidTransfer();

    constructor() {
        if (block.chainid != 84532) revert Unauthorized();
        seeder = msg.sender;
    }

    function seed(address receiver, uint256 amount) external {
        if (msg.sender != seeder || finalized || receiver == address(0) || amount == 0) revert Unauthorized();
        finalized = true;
        totalSupply = amount;
        balanceOf[receiver] = amount;
    }

    function transfer(address receiver, uint256 amount) external returns (bool) {
        if (receiver == address(0) || balanceOf[msg.sender] < amount) revert InvalidTransfer();
        balanceOf[msg.sender] -= amount;
        balanceOf[receiver] += amount;
        return true;
    }
}

/// @dev One-to-one ERC-4626-shaped test vault. Deposits and further minting are intentionally absent.
contract BaseSepoliaControlVault {
    address public immutable asset;
    address private immutable seeder;
    bool public finalized;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    error Unauthorized();
    error InvalidTransfer();

    constructor(address underlying) {
        if (block.chainid != 84532 || underlying.code.length == 0) revert Unauthorized();
        asset = underlying;
        seeder = msg.sender;
    }

    function seed(address receiver, uint256 shares) external {
        if (msg.sender != seeder || finalized || receiver == address(0) || shares == 0) revert Unauthorized();
        finalized = true;
        totalSupply = shares;
        balanceOf[receiver] = shares;
    }

    function totalAssets() external view returns (uint256) {
        return IControlToken(asset).balanceOf(address(this));
    }

    function previewRedeem(uint256 shares) external pure returns (uint256) {
        return shares;
    }

    function approve(address spender, uint256 shares) external returns (bool) {
        allowance[msg.sender][spender] = shares;
        return true;
    }

    function transfer(address receiver, uint256 shares) external returns (bool) {
        _transfer(msg.sender, receiver, shares);
        return true;
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256) {
        if (msg.sender != owner) {
            uint256 approved = allowance[owner][msg.sender];
            if (approved < shares) revert Unauthorized();
            allowance[owner][msg.sender] = approved - shares;
        }
        _transfer(owner, address(0), shares);
        totalSupply -= shares;
        if (!IControlToken(asset).transfer(receiver, shares)) revert InvalidTransfer();
        return shares;
    }

    function _transfer(address from, address receiver, uint256 shares) private {
        if (balanceOf[from] < shares) revert InvalidTransfer();
        balanceOf[from] -= shares;
        if (receiver != address(0)) balanceOf[receiver] += shares;
    }
}

/// @dev Owner-only stand-in for report delivery. It never verifies Chainlink signatures.
contract BaseSepoliaOwnerTestForwarder {
    address public immutable owner;
    bytes32 public immutable workflowId;
    bytes10 public immutable workflowName;

    error Unauthorized();

    constructor(address reportOwner, bytes32 expectedWorkflowId, bytes10 expectedWorkflowName) {
        owner = reportOwner;
        workflowId = expectedWorkflowId;
        workflowName = expectedWorkflowName;
    }

    function deliver(address receiver, bytes calldata payload) external {
        if (msg.sender != owner) revert Unauthorized();
        bytes memory metadata = abi.encodePacked(workflowId, workflowName, owner, bytes2(0x0001));
        BoundedVaultExit(receiver).onReport(metadata, payload);
    }
}

/// @notice Deploys the complete, fixed-supply Base Sepolia E2E control in one transaction.
/// @dev This harness is not the production CRE receiver deployment.
contract BaseSepoliaHarness {
    uint256 public constant UNITS = 100 ether;
    bytes32 public constant WORKFLOW_ID = keccak256("tare-base-sepolia-e2e-v1");
    bytes10 public constant WORKFLOW_NAME = bytes10("tare-exit");

    address public immutable owner;
    BaseSepoliaControlAsset public immutable terminalAsset;
    BaseSepoliaControlVault public immutable innerVault;
    BaseSepoliaControlVault public immutable outerVault;
    BaseSepoliaOwnerTestForwarder public immutable testForwarder;
    BoundedVaultExit public immutable receiver;

    error Unauthorized();

    constructor(address positionOwner) {
        if (block.chainid != 84532 || positionOwner == address(0)) revert Unauthorized();
        owner = positionOwner;
        terminalAsset = new BaseSepoliaControlAsset();
        innerVault = new BaseSepoliaControlVault(address(terminalAsset));
        outerVault = new BaseSepoliaControlVault(address(innerVault));
        terminalAsset.seed(address(innerVault), UNITS);
        innerVault.seed(address(outerVault), UNITS);
        outerVault.seed(positionOwner, UNITS);
        testForwarder = new BaseSepoliaOwnerTestForwarder(positionOwner, WORKFLOW_ID, WORKFLOW_NAME);
        receiver = new BoundedVaultExit(address(testForwarder), WORKFLOW_ID, WORKFLOW_NAME, positionOwner);
    }
}

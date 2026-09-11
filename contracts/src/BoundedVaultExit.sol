// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IVaultExit {
    function asset() external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256);
}

interface IAssetBalance {
    function balanceOf(address owner) external view returns (uint256);
}

/// @notice Base-Sepolia-only, one-use ERC-4626 exit authorization. Never holds user funds.
contract BoundedVaultExit {
    uint256 public constant EXECUTION_CHAIN_ID = 84532;
    struct Permit {
        address vault;
        address asset;
        uint256 shares;
        uint256 minAssets;
        uint256 validUntil;
        uint256 nonce;
    }

    struct Report {
        uint256 chainId;
        address receiver;
        address owner;
        address vault;
        uint256 shares;
        uint256 minAssets;
        uint256 nonce;
        uint256 validUntil;
        uint256 observedBlock;
        bytes32 observedHash;
        bytes32 evidenceDigest;
    }

    address public immutable forwarder;
    bytes32 public immutable workflowId;
    bytes10 public immutable workflowName;
    address public immutable workflowOwner;
    mapping(address => Permit) public permits;
    bool private entered;

    error Unauthorized();
    error InvalidPermit();
    error InvalidReport();
    error StaleEvidence();
    error UnexpectedVaultResult();
    error Reentrant();

    event Armed(address indexed owner, address indexed vault, uint256 nonce, uint256 shares);
    event Cancelled(address indexed owner, uint256 nonce);
    event Exited(address indexed owner, address indexed vault, uint256 shares, uint256 assets, bytes32 evidenceDigest);

    constructor(
        address trustedForwarder,
        bytes32 expectedWorkflowId,
        bytes10 expectedWorkflowName,
        address expectedWorkflowOwner
    ) {
        if (
            block.chainid != EXECUTION_CHAIN_ID || trustedForwarder == address(0) || expectedWorkflowId == bytes32(0)
                || expectedWorkflowName == bytes10(0) || expectedWorkflowOwner == address(0)
        ) revert Unauthorized();
        forwarder = trustedForwarder;
        workflowId = expectedWorkflowId;
        workflowName = expectedWorkflowName;
        workflowOwner = expectedWorkflowOwner;
    }

    modifier nonReentrant() {
        if (entered) revert Reentrant();
        entered = true;
        _;
        entered = false;
    }

    /// @dev Owner must separately approve this contract to spend exactly these vault shares.
    function arm(address vault, uint256 shares, uint256 minAssets, uint256 validUntil) external nonReentrant {
        if (
            vault.code.length == 0 || shares == 0 || minAssets == 0 || validUntil <= block.timestamp
                || validUntil > block.timestamp + 1 days
        ) revert InvalidPermit();
        address asset = IVaultExit(vault).asset();
        if (asset.code.length == 0 || IVaultExit(vault).balanceOf(msg.sender) < shares) revert InvalidPermit();
        uint256 nonce = permits[msg.sender].nonce + 1;
        permits[msg.sender] = Permit(vault, asset, shares, minAssets, validUntil, nonce);
        emit Armed(msg.sender, vault, nonce, shares);
    }

    function cancel() external nonReentrant {
        Permit storage permit = permits[msg.sender];
        permit.shares = 0;
        permit.nonce++;
        emit Cancelled(msg.sender, permit.nonce);
    }

    /// @dev Forwarder authenticates report signatures; this receiver also pins the workflow identity.
    function onReport(bytes calldata metadata, bytes calldata payload) external nonReentrant {
        if (msg.sender != forwarder || metadata.length != 64) revert Unauthorized();
        if (
            bytes32(metadata[0:32]) != workflowId || bytes10(metadata[32:42]) != workflowName
                || address(bytes20(metadata[42:62])) != workflowOwner
        ) revert Unauthorized();
        if (payload.length != 11 * 32) revert InvalidReport();
        Report memory report = abi.decode(payload, (Report));
        Permit storage permit = permits[report.owner];
        if (
            block.chainid != EXECUTION_CHAIN_ID || report.chainId != block.chainid || report.receiver != address(this)
                || report.vault != permit.vault || report.shares == 0 || report.shares != permit.shares
                || report.minAssets < permit.minAssets || report.nonce != permit.nonce
                || report.evidenceDigest == bytes32(0)
        ) revert InvalidReport();
        if (
            block.timestamp > permit.validUntil || block.timestamp > report.validUntil
                || report.validUntil > permit.validUntil || report.validUntil > block.timestamp + 10 minutes
                || report.observedBlock >= block.number || block.number - report.observedBlock > 64
                || report.observedHash == bytes32(0) || blockhash(report.observedBlock) != report.observedHash
        ) revert StaleEvidence();

        IVaultExit vault = IVaultExit(report.vault);
        if (vault.asset() != permit.asset) revert UnexpectedVaultResult();
        uint256 sharesBefore = vault.balanceOf(report.owner);
        uint256 assetsBefore = IAssetBalance(permit.asset).balanceOf(report.owner);
        permit.shares = 0;
        permit.nonce++;
        uint256 assets = vault.redeem(report.shares, report.owner, report.owner);
        uint256 sharesAfter = vault.balanceOf(report.owner);
        uint256 assetsAfter = IAssetBalance(permit.asset).balanceOf(report.owner);
        if (
            sharesBefore < sharesAfter || sharesBefore - sharesAfter != report.shares || assets < report.minAssets
                || assetsAfter < assetsBefore || assetsAfter - assetsBefore < report.minAssets
        ) revert UnexpectedVaultResult();
        emit Exited(report.owner, report.vault, report.shares, assetsAfter - assetsBefore, report.evidenceDigest);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == this.onReport.selector;
    }
}

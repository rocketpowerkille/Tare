// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BaseSepoliaHostedHarness} from "../src/BaseSepoliaHostedHarness.sol";
import {BaseSepoliaControlVault} from "../src/BaseSepoliaHarness.sol";
import {BoundedVaultExit} from "../src/BoundedVaultExit.sol";

interface HostedVm {
    function chainId(uint256) external;
    function warp(uint256) external;
    function roll(uint256) external;
    function setBlockhash(uint256, bytes32) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract BaseSepoliaHostedHarnessTest {
    HostedVm private constant vm = HostedVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OWNER = address(0x1234);
    bytes32 private constant BLOCK_HASH = keccak256("hosted-block");
    BaseSepoliaHostedHarness private harness;

    function setUp() public {
        vm.chainId(84532);
        vm.warp(1000);
        vm.roll(100);
        vm.setBlockhash(99, BLOCK_HASH);
        harness = new BaseSepoliaHostedHarness(OWNER);
    }

    function report() private view returns (BoundedVaultExit.Report memory) {
        return BoundedVaultExit.Report({
            chainId: 84532,
            receiver: address(harness.receiver()),
            owner: OWNER,
            vault: address(harness.outerVault()),
            shares: 100 ether,
            minAssets: 95 ether,
            nonce: 1,
            validUntil: 1400,
            observedBlock: 99,
            observedHash: BLOCK_HASH,
            evidenceDigest: keccak256("verified-hosted-evidence")
        });
    }

    function arm() private {
        BaseSepoliaControlVault outer = harness.outerVault();
        BoundedVaultExit receiver = harness.receiver();
        vm.prank(OWNER);
        outer.approve(address(receiver), 100 ether);
        vm.prank(OWNER);
        receiver.arm(address(outer), 100 ether, 95 ether, 1500);
    }

    function testCreatesFreshPositionPinnedToHostedIdentity() public view {
        require(harness.owner() == OWNER);
        require(harness.outerVault().balanceOf(OWNER) == 100 ether);
        require(harness.innerVault().balanceOf(address(harness.outerVault())) == 100 ether);
        require(harness.terminalAsset().balanceOf(address(harness.innerVault())) == 100 ether);
        require(harness.receiver().forwarder() == harness.KEYSTONE_FORWARDER());
        require(harness.receiver().workflowId() == bytes32(0));
        require(harness.receiver().workflowName() == harness.WORKFLOW_NAME());
        require(harness.receiver().workflowOwner() == harness.WORKFLOW_OWNER());
    }

    function testProductionMetadataCanExecuteOneBoundedExit() public {
        arm();
        address forwarder = harness.KEYSTONE_FORWARDER();
        BoundedVaultExit receiver = harness.receiver();
        bytes memory payload = abi.encode(report());
        bytes memory metadata = abi.encodePacked(
            keccak256("final-config-includes-receiver"),
            harness.WORKFLOW_NAME(),
            harness.WORKFLOW_OWNER(),
            bytes2(0x0001)
        );
        vm.prank(forwarder);
        receiver.onReport(metadata, payload);
        require(harness.outerVault().balanceOf(OWNER) == 0);
        require(harness.innerVault().balanceOf(OWNER) == 100 ether);
        require(harness.outerVault().balanceOf(address(harness.receiver())) == 0);
        require(harness.innerVault().balanceOf(address(harness.receiver())) == 0);
    }

    function testHarnessCannotDeployOnAnotherChain() public {
        vm.chainId(11155111);
        vm.expectRevert(BaseSepoliaHostedHarness.Unauthorized.selector);
        new BaseSepoliaHostedHarness(OWNER);
    }
}

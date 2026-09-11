// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {
    BaseSepoliaControlVault,
    BaseSepoliaHarness,
    BaseSepoliaOwnerTestForwarder
} from "../src/BaseSepoliaHarness.sol";
import {BoundedVaultExit} from "../src/BoundedVaultExit.sol";

interface HarnessVm {
    function chainId(uint256) external;
    function warp(uint256) external;
    function roll(uint256) external;
    function setBlockhash(uint256, bytes32) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract BaseSepoliaHarnessTest {
    HarnessVm private constant vm = HarnessVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OWNER = address(0x1234);
    address private constant STRANGER = address(0x9999);
    bytes32 private constant BLOCK_HASH = keccak256("base-canonical-block");
    BaseSepoliaHarness private harness;

    function setUp() public {
        vm.chainId(84532);
        vm.warp(1000);
        vm.roll(100);
        vm.setBlockhash(99, BLOCK_HASH);
        harness = new BaseSepoliaHarness(OWNER);
    }

    function report(uint256 shares, uint256 nonce) private view returns (BoundedVaultExit.Report memory) {
        return BoundedVaultExit.Report({
            chainId: 84532,
            receiver: address(harness.receiver()),
            owner: OWNER,
            vault: address(harness.outerVault()),
            shares: shares,
            minAssets: 95 ether,
            nonce: nonce,
            validUntil: 1400,
            observedBlock: 99,
            observedHash: BLOCK_HASH,
            evidenceDigest: keccak256("verified-base-evidence")
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

    function testHarnessCreatesTheFixedTwoLayerPosition() public view {
        require(harness.owner() == OWNER);
        require(harness.outerVault().asset() == address(harness.innerVault()));
        require(harness.innerVault().asset() == address(harness.terminalAsset()));
        require(harness.outerVault().balanceOf(OWNER) == 100 ether);
        require(harness.innerVault().balanceOf(address(harness.outerVault())) == 100 ether);
        require(harness.terminalAsset().balanceOf(address(harness.innerVault())) == 100 ether);
        require(harness.outerVault().totalAssets() == 100 ether);
        require(harness.innerVault().totalAssets() == 100 ether);
    }

    function testOwnerDeliversOneBoundedExitAndReceiverNeverHoldsAssets() public {
        arm();
        BaseSepoliaOwnerTestForwarder forwarder = harness.testForwarder();
        BoundedVaultExit receiver = harness.receiver();
        bytes memory payload = abi.encode(report(100 ether, 1));
        vm.prank(OWNER);
        forwarder.deliver(address(receiver), payload);
        require(harness.outerVault().balanceOf(OWNER) == 0);
        require(harness.innerVault().balanceOf(OWNER) == 100 ether);
        require(harness.innerVault().balanceOf(address(harness.receiver())) == 0);
        require(harness.outerVault().balanceOf(address(harness.receiver())) == 0);
    }

    function testHarnessForwarderRejectsOtherCallersAndBadOrReplayedReports() public {
        arm();
        BaseSepoliaOwnerTestForwarder forwarder = harness.testForwarder();
        BoundedVaultExit receiver = harness.receiver();
        bytes memory validPayload = abi.encode(report(100 ether, 1));
        bytes memory wrongSharesPayload = abi.encode(report(99 ether, 1));

        vm.expectRevert(BaseSepoliaOwnerTestForwarder.Unauthorized.selector);
        vm.prank(STRANGER);
        forwarder.deliver(address(receiver), validPayload);

        vm.expectRevert(BoundedVaultExit.InvalidReport.selector);
        vm.prank(OWNER);
        forwarder.deliver(address(receiver), wrongSharesPayload);

        vm.prank(OWNER);
        forwarder.deliver(address(receiver), validPayload);
        vm.expectRevert(BoundedVaultExit.InvalidReport.selector);
        vm.prank(OWNER);
        forwarder.deliver(address(receiver), validPayload);
    }

    function testHarnessCannotDeployOnAnotherChain() public {
        vm.chainId(11155111);
        vm.expectRevert(BaseSepoliaHarness.Unauthorized.selector);
        new BaseSepoliaHarness(OWNER);
    }
}

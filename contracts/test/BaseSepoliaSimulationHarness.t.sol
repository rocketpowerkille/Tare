// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BaseSepoliaSimulationHarness, BaseSepoliaSimulationExit} from "../src/BaseSepoliaSimulationHarness.sol";
import {BaseSepoliaControlVault} from "../src/BaseSepoliaHarness.sol";
import {BoundedVaultExit} from "../src/BoundedVaultExit.sol";

interface SimulationVm {
    function chainId(uint256) external;
    function warp(uint256) external;
    function roll(uint256) external;
    function setBlockhash(uint256, bytes32) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract BaseSepoliaSimulationHarnessTest {
    SimulationVm private constant vm = SimulationVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OWNER = address(0x1234);
    address private constant STRANGER = address(0x9999);
    bytes32 private constant BLOCK_HASH = keccak256("simulation-block");
    BaseSepoliaSimulationHarness private harness;

    function setUp() public {
        vm.chainId(84532);
        vm.warp(1000);
        vm.roll(100);
        vm.setBlockhash(99, BLOCK_HASH);
        harness = new BaseSepoliaSimulationHarness(OWNER);
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
            evidenceDigest: keccak256("verified-simulation-evidence")
        });
    }

    function arm() private {
        BaseSepoliaControlVault outer = harness.outerVault();
        BaseSepoliaSimulationExit receiver = harness.receiver();
        vm.prank(OWNER);
        outer.approve(address(receiver), 100 ether);
        vm.prank(OWNER);
        receiver.arm(address(outer), 100 ether, 95 ether, 1500);
    }

    function testCreatesFreshPositionPinnedToOfficialSimulationForwarder() public view {
        require(harness.owner() == OWNER);
        require(harness.receiver().SIMULATION_ONLY());
        require(harness.receiver().forwarder() == harness.MOCK_KEYSTONE_FORWARDER());
        require(harness.outerVault().balanceOf(OWNER) == 100 ether);
        require(harness.innerVault().balanceOf(address(harness.outerVault())) == 100 ether);
        require(harness.terminalAsset().balanceOf(address(harness.innerVault())) == 100 ether);
    }

    function testMockForwarderCanDeliverWithoutMetadataAndOtherCallersCannot() public {
        arm();
        BaseSepoliaSimulationExit receiver = harness.receiver();
        address mockForwarder = harness.MOCK_KEYSTONE_FORWARDER();
        bytes memory payload = abi.encode(report());
        vm.expectRevert(BoundedVaultExit.Unauthorized.selector);
        vm.prank(STRANGER);
        receiver.onReport("", payload);

        vm.prank(mockForwarder);
        receiver.onReport("", payload);
        require(harness.outerVault().balanceOf(OWNER) == 0);
        require(harness.innerVault().balanceOf(OWNER) == 100 ether);
        require(harness.innerVault().balanceOf(address(harness.receiver())) == 0);
    }
}

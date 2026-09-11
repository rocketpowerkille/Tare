// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BoundedVaultExit} from "../src/BoundedVaultExit.sol";
import {TestVault, TestAsset} from "./fixtures/TestVault.sol";

interface Vm {
    function chainId(uint256) external;
    function warp(uint256) external;
    function roll(uint256) external;
    function setBlockhash(uint256, bytes32) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
    function expectRevert() external;
    function readFile(string calldata) external view returns (string memory);
    function parseJsonBytes(string calldata, string calldata) external pure returns (bytes memory);
}

contract BoundedVaultExitTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OWNER = address(0x1234);
    address private constant FORWARDER = address(0x5678);
    bytes32 private constant WORKFLOW = keccak256("tare-policy");
    bytes10 private constant NAME = bytes10("tare-exit");
    bytes32 private constant BLOCK_HASH = keccak256("canonical-block");
    uint256 private constant BASE_SEPOLIA_CHAIN_ID = 84532;
    BoundedVaultExit private exit;
    TestVault private vault;
    TestAsset private token;

    function setUp() public {
        vm.chainId(BASE_SEPOLIA_CHAIN_ID);
        vm.warp(1000);
        vm.roll(100);
        vm.setBlockhash(99, BLOCK_HASH);
        exit = new BoundedVaultExit(FORWARDER, WORKFLOW, NAME, OWNER);
        token = new TestAsset();
        vault = new TestVault(address(token));
        vault.mint(OWNER, 100);
        vm.prank(OWNER);
        vault.approve(address(exit), 100);
        vm.prank(OWNER);
        exit.arm(address(vault), 100, 95, 1500);
    }

    function report() private view returns (BoundedVaultExit.Report memory) {
        return BoundedVaultExit.Report(
            BASE_SEPOLIA_CHAIN_ID, address(exit), OWNER, address(vault), 100, 95, 1, 1400, 99, BLOCK_HASH, keccak256("evidence")
        );
    }

    function metadata() private pure returns (bytes memory) {
        return abi.encodePacked(WORKFLOW, NAME, OWNER, bytes2(0x0001));
    }

    function deliver(BoundedVaultExit.Report memory input) private {
        vm.prank(FORWARDER);
        exit.onReport(metadata(), abi.encode(input));
    }

    function reject(BoundedVaultExit.Report memory input, bytes4 selector) private {
        vm.expectRevert(selector);
        deliver(input);
    }

    function testExitIsExactOwnerOnlyAndSingleUse() public {
        deliver(report());
        require(vault.balanceOf(OWNER) == 0 && token.balanceOf(OWNER) == 100);
        require(token.balanceOf(address(exit)) == 0 && token.balanceOf(FORWARDER) == 0);
        reject(report(), BoundedVaultExit.InvalidReport.selector);
    }

    function testTypeScriptReportDecodesAndExecutesWithLocalIdentities() public {
        bytes memory payload = vm.parseJsonBytes(vm.readFile("test/fixtures/exit-report.json"), ".payload");
        require(payload.length == 352);
        BoundedVaultExit.Report memory r = abi.decode(payload, (BoundedVaultExit.Report));
        require(r.chainId == BASE_SEPOLIA_CHAIN_ID && r.observedBlock == 99);
        require(r.owner == 0x1111111111111111111111111111111111111111);
        require(r.vault == 0x2222222222222222222222222222222222222222);
        require(r.receiver == 0x3333333333333333333333333333333333333333);
        require(r.shares == 100 && r.minAssets == 95 && r.nonce == 1 && r.validUntil == 1400);
        require(r.observedHash == bytes32(uint256(type(uint256).max / 15 * 10)) && r.evidenceDigest != bytes32(0));
        // The golden vector is synthetic; bind its terms to this test's deployed contracts.
        r.receiver = address(exit);
        r.owner = OWNER;
        r.vault = address(vault);
        r.observedHash = BLOCK_HASH;
        deliver(r);
        require(token.balanceOf(OWNER) == 100);
    }

    function testRejectsCallerAndEveryWorkflowIdentityMismatch() public {
        vm.expectRevert(BoundedVaultExit.Unauthorized.selector);
        exit.onReport(metadata(), abi.encode(report()));
        bytes memory data = metadata();
        for (uint256 index = 0; index < 3; index++) {
            uint256 offset = index == 0 ? 0 : index == 1 ? 32 : 42;
            data[offset] = bytes1(uint8(data[offset]) ^ 1);
            vm.expectRevert(BoundedVaultExit.Unauthorized.selector);
            vm.prank(FORWARDER);
            exit.onReport(data, abi.encode(report()));
            data = metadata();
        }
    }

    function testRejectsShortSimulationMetadataAndTruncatedPayload() public {
        vm.expectRevert(BoundedVaultExit.Unauthorized.selector);
        vm.prank(FORWARDER);
        exit.onReport(abi.encodePacked(WORKFLOW, NAME, OWNER), abi.encode(report()));
        vm.expectRevert(BoundedVaultExit.InvalidReport.selector);
        vm.prank(FORWARDER);
        exit.onReport(metadata(), hex"1234");
    }

    function testZeroWorkflowIdDisablesOnlyIdCheck() public {
        BoundedVaultExit ownerAndNameExit = new BoundedVaultExit(FORWARDER, bytes32(0), NAME, OWNER);
        bytes memory laterWorkflow = abi.encodePacked(keccak256("config-with-receiver"), NAME, OWNER, bytes2(0x0001));

        vm.expectRevert(BoundedVaultExit.InvalidReport.selector);
        vm.prank(FORWARDER);
        ownerAndNameExit.onReport(laterWorkflow, hex"1234");

        vm.expectRevert(BoundedVaultExit.Unauthorized.selector);
        ownerAndNameExit.onReport(laterWorkflow, hex"1234");

        bytes memory wrongName =
            abi.encodePacked(keccak256("config-with-receiver"), bytes10("other"), OWNER, bytes2(0x0001));
        vm.expectRevert(BoundedVaultExit.Unauthorized.selector);
        vm.prank(FORWARDER);
        ownerAndNameExit.onReport(wrongName, hex"1234");

        bytes memory wrongOwner = abi.encodePacked(keccak256("config-with-receiver"), NAME, address(1), bytes2(0x0001));
        vm.expectRevert(BoundedVaultExit.Unauthorized.selector);
        vm.prank(FORWARDER);
        ownerAndNameExit.onReport(wrongOwner, hex"1234");
    }

    function testOnlyWorkflowIdMayBeDisabled() public {
        vm.expectRevert(BoundedVaultExit.Unauthorized.selector);
        new BoundedVaultExit(address(0), bytes32(0), NAME, OWNER);
        vm.expectRevert(BoundedVaultExit.Unauthorized.selector);
        new BoundedVaultExit(FORWARDER, bytes32(0), bytes10(0), OWNER);
        vm.expectRevert(BoundedVaultExit.Unauthorized.selector);
        new BoundedVaultExit(FORWARDER, bytes32(0), NAME, address(0));
    }

    function testRejectsChainReceiverOwnerVaultAmountAndPriceChanges() public {
        BoundedVaultExit.Report memory r = report();
        r.chainId = 1;
        reject(r, BoundedVaultExit.InvalidReport.selector);
        r = report();
        r.receiver = address(1);
        reject(r, BoundedVaultExit.InvalidReport.selector);
        r = report();
        r.owner = address(1);
        reject(r, BoundedVaultExit.InvalidReport.selector);
        r = report();
        r.vault = address(1);
        reject(r, BoundedVaultExit.InvalidReport.selector);
        r = report();
        r.shares = 101;
        reject(r, BoundedVaultExit.InvalidReport.selector);
        r = report();
        r.minAssets = 94;
        reject(r, BoundedVaultExit.InvalidReport.selector);
    }

    function testCancelAndRearmInvalidateOutstandingReports() public {
        vm.prank(OWNER);
        exit.cancel();
        reject(report(), BoundedVaultExit.InvalidReport.selector);
        vm.prank(OWNER);
        exit.arm(address(vault), 100, 95, 1500);
        reject(report(), BoundedVaultExit.InvalidReport.selector);
        BoundedVaultExit.Report memory r = report();
        r.nonce = 3;
        deliver(r);
    }

    function testExpiredFutureOrOrphanEvidenceCannotExecute() public {
        BoundedVaultExit.Report memory r = report();
        r.validUntil = 999;
        reject(r, BoundedVaultExit.StaleEvidence.selector);
        r = report();
        r.observedBlock = 100;
        reject(r, BoundedVaultExit.StaleEvidence.selector);
        r = report();
        r.observedBlock = 35;
        reject(r, BoundedVaultExit.StaleEvidence.selector);
        r = report();
        r.observedHash = keccak256("orphan");
        reject(r, BoundedVaultExit.StaleEvidence.selector);
        vm.warp(1501);
        reject(report(), BoundedVaultExit.StaleEvidence.selector);
    }

    function testSlippageOrFakeVaultPayoutRevertsWithoutConsumingAuthorization() public {
        vault.setPayout(94, false);
        reject(report(), BoundedVaultExit.UnexpectedVaultResult.selector);
        require(vault.balanceOf(OWNER) == 100);
        vault.setPayout(100, true);
        reject(report(), BoundedVaultExit.UnexpectedVaultResult.selector);
        vault.setPayout(100, false);
        deliver(report());
    }

    function testAssetMutationAndMissingAllowanceFail() public {
        vault.setAsset(address(new TestAsset()));
        reject(report(), BoundedVaultExit.UnexpectedVaultResult.selector);
        vault.setAsset(address(token));
        vm.prank(OWNER);
        vault.approve(address(exit), 0);
        vm.expectRevert();
        deliver(report());
    }

    function testReentryCannotChangeAuthorizations() public {
        vault.setCallback(address(exit), abi.encodeCall(exit.cancel, ()));
        deliver(report());
        require(vault.balanceOf(OWNER) == 0);
    }

    function testOtherChainsAreRejected() public {
        vm.chainId(1);
        vm.expectRevert(BoundedVaultExit.Unauthorized.selector);
        new BoundedVaultExit(FORWARDER, WORKFLOW, NAME, OWNER);

        vm.chainId(11155111);
        vm.expectRevert(BoundedVaultExit.Unauthorized.selector);
        new BoundedVaultExit(FORWARDER, WORKFLOW, NAME, OWNER);
    }

    function testFuzzArbitraryShareAmountsCannotExceedConsent(uint128 shares) public {
        if (shares == 100) return;
        BoundedVaultExit.Report memory r = report();
        r.shares = shares;
        reject(r, BoundedVaultExit.InvalidReport.selector);
        require(vault.balanceOf(OWNER) == 100);
    }
}

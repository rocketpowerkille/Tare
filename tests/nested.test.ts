import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NestedCaptureSchema, replayNestedCapture } from '../packages/resolver/src/nested.js';
import { readV2Root, reconcileV2, V2 } from '../packages/adapters/src/morpho-v2.js';
import { SELECTOR } from '../packages/adapters/src/morpho-blue.js';
import { word } from '../packages/sources/src/evm.js';
import { USDC_USD_FEED } from '../packages/sources/src/chainlink.js';
import { assessLoanBacking } from '../packages/verification/src/backing.js';
import { runCli } from './helpers/cli.js';
import { RecordedReader } from '../packages/sources/src/recorded.js';

const path = 'fixtures/live/ov-usdc-v2.capture.json';
const fixture = async () => NestedCaptureSchema.parse(JSON.parse(await readFile(path, 'utf8')));
test('real V2 -> V1 -> Blue capture conserves the owner quote and replays its timestamped price', async () => {
  const result = await replayNestedCapture(await fixture());
  assert.equal(result.status, 'complete');
  assert.equal(result.capture.rpc.calls.length, 96);
  assert.equal(result.analysis!.economicLayers, 3);
  assert.equal(result.analysis!.branches[0]!.markets.length, 12);
  assert.equal(result.analysis!.quoteRaw, '17464608156');
  assert.equal(result.analysis!.unattributedAssetsRaw, '13');
  const leaves = result.analysis!.branches.flatMap(branch => branch.markets);
  const attributed = leaves.reduce((sum, leaf) => sum + BigInt(leaf.attributedAssetsRaw!), 0n);
  assert.equal(attributed + BigInt(result.analysis!.unattributedAssetsRaw!) + BigInt(result.analysis!.attributedIdleRaw!), 17464608156n);
  assert.equal(result.valuation.kind, 'observed');
  if (result.valuation.kind === 'observed') assert.equal(result.valuation.rootClaim.valueRaw, '1746260199646');
  assert.equal(result.metric.kind, 'unavailable');
  assert.ok(result.backing!.claims.every(claim => claim.verifiedBackingRaw === null));
});
test('root fee/cap mismatches, unsupported positive adapters and ownership cycles suppress attribution', async () => {
  for (const change of ['quote', 'cycle', 'duplicate', 'unsupported', 'limit'] as const) {
    const capture = await fixture();
    const calls = capture.rpc.calls;
    if (change === 'quote') calls.find(call => call.to === capture.vault && call.data.startsWith(SELECTOR.convert))!.result = `0x${word(1n)}`;
    if (change === 'cycle') calls.find(call => call.data === V2.morphoVaultV1)!.result = `0x${word(capture.vault)}`;
    if (change === 'duplicate') {
      calls.find(call => call.to === capture.vault && call.data === V2.adapters + word(1n))!.result =
        calls.find(call => call.to === capture.vault && call.data === V2.adapters + word(0n))!.result;
    }
    if (change === 'unsupported') calls.filter(call => call.data === V2.realAssets)[1]!.result = `0x${word(1n)}`;
    if (change === 'limit') calls.find(call => call.data === V2.adaptersLength)!.result = `0x${word(65n)}`;
    const result = await replayNestedCapture(capture);
    assert.equal(result.status, 'partial');
    assert.ok(result.analysis?.branches.every(branch => branch.markets.every(market => market.attributedAssetsRaw === null)) ?? true);
  }
});
test('V2 reconciliation handles both pending fees, disabled fee gates and excessive fees', async () => {
  const capture = await fixture();
  const real = await readV2Root(new RecordedReader(capture.rpc), capture.vault, capture.owner);
  // Authored small-number accounting control: performance assets=5, management=15,
  // denominator=131, pending shares=3+11, owner quote=floor(1510/114)=13.
  const root = { ...real, supply: 99n, virtual: 1n, shares: 10n, stored: 100n,
    elapsed: 10n, rate: 10n ** 17n, assets: 150n, quote: 13n,
    performanceFee: 10n ** 17n, managementFee: 10n ** 16n, accrued: [150n, 3n, 11n] };
  assert.equal(reconcileV2(root, 150n), true);
  assert.equal(reconcileV2({ ...root, managementFee: 10n ** 18n }, 150n), false);
  assert.equal(reconcileV2(root, 300n), false);
  assert.equal(reconcileV2({ ...root, performanceFee: 0n, managementFee: 0n, quote: 15n, accrued: [150n, 0n, 0n] }, 150n), true);
});
test('reorg and missing root evidence cannot produce attributed nested exposure', async () => {
  const capture = await fixture();
  capture.rpc.confirmed = false;
  assert.equal((await replayNestedCapture(capture)).analysis, null);
  capture.rpc.confirmed = true;
  capture.rpc.calls = capture.rpc.calls.filter(call => call.data !== V2.accrueInterestView);
  assert.equal((await replayNestedCapture(capture)).analysis, null);
});
test('missing price preserves accounting but blocks valuation', async () => {
  const capture = await fixture();
  capture.rpc.calls = capture.rpc.calls.filter(call => call.to !== USDC_USD_FEED);
  const result = await replayNestedCapture(capture);
  assert.equal(result.status, 'complete');
  assert.equal(result.valuation.kind, 'unavailable');
  assert.ok(result.metric.reasons.includes('missing-valuation'));
});
test('shared loan paths consolidate before liquidity bounds; collateral never becomes backing', async () => {
  const result = await replayNestedCapture(await fixture());
  const market = result.analysis!.branches[0]!.markets[0]!;
  const claim = { ...market, attributedAssetsRaw: '100' };
  const backing = assessLoanBacking([claim, claim]);
  assert.equal(backing.claims.length, 1);
  assert.equal(backing.claims[0]!.claimRaw, '200');
  assert.equal(backing.claims[0]!.verifiedBackingRaw, null);
  const inconsistent = assessLoanBacking([claim, { ...claim, expectedBorrowAssetsRaw: '1' }]);
  assert.ok(inconsistent.findings.includes('conflicting-shared-market-state'));
  assert.equal(inconsistent.claims[0]!.accountingLiquidityUpperBoundRaw, null);
});
test('nested replay and phase-four controls are exposed through the CLI', async () => {
  const replay = await runCli(['live', 'nested-replay', path, '--json']);
  assert.equal(replay.code, 0);
  assert.equal(JSON.parse(replay.stdout).sourceMode, 'recorded-rpc');
  const control = await runCli(['demo', 'phase4', '--json']);
  assert.equal(control.code, 0);
  assert.equal(JSON.parse(control.stdout)[0].metric.multipleMillionths, '1000000');
});

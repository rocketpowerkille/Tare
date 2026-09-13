import assert from 'node:assert/strict';
import test from 'node:test';
import { investigateChanges } from '../packages/receipts/src/position-changes.js';
import { positionSnapshot } from '../packages/receipts/src/position-snapshot.js';
import { exposureOverlap } from '../packages/receipts/src/exposure-overlap.js';
import { acquireChangeReports, validateChangeInput } from '../packages/service/src/change-acquisition.js';
import { InvestigationStore } from '../apps/api/src/investigation-store.js';
import { ServiceError } from '../packages/service/src/requests.js';

const addr = (digit: string) => `0x${digit.repeat(40)}`;
const hash = (digit: string) => `0x${digit.repeat(64)}`;
const market = (digit = 'a', amount: string | null = '20') => ({ marketId: hash(digit), loanToken: addr('3'),
  collateralToken: addr('4'), oracle: addr('5'), irm: addr('6'), lltvRaw: '860000000000000000', vaultAssetsRaw: '100', attributedAssetsRaw: amount });
function report(block = '20', vault = addr('2')) {
  return { protocol: 'metamorpho-v1-blue-v1', kind: 'complete', sourceMode: 'recorded-rpc', chainId: 1, owner: addr('1'),
    capture: { vault, owner: addr('1'), chainId: 1, blockConfirmed: true, capturedAt: '2026-09-13T10:00:00.000Z',
      block: { number: block, hash: hash(block === '20' ? '1' : '2'), timestamp: '1789293600' } },
    vault: { address: vault, asset: addr('3'), decimals: 6, sharesRaw: '10000000000000000000000001', totalSupplyRaw: '20000000000000000000000002',
      totalAssetsRaw: '1000', convertToAssetsRaw: '500', feeRaw: '0' },
    markets: [market()], coverage: { expectedMarkets: 1, observedMarkets: 1 } };
}
function graph(primary: ReturnType<typeof report>, block = primary.capture.block.number, status = 'matched') {
  return { reportType: 'comprehensive-position-check', primary, modules: [{ id: 'the-graph', status,
    report: { reportType: 'accounting-verification', status,
      capture: { chainId: 1, vault: primary.vault.address, rpc: { confirmed: true, block: { ...primary.capture.block, number: block } } },
      checks: [{ status }] } }] };
}

test('two-block comparison uses exact signed integers without share-decimal or USD guesses', () => {
  const previous = report(); const current = report('21');
  current.vault.sharesRaw = '10000000000000000000000000'; current.markets[0]!.attributedAssetsRaw = '0';
  const comparison = investigateChanges(current, previous);
  assert.equal(comparison.comparable, true);
  assert.equal(comparison.changes.find(item => item.field === 'sharesRaw')?.deltaRaw, '-1');
  assert.equal(comparison.changes.find(item => item.field === 'attributedAssetsRaw')?.deltaRaw, '-20');
  assert.equal(comparison.changes.find(item => item.field === 'attributedAssetsRaw')?.category, 'derived');
  assert.deepEqual(comparison, investigateChanges(current, previous));
  assert.doesNotMatch(JSON.stringify(comparison), /confidenceScore|valueUsd/);
});

test('market order does not create changes and market identity is retained', () => {
  const previous = report(); const current = report('21');
  for (const item of [previous, current]) { item.markets.push(market('b')); item.coverage = { expectedMarkets: 2, observedMarkets: 2 }; }
  current.markets.reverse();
  const changes = investigateChanges(current, previous);
  assert.equal(changes.changedFields, 0);
  assert.equal(changes.changes.find(item => item.field === 'attributedAssetsRaw')?.marketId, hash('a'));
});

test('missing or partial market sets are not invented as zero or confirmed withdrawals', () => {
  const previous = report(); const current = report('21');
  current.markets = []; current.kind = 'partial';
  assert.equal(investigateChanges(current, previous).changes.find(item => item.field === 'market-presence')?.status, 'unavailable');
  current.kind = 'complete'; current.coverage = { expectedMarkets: 0, observedMarkets: 0 };
  const membership = investigateChanges(current, previous).changes.find(item => item.field === 'market-presence');
  assert.equal(membership?.status, 'only-before'); assert.equal(membership?.deltaRaw, undefined);
  current.markets = [market('a', null)]; current.coverage = { expectedMarkets: 1, observedMarkets: 1 };
  const missing = investigateChanges(current, previous).changes.find(item => item.field === 'attributedAssetsRaw');
  assert.equal(missing?.status, 'unavailable'); assert.equal(missing?.deltaRaw, undefined);
});

test('different wallets, vaults, chains, assets, units, unsupported reports and block conflicts fail closed', () => {
  const previous = report();
  const variants = [
    { ...report('21'), owner: addr('9') }, { ...report('21'), chainId: 8453 }, report('21', addr('9')),
    { ...report('21'), protocol: 'nested-exposure' },
    { ...report('21'), vault: { ...report().vault, asset: addr('9') } },
    { ...report('21'), vault: { ...report().vault, decimals: 18 } }, report('19'), report('20'),
    { ...report('21'), capture: { ...report('21').capture, blockConfirmed: false } },
    { ...report('21'), capture: { ...report('21').capture, block: { ...report('21').capture.block, hash: hash('1') } } },
    { ...report('21'), capture: { ...report('21').capture, owner: addr('9') } },
  ];
  for (const current of variants) {
    const result = investigateChanges(current, previous); assert.equal(result.comparable, false); assert.equal(result.changes.length, 0);
  }
});

test('Graph agreement requires matching block, hash, vault and actual successful accounting checks', () => {
  const primary = report('21');
  assert.equal(positionSnapshot(graph(primary)).graph.supportsAccounting, true);
  assert.equal(positionSnapshot(graph(primary, '22')).graph.supportsAccounting, false);
  assert.equal(positionSnapshot(graph(primary, '21', 'mismatch')).graph.supportsAccounting, false);
  assert.equal(positionSnapshot(primary).graph.status, 'not-included');
  assert.equal(investigateChanges(graph(primary, '21', 'mismatch'), graph(report())).status, 'source-mismatch');
  const bad = graph(primary); bad.modules[0]!.report.capture.rpc.block.hash = hash('9');
  assert.equal(positionSnapshot(bad).graph.supportsAccounting, false);
});

test('duplicate or conflicting market parameters cannot produce amount differences', () => {
  const current = report('21'); current.markets[0]!.oracle = addr('9');
  assert.equal(investigateChanges(current, report()).changes.find(item => item.field === 'attributedAssetsRaw')?.deltaRaw, undefined);
  current.markets.push(market());
  assert.equal(positionSnapshot(current).markets.length, 0);
  assert.equal(positionSnapshot(current).completeMarkets, false);
});

const wallet = (...reports: unknown[]) => ({ reportType: 'wallet-investigation', owner: addr('1'), results: reports.map(report => ({ report })) });
test('overlap totals only compatible same-block leaf amounts and cites each source', () => {
  const result = exposureOverlap(wallet(report(), report('20', addr('7'))));
  assert.equal(result.overlaps[0]?.totalAttributedAssetsRaw, '40');
  assert.equal(result.overlaps[0]?.members[0]?.observedBlock, '20');
  assert.equal(result.overlaps[0]?.members[1]?.market.oracle, addr('5'));
  assert.equal(result.coverageComplete, false);
  assert.match(result.limitations.join(' '), /not holdings/);
});

test('different block overlap remains visible without summation', () => {
  const result = exposureOverlap(wallet(report(), report('21', addr('7'))));
  assert.equal(result.overlaps[0]?.status, 'different-blocks');
  assert.equal(result.overlaps[0]?.totalAttributedAssetsRaw, null);
});

test('overlap excludes duplicate vault identities, nested and unavailable positions', () => {
  const result = exposureOverlap(wallet(report(), report(), { reportType: 'nested-exposure' }));
  assert.equal(result.eligiblePositions, 0); assert.equal(result.excludedPositions, 3); assert.deepEqual(result.overlaps, []);
});

test('overlap preserves zero, missing and cross-network boundaries', () => {
  const zero = report('20', addr('7')); zero.markets[0]!.attributedAssetsRaw = '0';
  assert.equal(exposureOverlap(wallet(report(), zero)).overlaps[0]?.totalAttributedAssetsRaw, '20');
  zero.markets[0]!.attributedAssetsRaw = null;
  assert.equal(exposureOverlap(wallet(report(), zero)).overlaps[0]?.totalAttributedAssetsRaw, null);
  const other = report('20', addr('7')); other.chainId = 8453; other.capture.chainId = 8453;
  assert.equal(exposureOverlap(wallet(report(), other)).overlaps.length, 0);
  other.chainId = 999; other.capture.chainId = 999;
  assert.equal(positionSnapshot(other).supported, false);
});

const input = { owner: addr('1'), vault: addr('2'), beforeBlock: '20', afterBlock: '21' };
test('bounded acquisition makes four pinned requests and retains Graph unavailability', async () => {
  const calls: unknown[] = []; const stages: unknown[] = [];
  const result = await acquireChangeReports(input, async request => {
    calls.push(request);
    if (request.operation === 'verify-accounting') throw new Error('test source unavailable');
    return report(request.blockNumber);
  }, stage => stages.push(stage), true);
  assert.equal(calls.length, 4); assert.equal(positionSnapshot(result.current).graph.status, 'unavailable');
  assert.equal(investigateChanges(result.current, result.previous).comparable, true);
  assert.doesNotMatch(JSON.stringify(calls), /latest/); assert.match(JSON.stringify(stages), /unavailable/);
});

test('acquisition refuses unexpected latest response and does not request its Graph block', async () => {
  const calls: unknown[] = [];
  const result = await acquireChangeReports(input, async request => { calls.push(request); return report('99'); }, () => {}, true);
  assert.equal(calls.length, 2); assert.equal(investigateChanges(result.current, result.previous).comparable, false);
});

test('acquisition stops for expired authorization, payment challenges and cancellation without retries', async () => {
  for (const status of [401, 402]) {
    let calls = 0;
    await assert.rejects(acquireChangeReports(input, async () => { calls++; throw new ServiceError(status, 'denied', 'Denied'); }, () => {}, true));
    assert.equal(calls, 1);
  }
  await assert.rejects(acquireChangeReports(input, async () => report(), () => {}, true, () => false), /cancelled/);
  for (const fields of [{ beforeBlock: 'latest' }, { beforeBlock: '21' }, { afterBlock: '2147483648' }, { owner: 'invalid' }]) {
    assert.throws(() => validateChangeInput({ ...input, ...fields }));
  }
});

test('snapshot supplies citeable deterministic change facts and overlap scope without new verification', () => {
  const current = report('21'); current.vault.feeRaw = '100';
  const saved = new InvestigationStore().create('test', { report: current, previous: report() });
  assert.ok(saved.facts.some(fact => fact.id === 'comparison.scope'));
  assert.ok(saved.facts.some(fact => fact.id.startsWith('comparison.change.') && JSON.stringify(fact.value).includes('feeRaw')));
  assert.match(saved.provenanceNotice, /not independent authentication/);
  const shared = new InvestigationStore().create('test', { report: wallet(report(), report('20', addr('7'))) });
  assert.ok(shared.facts.some(fact => fact.id === 'current.overlap.0'));
  assert.ok(shared.facts.some(fact => fact.id === 'current.overlap.scope'));
});

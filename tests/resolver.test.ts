import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSnapshot } from '../packages/sources/src/snapshot.js';
import { SnapshotSchema, ReceiptSchema, formatUnits } from '../packages/domain/src/index.js';
import type { Snapshot } from '../packages/domain/src/index.js';
import { resolveSnapshot } from '../packages/resolver/src/index.js';

const fixture = (name = 'control') => loadSnapshot(`fixtures/synthetic/${name}.json`);
function rootVault(snapshot: Snapshot) {
  const root = snapshot.nodes.find(node => node.id === 'root');
  assert.ok(root?.kind === 'vault');
  return root;
}

test('control attributes exactly 100 USDC, but cannot claim verified backing or a multiple', async () => {
  const result = resolveSnapshot(await fixture());
  assert.equal(result.kind, 'complete');
  assert.deepEqual(result.gaps, []);
  assert.equal(result.leaves[0]?.amountRaw, '100000000');
  assert.equal(result.metric.kind, 'unavailable');
  assert.equal(result.verification, 'unverified');
  assert.equal(formatUnits('100000000', 6), '100');
  assert.equal(formatUnits('1', 18), '0.000000000000000001');
  assert.equal(formatUnits('0', 6), '0');
  assert.equal(formatUnits('123', 0), '123');
});
test('deep path resolves three vault layers and preserves raw amounts', async () => {
  const result = resolveSnapshot(await fixture('deep'));
  assert.equal(result.kind, 'complete');
  assert.equal(result.steps.length, 3);
  assert.equal(result.leaves[0]?.amountRaw, '100000000');
});
test('cycles terminate with the exact path and no valued terminal backing', async () => {
  const result = resolveSnapshot(await fixture('cycle'));
  assert.equal(result.kind, 'partial');
  assert.equal(result.gaps[0]?.reason, 'cycle');
  assert.deepEqual(result.gaps[0]?.path, ['root', 'middle', 'root']);
  assert.deepEqual(result.leaves, []);
  const self = await fixture();
  rootVault(self).allocations = [{ target: 'root', balanceRaw: '100000000' }];
  assert.deepEqual(resolveSnapshot(self).gaps[0]?.path, ['root', 'root']);
});
test('source outage preserves the healthy branch and reports unknown value coverage', async () => {
  const result = resolveSnapshot(await fixture('degraded'));
  assert.equal(result.kind, 'partial');
  assert.equal(result.leaves[0]?.amountRaw, '70000000');
  assert.equal(result.gaps[0]?.reason, 'source-unavailable');
  assert.equal(result.coverage.valueCoverage, null);
});
test('shared descendants aggregate distinct allocations without false cycles', async () => {
  const snapshot = await fixture('deep');
  const root = rootVault(snapshot);
  root.allocations = [{ target: 'middle', balanceRaw: '40000000' }, { target: 'inner', balanceRaw: '60000000' }];
  const result = resolveSnapshot(snapshot);
  assert.equal(result.kind, 'complete');
  assert.equal(result.leaves[0]?.amountRaw, '100000000');
  root.allocations.reverse();
  assert.deepEqual(resolveSnapshot(snapshot).leaves, result.leaves);
});
test('per-hop integer floors are recorded and differ from rounding only at the end', async () => {
  const snapshot = await fixture('deep');
  snapshot.root.sharesRaw = '2';
  for (const node of snapshot.nodes) if (node.kind === 'vault') {
    node.totalSupplyRaw = '3';
    const balanceRaw = node.id === 'root' ? '2' : node.id === 'middle' ? '5' : '3';
    node.allocations = node.allocations.map(edge => ({ ...edge, balanceRaw }));
  }
  const result = resolveSnapshot(snapshot);
  assert.deepEqual(result.steps.map(step => step.outputRaw), ['1', '1', '1']);
  assert.deepEqual(result.steps.map(step => step.remainderNumerator), ['1', '2', '0']);
  assert.equal(result.leaves[0]?.amountRaw, '1');
  assert.equal((2n * 2n * 5n * 3n) / (3n * 3n * 3n), 2n, 'A single final floor would incorrectly return 2');
});
test('large quantities and different decimals never pass through floating point', async () => {
  const snapshot = await fixture();
  snapshot.root.sharesRaw = '9007199254740993001';
  const root = rootVault(snapshot);
  root.totalSupplyRaw = snapshot.root.sharesRaw;
  root.allocations = [{ target: 'usdc', balanceRaw: '9007199254740993001' }];
  const result = resolveSnapshot(snapshot);
  assert.equal(result.leaves[0]?.amountRaw, snapshot.root.sharesRaw);
  assert.equal(formatUnits(result.leaves[0]!.amountRaw, 18), '9.007199254740993001');
});
test('zero positions remain zero', async () => {
  const snapshot = await fixture();
  snapshot.root.sharesRaw = '0';
  assert.equal(resolveSnapshot(snapshot).leaves[0]?.amountRaw, '0');
});
test('depth counts vault layers and global visits stop exponential path expansion', async () => {
  assert.equal(resolveSnapshot(await fixture(), { maxDepth: 1 }).kind, 'complete');
  assert.equal(resolveSnapshot(await fixture('deep'), { maxDepth: 2 }).gaps[0]?.reason, 'depth-limit');
  const result = resolveSnapshot(await fixture('deep'), { maxVisits: 1 });
  assert.equal(result.gaps[0]?.reason, 'visit-limit');
  assert.equal(result.coverage.visits, 1);
  assert.throws(() => resolveSnapshot({}, { maxDepth: -1 }));
});
test('missing observations, mismatched blocks, wrappers and invalid ownership produce partial states', async () => {
  const missing = await fixture();
  missing.nodes = missing.nodes.filter(node => node.kind !== 'token');
  assert.equal(resolveSnapshot(missing).gaps[0]?.reason, 'missing-node');
  const mismatch = await fixture();
  rootVault(mismatch).block.hash = `0x${'cc'.repeat(32)}`;
  assert.equal(resolveSnapshot(mismatch).gaps[0]?.reason, 'block-mismatch');
  const opaque = await fixture();
  const leaf = opaque.nodes[1]!;
  opaque.nodes[1] = { id: leaf.id, block: leaf.block, sourceId: leaf.sourceId, kind: 'opaque', reason: 'LP tokens have no supported adapter' };
  assert.equal(resolveSnapshot(opaque).gaps[0]?.reason, 'unsupported-wrapper');
  const excess = await fixture();
  excess.root.sharesRaw = '100000001';
  assert.equal(resolveSnapshot(excess).gaps[0]?.reason, 'ownership-exceeds-supply');
});
test('external boundaries reject zero supply, duplicate edges/nodes, unknown fields and fabricated live provenance', async () => {
  const snapshot = await fixture();
  assert.equal(SnapshotSchema.safeParse({ ...snapshot, provenance: 'live' }).success, false);
  assert.equal(SnapshotSchema.safeParse({ ...snapshot, secret: 'unexpected' }).success, false);
  assert.equal(SnapshotSchema.safeParse({ ...snapshot, nodes: [...snapshot.nodes, snapshot.nodes[0]] }).success, false);
  const root = rootVault(snapshot);
  root.allocations.push(root.allocations[0]!);
  assert.equal(SnapshotSchema.safeParse(snapshot).success, false);
  root.allocations.pop(); root.totalSupplyRaw = '0';
  assert.equal(SnapshotSchema.safeParse(snapshot).success, false);
});
test('receipt boundary rejects complete-with-gaps and partial-without-gaps', async () => {
  const partial = resolveSnapshot(await fixture('cycle'));
  assert.equal(ReceiptSchema.safeParse({ ...partial, kind: 'complete' }).success, false);
  assert.equal(ReceiptSchema.safeParse({ ...partial, gaps: [] }).success, false);
  assert.deepEqual(ReceiptSchema.parse(JSON.parse(JSON.stringify(partial))), partial);
});

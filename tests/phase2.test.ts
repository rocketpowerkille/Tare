import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeRecording, RecordingSchema } from '../packages/adapters/src/index.js';
import type { ExposureAdapter } from '../packages/adapters/src/index.js';
import { readJsonFile } from '../packages/sources/src/snapshot.js';
import { assetId, ReceiptV2Schema, SnapshotV2Schema } from '../packages/domain/src/v2.js';
import type { SnapshotV2 } from '../packages/domain/src/v2.js';
import { resolveSnapshotV2 } from '../packages/resolver/src/v2.js';

const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;
const fixture = async (name = 'multi-asset') => normalizeRecording(await readJsonFile(`fixtures/recordings/${name}.json`));
function vault(snapshot: SnapshotV2, n = 3) {
  const node = snapshot.nodes.find(node => node.address === address(n));
  assert.ok(node?.kind === 'vault'); return node;
}
test('canonical identity normalizes casing, distinguishes chains and rejects address aliases', async () => {
  assert.equal(assetId(1, `0x${'AB'.repeat(20)}`), `eip155:1:erc20:0x${'ab'.repeat(20)}`);
  assert.notEqual(assetId(1, address(1)), assetId(8453, address(1)));
  const snapshot = await fixture();
  snapshot.nodes.push(snapshot.nodes[0]!);
  assert.equal(SnapshotV2Schema.safeParse(snapshot).success, false);
  assert.throws(() => assetId(-1, address(1)));
});
test('multi-position resolution attributes mixed decimals and keeps references out of holdings', async () => {
  const result = resolveSnapshotV2(await fixture());
  assert.equal(result.kind, 'complete');
  assert.deepEqual(result.leaves.map(leaf => leaf.amountRaw), ['32000000', '320000000000000000']);
  assert.equal(result.dependencies.length, 6);
  assert.ok(result.dependencies.filter(edge => edge.kind === 'risk-dependency').every(edge => edge.to.includes(':contract:')));
  assert.ok(result.steps.every(step => step.to !== assetId(1, address(99))));
  assert.ok(result.leaves.every(leaf => leaf.evidenceIds.includes('account')));
  assert.equal(result.metric.kind, 'unavailable');
  assert.equal(result.verification.kind, 'unverified');
  assert.match(result.snapshotDigest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(ReceiptV2Schema.parse(JSON.parse(JSON.stringify(result))), result);
});
test('separate direct and indirect holdings in a shared vault are counted once each', async () => {
  const result = resolveSnapshotV2(await fixture('overlap'));
  assert.equal(result.kind, 'complete');
  assert.deepEqual(result.leaves.map(leaf => leaf.amountRaw), ['42000000', '420000000000000000']);
});
test('duplicate account positions and duplicate holdings are rejected', async () => {
  const snapshot = await fixture();
  snapshot.positions.push(snapshot.positions[0]!);
  assert.equal(SnapshotV2Schema.safeParse(snapshot).success, false);
  snapshot.positions.pop();
  vault(snapshot).relationships.push(vault(snapshot).relationships[0]!);
  assert.equal(SnapshotV2Schema.safeParse(snapshot).success, false);
});
test('same-symbol tokens remain separate assets and wrappers stay unresolved', async () => {
  const snapshot = await fixture();
  const token = snapshot.nodes.find(node => node.address === address(5));
  assert.ok(token?.kind === 'token');
  token.symbol = 'USDC';
  assert.equal(resolveSnapshotV2(snapshot).leaves.length, 2);
  const recording = RecordingSchema.parse(await readJsonFile('fixtures/recordings/multi-asset.json'));
  recording.records[4]!.response = { type: 'token', classification: 'unsupported-wrapper', symbol: 'WETH', decimals: 18 };
  const result = resolveSnapshotV2(normalizeRecording(recording));
  assert.equal(result.kind, 'partial');
  assert.equal(result.findings[0]?.reason, 'unsupported-wrapper');
  assert.equal(result.leaves.length, 1);
});
test('integer attribution conserves supported quantities across a range of account balances', async () => {
  for (let shares = 0n; shares <= 100n; shares += 5n) {
    const snapshot = await fixture();
    snapshot.positions = [snapshot.positions[0]!];
    snapshot.positions[0]!.sharesRaw = shares.toString();
    const result = resolveSnapshotV2(snapshot);
    assert.equal(result.kind, 'complete');
    const innerShares = shares * 60n / 100n;
    assert.equal(result.leaves[0]?.amountRaw, (innerShares * 100000000n / 100n).toString());
    for (const step of result.steps) {
      assert.ok(BigInt(step.remainderNumerator) < BigInt(step.totalSupplyRaw));
      assert.equal(BigInt(step.outputRaw) * BigInt(step.totalSupplyRaw) + BigInt(step.remainderNumerator), BigInt(step.inputRaw) * BigInt(step.balanceRaw));
    }
  }
});
test('aggregate ownership contradictions suppress all aggregate leaves', async () => {
  const snapshot = await fixture('overlap');
  snapshot.positions[2]!.sharesRaw = '90';
  const result = resolveSnapshotV2(snapshot);
  assert.equal(result.kind, 'partial');
  assert.ok(result.findings.some(finding => finding.reason === 'ownership-exceeds-supply'));
  assert.deepEqual(result.leaves, []);
});
test('unsupported debt never masquerades as gross assets available to the owner', async () => {
  const result = resolveSnapshotV2(await fixture('debt'));
  assert.equal(result.kind, 'partial');
  assert.ok(result.findings.every(finding => finding.reason === 'unsupported-debt'));
  assert.deepEqual(result.leaves, []);
  const snapshot = await fixture('debt');
  snapshot.evidence.find(item => item.id === 'debt')!.sourceId = 'offline';
  assert.deepEqual(resolveSnapshotV2(snapshot).leaves, [], 'Unknown debt evidence also blocks gross attribution');
});
test('degraded evidence retains supported branches and unknown value coverage', async () => {
  const result = resolveSnapshotV2(await fixture('degraded'));
  assert.equal(result.kind, 'partial');
  assert.deepEqual(result.leaves.map(leaf => leaf.amountRaw), ['32000000']);
  assert.ok(result.findings.every(finding => finding.evidenceId === 'c-e'));
  assert.equal(result.coverage.valueCoverage, null);
});
test('node, edge and account observations must match both chain and block', async () => {
  for (const ref of ['c', 'a-holding', 'account']) {
    const snapshot = await fixture();
    snapshot.evidence.find(item => item.id === ref)!.block.number = '99';
    assert.ok(resolveSnapshotV2(snapshot).findings.some(finding => finding.reason === 'block-mismatch'));
  }
  const snapshot = await fixture();
  snapshot.evidence[0]!.chainId = 8453;
  assert.equal(resolveSnapshotV2(snapshot).kind, 'partial');
  snapshot.evidence[0]!.chainId = 1;
  snapshot.evidence[0]!.block.hash = `0x${'cd'.repeat(32)}`;
  assert.equal(resolveSnapshotV2(snapshot).kind, 'partial');
});
test('partial allocations, missing nodes and zero supply produce distinct findings', async () => {
  const snapshot = await fixture();
  vault(snapshot).allocationCoverage = 'partial';
  assert.equal(resolveSnapshotV2(snapshot).findings[0]?.reason, 'incomplete-allocation');
  vault(snapshot).allocationCoverage = 'complete';
  vault(snapshot).totalSupplyRaw = '0';
  assert.equal(resolveSnapshotV2(snapshot).findings[0]?.reason, 'zero-supply');
  snapshot.nodes = snapshot.nodes.filter(node => node.address !== address(3));
  assert.equal(resolveSnapshotV2(snapshot).findings[0]?.reason, 'missing-node');
});
test('cycles, depth, visits and edge budgets terminate with partial receipts', async () => {
  const cycle = resolveSnapshotV2(await fixture('cycle'));
  assert.ok(cycle.findings.some(finding => finding.reason === 'cycle'));
  const snapshot = await fixture();
  assert.equal(resolveSnapshotV2(snapshot, { maxDepth: 1 }).findings[0]?.reason, 'depth-limit');
  assert.equal(resolveSnapshotV2(snapshot, { maxVisits: 1 }).findings[0]?.reason, 'visit-limit');
  assert.equal(resolveSnapshotV2(snapshot, { maxEdges: 1 }).findings[0]?.reason, 'edge-limit');
  assert.throws(() => resolveSnapshotV2(snapshot, { maxEdges: 0 }));
});
test('canonical traversal order preserves outcomes under root and edge permutation', async () => {
  const snapshot = await fixture('overlap');
  const original = resolveSnapshotV2(snapshot);
  snapshot.nodes.reverse(); snapshot.positions.reverse();
  for (const node of snapshot.nodes) if (node.kind === 'vault') node.relationships.reverse();
  const reordered = resolveSnapshotV2(snapshot);
  assert.deepEqual(reordered.leaves, original.leaves);
  assert.deepEqual(reordered.steps, original.steps);
});
test('adapter schema drift and unsupported adapters create opaque gaps', async () => {
  assert.equal(resolveSnapshotV2(await fixture('schema-drift')).findings[0]?.reason, 'invalid-record');
  const recording = RecordingSchema.parse(await readJsonFile('fixtures/recordings/multi-asset.json'));
  recording.records[2]!.adapter = 'unknown-vault';
  const result = resolveSnapshotV2(normalizeRecording(recording));
  assert.equal(result.findings[0]?.reason, 'unsupported-adapter');
  assert.equal(result.metric.kind, 'unavailable');
});
test('adapter identity substitution is rejected and programming errors are not swallowed', async () => {
  const recording = await readJsonFile('fixtures/recordings/multi-asset.json');
  const bad: ExposureAdapter = { id: 'fixture-holdings-v1', normalize(record) {
    return { kind: 'opaque', address: record.address, evidenceId: 'wrong', reason: 'invalid-record' };
  } };
  assert.ok(normalizeRecording(recording, [bad]).nodes.every(node => node.kind === 'opaque' && node.reason === 'invalid-record'));
  const broken: ExposureAdapter = { id: bad.id, normalize() { throw new Error('programming failure'); } };
  assert.throws(() => normalizeRecording(recording, [broken]), /programming failure/);
  assert.throws(() => normalizeRecording(recording, [bad, bad]), /Duplicate adapter/);
});
test('external boundaries reject fabricated verification and unresolved evidence', async () => {
  const snapshot = await fixture();
  assert.equal(SnapshotV2Schema.safeParse({ ...snapshot, provenance: 'live' }).success, false);
  snapshot.evidence.pop();
  snapshot.positions[0]!.evidenceId = 'missing';
  assert.equal(SnapshotV2Schema.safeParse(snapshot).success, false);
  const partial = resolveSnapshotV2(await fixture('debt'));
  assert.equal(ReceiptV2Schema.safeParse({ ...partial, kind: 'complete' }).success, false);
  assert.equal(ReceiptV2Schema.safeParse({ ...partial, findings: [] }).success, false);
  assert.equal(ReceiptV2Schema.safeParse({ ...partial, verification: { kind: 'verified' } }).success, false);
  assert.equal(ReceiptV2Schema.safeParse({ ...partial, metric: { kind: 'available', value: '3' } }).success, false);
});
test('CLI replay, normalize, validate and resolve preserve v2 receipts and no-overwrite exports', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tare-phase2-'));
  const cli = (...args: string[]) => spawnSync(process.execPath, ['dist/apps/cli/src/main.js', ...args], { encoding: 'utf8', timeout: 10000 });
  try {
    const demo = cli('demo', 'phase2', '--json');
    assert.equal(demo.status, 0, demo.stderr);
    assert.equal(JSON.parse(demo.stdout).length, 6);
    const path = join(directory, 'snapshot.json');
    const recording = 'fixtures/recordings/multi-asset.json';
    assert.equal(cli('snapshot', 'normalize', recording, '--out', path).status, 0);
    assert.equal(cli('snapshot', 'normalize', recording, '--out', path).status, 1);
    assert.equal(cli('snapshot', 'validate', path).status, 0);
    const receiptPath = join(directory, 'receipt.json');
    const replay = cli('replay', recording, '--json', '--out', receiptPath);
    assert.equal(replay.status, 0, replay.stderr);
    const receipt = ReceiptV2Schema.parse(JSON.parse(replay.stdout));
    assert.deepEqual(JSON.parse(cli('resolve', path, '--json').stdout), receipt);
    assert.deepEqual(JSON.parse(await readFile(receiptPath, 'utf8')), receipt);
    assert.equal(cli('replay', recording, '--out', receiptPath).status, 1);
    for (const name of ['debt', 'degraded', 'cycle', 'schema-drift']) assert.equal(cli('replay', `fixtures/recordings/${name}.json`, '--json').status, 2);
    assert.equal(cli('replay', recording, '--max-edges', '1').status, 2);
    assert.equal(cli('replay', recording, '--max-edges', 'bad').status, 1);
    assert.equal(cli('wallet', 'add', 'fixture', '--address', address(17), '--chain-id', '1', '--home', directory).status, 0);
    assert.equal(cli('replay', recording, '--wallet', 'fixture', '--home', directory).status, 0);
    assert.equal(cli('wallet', 'add', 'wrong', '--address', address(18), '--chain-id', '1', '--home', directory).status, 0);
    assert.equal(cli('replay', recording, '--wallet', 'wrong', '--home', directory).status, 1);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('tare-phase2-'));
    await rm(directory, { recursive: true, force: true });
  }
});

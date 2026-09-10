import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compositionFixture } from './helpers/composition.js';
import { composePosition } from '../packages/service/src/composition.js';
import { SELECTOR } from '../packages/adapters/src/morpho-blue.js';
import { word } from '../packages/sources/src/evm.js';

test('Recipe composition recomputes both sources and retains a scoped, unsigned result', async () => {
  const result = await composePosition(await compositionFixture());
  assert.equal(result.status, 'matched');
  assert.equal(result.resolution.kind, 'complete');
  assert.equal(result.verification.checks.length, 4);
  assert.equal(result.sourceMode, 'recorded-composition');
  assert.equal(result.metric.kind, 'unavailable');
  assert.ok(result.limitations.includes('not-a-fresh-source-check'));
});

test('Graph changes affect the composed answer; outages and unpinned deployments cannot pass', async () => {
  for (const mutation of ['shares', 'missing', 'hash', 'deployment', 'unpinned'] as const) {
    const input = await compositionFixture();
    const shares = input.shareCapture;
    if (mutation === 'shares') {
      shares.graph!.data.accountBalance!.shares = '1';
      input.graphResponse.data!.accountBalance!.shares = '1';
    }
    if (mutation === 'missing') shares.graph = null;
    if (mutation === 'hash') shares.graph!.data._meta.block.hash = null;
    if (mutation === 'deployment') shares.graph!.data._meta.deployment = 'QmWrongDeployment';
    if (mutation === 'unpinned') shares.expectedDeployment = null;
    const result = await composePosition(input);
    assert.equal(result.status, mutation === 'shares' ? 'mismatch' : 'incomplete', mutation);
    assert.equal(result.metric.kind, 'unavailable');
  }
});

test('individually matched captures cannot be joined across different positions, blocks or quantities', async () => {
  for (const mutation of ['owner', 'timestamp', 'amount', 'decimals'] as const) {
    const input = await compositionFixture();
    const shares = input.shareCapture;
    if (mutation === 'owner') input.resolutionCapture.owner = `0x${'1'.repeat(40)}` as typeof shares.owner;
    if (mutation === 'timestamp') shares.rpc.block!.timestamp = '0x1';
    if (mutation === 'amount') {
      shares.graph!.data.accountBalance!.shares = '1';
      input.graphResponse.data!.accountBalance!.shares = '1';
      shares.rpc.calls.find(call => call.data === SELECTOR.balance + word(shares.owner))!.result = `0x${word(1n)}`;
    }
    if (mutation === 'decimals') {
      shares.graph!.data.vault!.shareDecimals = 19;
      input.graphResponse.data!.vault!.shareDecimals = 19;
      shares.rpc.calls.find(call => call.data === SELECTOR.decimals)!.result = `0x${word(19n)}`;
    }
    const result = await composePosition(input);
    assert.equal(result.verification.status, 'matched');
    assert.equal(result.status, 'incomplete');
    assert.ok(result.findings.some(finding => finding.startsWith('position-')));
  }
  const input = await compositionFixture();
  await assert.rejects(composePosition({ ...input, status: 'matched' }));
  input.resolutionCapture.blockConfirmed = false;
  assert.equal((await composePosition(input)).status, 'incomplete');
});

test('direct Graph response is material and partial GraphQL errors are never silently accepted', async () => {
  const input = await compositionFixture();
  input.graphResponse.data!.accountBalance!.shares = '1';
  assert.ok((await composePosition(input)).findings.includes('external-graph-disagreement'));
  const partial = await compositionFixture();
  const result = await composePosition({ ...partial, graphResponse: { ...partial.graphResponse, errors: [{ message: 'SECRET' }] } });
  assert.equal(result.status, 'incomplete');
  assert.ok(result.findings.includes('external-graph-errors'));
  assert.ok(!JSON.stringify(result).includes('SECRET'));
  assert.deepEqual((await composePosition(result.capture)), result);
});

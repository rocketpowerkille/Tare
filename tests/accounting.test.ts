import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod/v4';
import { fixture, replayHandler } from './helpers/morpho.js';
import { withServer, json } from './helpers/http.js';
import { replayAccounting, verifyAccounting } from '../packages/verification/src/accounting.js';
import { accountingCapture } from './helpers/accounting.js';

test('underlying verification compares the exact 56-read allocation set and replays', async () => {
  const capture = await accountingCapture();
  const source = await fixture();
  const handler = replayHandler(source);
  await withServer((body, response, request) => {
    if (typeof body === 'object' && body && 'query' in body) {
      const query = z.object({ variables: z.unknown() }).parse(body);
      assert.deepEqual(query.variables, { block: { hash: source.block!.hash }, vault: source.vault });
      json(response, { data: capture.graph });
    } else handler(body, response, request);
  }, async url => {
    const result = await verifyAccounting({ vault: source.vault, rpcUrl: url, graphUrl: url,
      blockNumber: BigInt(source.block!.number).toString(), expectedDeployment: capture.expectedDeployment! });
    assert.equal(result.status, 'matched');
    assert.equal(result.checks.length, 56);
    assert.deepEqual((await replayAccounting(result.capture)).checks, result.checks);
    assert.equal(result.metric.kind, 'unavailable');
  });
});
test('live accounting anchors unpinned requests to the latest indexed Graph block', async () => {
  const capture = await accountingCapture();
  const source = await fixture();
  const handler = replayHandler(source);
  let graphRequests = 0;
  await withServer((body, response, request) => {
    if (typeof body === 'object' && body && 'query' in body) {
      const query = z.object({ query: z.string(), variables: z.unknown() }).parse(body);
      graphRequests++;
      if (query.query.includes('TareAccountingHead')) {
        assert.deepEqual(query.variables, {});
        json(response, { data: { _meta: capture.graph!._meta } });
      } else {
        assert.deepEqual(query.variables, { block: { hash: source.block!.hash }, vault: source.vault });
        json(response, { data: capture.graph });
      }
    } else handler(body, response, request);
  }, async url => {
    const result = await verifyAccounting({
      vault: source.vault, rpcUrl: url, graphUrl: url, expectedDeployment: capture.expectedDeployment!,
    });
    assert.equal(result.status, 'matched');
    assert.equal(result.checks.length, 56);
    assert.equal(graphRequests, 2);
  });
});
test('underlying comparison detects altered quantities, missing reads and duplicate reads', async () => {
  for (const mutation of ['value', 'missing', 'duplicate'] as const) {
    const capture = await accountingCapture();
    const reads = capture.graph!.accountingState!.reads;
    if (mutation === 'value') reads[2]!.result = `0x${'0'.repeat(64)}`;
    if (mutation === 'missing') reads.pop();
    if (mutation === 'duplicate') reads.push(reads[0]!);
    const result = await replayAccounting(capture);
    assert.equal(result.status, mutation === 'value' ? 'mismatch' : 'incomplete');
  }
});
test('stale entity state, deployment mismatch, reorgs and absent Graph cannot agree', async () => {
  for (const mutation of ['stale', 'deployment', 'reorg', 'missing'] as const) {
    const capture = await accountingCapture();
    if (mutation === 'stale') capture.graph!.accountingState!.timestamp = '1';
    if (mutation === 'deployment') capture.expectedDeployment = 'QmWrongDeployment';
    if (mutation === 'reorg') capture.rpc.confirmed = false;
    if (mutation === 'missing') capture.graph = null;
    const result = await replayAccounting(capture);
    assert.equal(result.status, 'incomplete');
    assert.equal(result.checks.length, 0);
  }
});
test('captured call duplication and cross-block contamination are rejected', async () => {
  const duplicate = await accountingCapture();
  duplicate.rpc.calls.push(duplicate.rpc.calls[0]!);
  await assert.rejects(replayAccounting(duplicate), /Duplicate RPC/);
  const mixed = await accountingCapture();
  mixed.rpc.calls[0]!.blockHash = `0x${'ff'.repeat(32)}`;
  await assert.rejects(replayAccounting(mixed), /block mismatch/);
});

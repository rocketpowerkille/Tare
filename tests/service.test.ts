import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod/v4';
import { TareService } from '../packages/service/src/index.js';
import { NestedCaptureSchema, replayNestedCapture } from '../packages/resolver/src/nested.js';
import { readJsonFile } from '../packages/sources/src/snapshot.js';
import { withServer, json } from './helpers/http.js';

test('configured service pins nested resolution and matches offline accounting without changing evidence labels', async () => {
  const capture = NestedCaptureSchema.parse(await readJsonFile('fixtures/live/ov-usdc-v2.capture.json'));
  const expected = await replayNestedCapture(capture);
  await withServer((body, response) => {
    const call = z.object({ id: z.number(), method: z.string(), params: z.array(z.unknown()) }).parse(body);
    let result: unknown;
    if (call.method === 'eth_chainId') result = '0x1';
    else if (call.method === 'eth_getBlockByNumber') {
      assert.equal(call.params[0], capture.rpc.block!.number);
      result = capture.rpc.block;
    } else {
      assert.equal(call.method, 'eth_call');
      assert.deepEqual(call.params[1], { blockHash: capture.rpc.block!.hash, requireCanonical: true });
      const tx = z.object({ to: z.string(), data: z.string() }).parse(call.params[0]);
      const found = capture.rpc.calls.find(item => item.to === tx.to && item.data === tx.data);
      assert.ok(found);
      result = found.result;
    }
    json(response, { jsonrpc: '2.0', id: call.id, result });
  }, async rpcUrl => {
    const service = new TareService({ rpcUrl });
    const report = await service.run('analyze', { operation: 'resolve-v2', owner: capture.owner,
      vault: capture.vault, blockNumber: BigInt(capture.rpc.block!.number).toString() }) as typeof expected;
    assert.equal(report.sourceMode, 'live-rpc'); // Local HTTP acquisition test, not mainnet acceptance.
    assert.equal(report.status, 'complete');
    assert.deepEqual(report.analysis, expected.analysis);
    assert.deepEqual(report.valuation, expected.valuation);
    assert.deepEqual(report.metric, expected.metric);
  });
});

test('configured verification routes retain provider failures and Graph replay remains offline', async () => {
  const address = `0x${'1'.repeat(40)}`;
  await withServer((_body, response) => { response.writeHead(503); response.end('SECRET provider diagnostic'); }, async rpcUrl => {
    const service = new TareService({ rpcUrl, graphUrl: rpcUrl,
      secondaryRpcUrl: rpcUrl.replace('127.0.0.1', 'localhost'), graphApiKey: 'SECRET' });
    for (const operation of ['verify-shares', 'verify-accounting', 'verify-weth'] as const) {
      const input = { operation, ...(operation !== 'verify-accounting' ? { owner: address } : {}),
        ...(operation !== 'verify-weth' ? { vault: address } : {}) };
      const report = await service.run('analyze', input) as { status: string; capture: unknown; metric: { kind: string } };
      assert.equal(report.status, 'incomplete');
      assert.equal(report.metric.kind, 'unavailable');
      assert.ok(!JSON.stringify(report).includes('SECRET'));
      const replay = await new TareService().run('replay', { operation, capture: report.capture }) as typeof report;
      assert.equal(replay.status, 'incomplete');
      assert.deepEqual(replay.metric, report.metric);
    }
  });
});

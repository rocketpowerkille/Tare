import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { z } from 'zod/v4';
import { CustodyCaptureSchema } from '../packages/verification/src/custody-capture.js';
import { ETHEREUM_WETH, replayCustody, verifyWethCustody } from '../packages/verification/src/custody.js';
import { SELECTOR } from '../packages/adapters/src/morpho-blue.js';
import { word } from '../packages/sources/src/evm.js';
import { withServer, json } from './helpers/http.js';
import { runCli } from './helpers/cli.js';

const path = 'fixtures/live/weth-custody.capture.json';
const fixture = async () => CustodyCaptureSchema.parse(JSON.parse(await readFile(path, 'utf8')));
test('real WETH custody capture produces a scoped 1x, with provider-diversity limitations', async () => {
  const result = await replayCustody(await fixture());
  assert.equal(result.status, 'matched');
  assert.equal(result.metric.kind, 'available');
  if (result.metric.kind === 'available') {
    assert.equal(result.metric.multipleMillionths, '1000000');
    assert.equal(result.metric.numeratorRaw, result.metric.denominatorRaw);
    assert.equal(result.metric.scope, 'weth-wrapper-only');
  }
  assert.ok(result.limitations.includes('provider-independence-not-proven'));
});
test('custody acquisition pins both providers and native balance to the same hash', async () => {
  const capture = await fixture();
  const witness = capture.witnesses[0];
  await withServer((body, response) => {
    const request = z.object({ id: z.number(), method: z.string(), params: z.array(z.unknown()) }).parse(body);
    let result: unknown;
    if (request.method === 'eth_chainId') result = '0x1';
    else if (request.method === 'eth_getBlockByNumber') result = witness.rpc.block;
    else {
      assert.deepEqual(request.params[1], { blockHash: witness.rpc.block!.hash, requireCanonical: true });
      if (request.method === 'eth_getBalance') {
        assert.equal(request.params[0], ETHEREUM_WETH);
        result = witness.balances[0]!.balance;
      } else {
        assert.equal(request.method, 'eth_call');
        const tx = z.object({ to: z.string(), data: z.string() }).parse(request.params[0]);
        const call = witness.rpc.calls.find(call => call.to === tx.to && call.data === tx.data);
        assert.ok(call);
        result = call.result;
      }
    }
    json(response, { jsonrpc: '2.0', id: request.id, result });
  }, async url => {
    // Same local fixture, distinct hostnames solely to exercise acquisition in this test.
    const result = await verifyWethCustody({ owner: capture.owner, rpcUrl: url, secondaryRpcUrl: url.replace('127.0.0.1', 'localhost') });
    assert.equal(result.status, 'matched');
    assert.equal(result.capture.witnesses[0].rpc.calls.length, 5);
    assert.equal(result.capture.witnesses[1].balances.length, 1);
  });
});
test('provider disagreement, custody shortfall, reorg and same-provider evidence block the metric', async () => {
  for (const mutation of ['claim', 'native', 'reorg', 'provider'] as const) {
    const capture = await fixture();
    const second = capture.witnesses[1];
    if (mutation === 'claim') second.rpc.calls.find(call => call.data.startsWith(SELECTOR.balance))!.result = `0x${word(1n)}`;
    if (mutation === 'native') second.balances[0]!.balance = '0x0';
    if (mutation === 'reorg') second.rpc.confirmed = false;
    if (mutation === 'provider') second.providerId = capture.witnesses[0].providerId;
    const result = await replayCustody(capture);
    assert.equal(result.metric.kind, 'unavailable');
    assert.equal(result.status, 'incomplete');
  }
});
test('native evidence rejects mixed block hashes; live same-host URLs cannot fake diversity', async () => {
  const capture = await fixture();
  capture.witnesses[0].balances[0]!.blockHash = `0x${'00'.repeat(32)}`;
  await assert.rejects(replayCustody(capture), /Native balance block mismatch/);
  await assert.rejects(verifyWethCustody({ owner: capture.owner,
    rpcUrl: 'https://example.com/first-key', secondaryRpcUrl: 'https://example.com/second-key' }), /different RPC hostnames/);
});
test('the real custody control replays through the CLI without network access', async () => {
  const result = await runCli(['verify', 'custody-replay', path, '--json']);
  assert.equal(result.code, 0);
  assert.equal(JSON.parse(result.stdout).metric.multipleMillionths, '1000000');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { withServer, json } from './helpers/http.js';
import { fixture, replayHandler } from './helpers/morpho.js';
import { z } from 'zod/v4';
import { PinnedRpc } from '../packages/sources/src/evm.js';
import { MorphoDiscovery } from '../packages/sources/src/morpho.js';
import { postJson, SourceFailure } from '../packages/sources/src/http.js';

const RpcRequest = z.object({ id: z.number(), method: z.string(), params: z.array(z.unknown()) });

test('GraphQL errors reject even apparently useful partial data and never echo provider secrets', async () => {
  await withServer((_body, response) => json(response, { data: { vaultByAddress: {} }, errors: [{ message: 'SECRET_PROVIDER_TOKEN' }] }), async url => {
    await assert.rejects(new MorphoDiscovery(url).vault(`0x${'11'.repeat(20)}`, 1), error => error instanceof SourceFailure && error.code === 'graphql-error' && !error.message.includes('SECRET'));
  });
});
test('GraphQL discovery returns current V1 and V2 positions with asset metadata', async () => {
  const owner = `0x${'11'.repeat(20)}`;
  const asset = { address: `0x${'aa'.repeat(20)}`, symbol: 'WETH', decimals: 18 };
  await withServer((_body, response) => json(response, { data: { userByAddress: {
    vaultPositions: [{ vault: { address: `0x${'22'.repeat(20)}`, name: 'V1', asset, chain: { id: 1 } }, state: { shares: '2', assets: '3' } }],
    vaultV2Positions: [{ vault: { address: `0x${'33'.repeat(20)}`, name: 'V2', asset, chain: { id: 1 } }, shares: '4', assets: '5' }],
  } } }), async url => {
    const result = await new MorphoDiscovery(url).positions({ chainId: 1, owner });
    assert.equal(result.complete, true);
    assert.deepEqual(result.positions.map(position => [position.version, position.asset.symbol]), [['v2', 'WETH'], ['v1', 'WETH']]);
  });
  await withServer((_body, response) => json(response, { data: { userByAddress: { vaultPositions: [], vaultV2Positions: [] } } }), async url => {
    const result = await new MorphoDiscovery(url).positions({ chainId: 1, owner });
    assert.equal(result.complete, true); assert.deepEqual(result.positions, []); assert.equal(result.scope, 'indexed-morpho-v1-and-v2');
  });
});
test('HTTP reader bounds streamed bodies, handles malformed JSON and times out', async () => {
  await withServer((_body, response) => { response.writeHead(200); response.end('x'.repeat(2000)); }, async url => {
    await assert.rejects(postJson(url, {}, 1000, 100), error => error instanceof SourceFailure && error.code === 'oversized');
  });
  await withServer((_body, response) => { response.writeHead(200); response.end('{bad'); }, async url => {
    await assert.rejects(postJson(url, {}, 1000), error => error instanceof SourceFailure && error.code === 'invalid-json');
  });
  await withServer(() => {}, async url => {
    await assert.rejects(postJson(url, {}, 50), error => error instanceof SourceFailure && error.code === 'timeout');
  });
});
test('RPC enforces chain, ID and request budgets', async () => {
  await withServer((body, response) => {
    const call = RpcRequest.parse(body); json(response, { jsonrpc: '2.0', id: call.id, result: '0x2105' });
  }, async url => { await assert.rejects(new PinnedRpc(url).pin(1), /chain/); });
  await withServer((_body, response) => json(response, { jsonrpc: '2.0', id: 999, result: '0x1' }), async url => {
    await assert.rejects(new PinnedRpc(url).pin(1), /mismatched ID/);
  });
  const capture = await fixture();
  await withServer(replayHandler(capture), async url => {
    await assert.rejects(new PinnedRpc(url, 1000, 1).pin(1), error => error instanceof SourceFailure && error.code === 'budget');
    const pinned = new PinnedRpc(url); await pinned.pin(1);
    await assert.rejects(pinned.pin(1), /cannot be reused/);
  });
});

test('RPC records contract code at the pinned canonical block and deduplicates reads', async () => {
  const block = { number: '0x123', hash: `0x${'ab'.repeat(32)}`, timestamp: '0x456' };
  const address = `0x${'11'.repeat(20)}`;
  const methods: string[] = [];
  await withServer((body, response) => {
    const call = RpcRequest.parse(body);
    methods.push(call.method);
    if (call.method === 'eth_chainId') return json(response, { jsonrpc: '2.0', id: call.id, result: '0xaa36a7' });
    if (call.method === 'eth_getBlockByNumber') return json(response, { jsonrpc: '2.0', id: call.id, result: block });
    assert.equal(call.method, 'eth_getCode');
    assert.deepEqual(call.params, [address, { blockHash: block.hash, requireCanonical: true }]);
    return json(response, { jsonrpc: '2.0', id: call.id, result: '0x600A' });
  }, async url => {
    const rpc = new PinnedRpc(url);
    await rpc.pin(11155111);
    assert.equal(await rpc.code(address), '0x600a');
    assert.equal(await rpc.code(address), '0x600a');
    assert.deepEqual(rpc.codes.map(item => ({ address: item.address, code: item.code, blockHash: item.blockHash })), [
      { address, code: '0x600a', blockHash: block.hash },
    ]);
    await rpc.confirm();
  });
  assert.deepEqual(methods, ['eth_chainId', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getBlockByNumber']);
});

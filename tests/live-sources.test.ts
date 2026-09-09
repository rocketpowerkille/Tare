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
test('GraphQL pagination distinguishes scoped absence from truncation and schema drift', async () => {
  const owner = `0x${'11'.repeat(20)}`;
  await withServer((body, response) => {
    const { variables } = z.object({ variables: z.object({ skip: z.number(), first: z.number() }) }).parse(body);
    const { skip, first } = variables;
    const items = Array.from({ length: Math.min(first, 51 - skip) }, (_, i) => ({ user: { address: owner }, vault: { address: `0x${(skip + i + 1).toString(16).padStart(40, '0')}`, name: 'vault', chain: { id: 1 } }, state: { shares: '1' } }));
    json(response, { data: { vaultPositions: { items, pageInfo: { count: items.length, countTotal: 51, skip, limit: first } } } });
  }, async url => {
    const client = new MorphoDiscovery(url);
    const truncated = await client.positions({ chainId: 1, owner, maxPositions: 1 });
    assert.equal(truncated.complete, false); assert.deepEqual(truncated.issues, ['limit']);
    const all = await client.positions({ chainId: 1, owner, maxPositions: 100 });
    assert.equal(all.complete, true); assert.equal(all.positions.length, 51);
  });
  await withServer((_body, response) => json(response, { data: { vaultPositions: { items: [], pageInfo: { count: 0, countTotal: 0, skip: 0, limit: 50 } } } }), async url => {
    const result = await new MorphoDiscovery(url).positions({ chainId: 1, owner });
    assert.equal(result.complete, true); assert.deepEqual(result.positions, []); assert.equal(result.scope, 'indexed-morpho-v1-only');
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

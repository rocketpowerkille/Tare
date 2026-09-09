import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { z } from 'zod/v4';
import { CaptureSchema, LiveReceiptSchema } from '../packages/domain/src/live.js';
import type { LiveCapture } from '../packages/domain/src/live.js';
import { replayLiveCapture, resolveLivePosition } from '../packages/resolver/src/live.js';
import { expectedMarket, SELECTOR, vaultFeeShares } from '../packages/adapters/src/morpho-blue.js';
import { decodeAddress, decodeWords, PinnedRpc, word } from '../packages/sources/src/evm.js';
import { MorphoDiscovery } from '../packages/sources/src/morpho.js';
import { postJson, SourceFailure } from '../packages/sources/src/http.js';

const capturePath = 'fixtures/live/steakhouse-usdc.capture.json';
const fixture = async (): Promise<LiveCapture> => CaptureSchema.parse(JSON.parse(await readFile(capturePath, 'utf8')));
type Handler = (body: unknown, response: ServerResponse, request: IncomingMessage) => void;
async function withServer(handler: Handler, run: (url: string) => Promise<void>) {
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    request.on('end', () => handler(JSON.parse(body) as unknown, response, request));
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
function json(response: ServerResponse, body: unknown) { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); }
const RpcRequest = z.object({ id: z.number(), method: z.string(), params: z.array(z.unknown()) });
function replayHandler(capture: LiveCapture, mutate?: (call: z.infer<typeof RpcRequest>, response: ServerResponse) => boolean): Handler {
  return (body, response) => {
    if (typeof body === 'object' && body !== null && 'query' in body) { json(response, { data: { vaultByAddress: capture.metadata } }); return; }
    const call = RpcRequest.parse(body);
    if (mutate?.(call, response)) return;
    if (call.method === 'eth_chainId') { json(response, { jsonrpc: '2.0', id: call.id, result: '0x1' }); return; }
    if (call.method === 'eth_getBlockByNumber') { json(response, { jsonrpc: '2.0', id: call.id, result: capture.block }); return; }
    assert.equal(call.method, 'eth_call', 'Only read methods may be used');
    assert.deepEqual(call.params[1], { blockHash: capture.block?.hash, requireCanonical: true });
    const tx = z.object({ to: z.string(), data: z.string() }).parse(call.params[0]);
    const found = capture.observations.find(item => item.to === tx.to && item.data === tx.data);
    assert.ok(found, `Unrecorded call ${tx.data}`);
    json(response, { jsonrpc: '2.0', id: call.id, result: found.result });
  };
}
test('real captured position replays with exact contract totals, fee conversion and rounding', async () => {
  const result = await replayLiveCapture(await fixture());
  assert.equal(result.kind, 'complete');
  assert.equal(result.sourceMode, 'recorded-rpc');
  assert.equal(result.markets.length, 12);
  assert.equal(result.vault?.totalAssetsRaw, '67626448434968');
  assert.equal(result.vault?.convertToAssetsRaw, '28728443339809');
  assert.equal(result.unattributedAssetsRaw, '5');
  assert.equal(result.markets.reduce((sum, m) => sum + BigInt(m.vaultAssetsRaw), 0n).toString(), result.vault.totalAssetsRaw);
  assert.equal(result.markets.reduce((sum, m) => sum + BigInt(m.attributedAssetsRaw!), 0n) + 5n, BigInt(result.vault.convertToAssetsRaw));
  assert.equal(result.verification, 'not-independently-verified');
  assert.equal(result.metric.kind, 'unavailable');
});
test('published virtual-share and interest accounting matches independent small examples', () => {
  assert.deepEqual(expectedMarket([1000n, 1000000n, 100n, 100000n, 10n, 100000000000000000n], 100000000000000000n, 11n), { assets: 1010n, shares: 1001980n, borrow: 110n });
  assert.deepEqual(expectedMarket([1000n, 1000000n, 100n, 100000n, 10n, 0n], 0n, 10n), { assets: 1000n, shares: 1000000n, borrow: 100n });
  assert.equal(vaultFeeShares(1000n, 900n, 100000000000000000n, 1000000n, 0n), 10090n);
  assert.throws(() => expectedMarket([0n, 0n, 0n, 0n, 20n, 0n], 0n, 10n));
  assert.throws(() => expectedMarket([2n ** 128n, 0n, 0n, 0n, 0n, 0n], 0n, 10n));
});
test('static ABI decoding rejects truncation, excess data, invalid addresses and uint overflows', () => {
  assert.deepEqual(decodeWords(`0x${word(3n)}${word(4n)}`, 2), [3n, 4n]);
  assert.throws(() => decodeWords('0x', 1));
  assert.throws(() => decodeWords(`0x${word(1n)}${word(2n)}`, 1));
  assert.throws(() => decodeAddress(`0x${word(2n ** 160n)}`));
  assert.throws(() => word(2n ** 256n)); assert.throws(() => word(-1n));
});
test('source reads use the capture block hash and reconstruct the complete live receipt', async () => {
  const capture = await fixture();
  await withServer(replayHandler(capture), async url => {
    const result = await resolveLivePosition({ chainId: 1, owner: capture.owner, vault: capture.vault, rpcUrl: url, graphqlUrl: url });
    assert.equal(result.kind, 'complete');
    assert.equal(result.vault?.convertToAssetsRaw, '28728443339809');
    assert.ok(result.capture.observations.every(item => item.blockHash === capture.block?.hash));
  });
});
test('reorg confirmation invalidates attributed outputs', async () => {
  const capture = await fixture(); let blocks = 0;
  await withServer(replayHandler(capture, (call, response) => {
    if (call.method === 'eth_getBlockByNumber' && ++blocks === 2) {
      json(response, { jsonrpc: '2.0', id: call.id, result: { ...capture.block, hash: `0x${'cd'.repeat(32)}` } }); return true;
    }
    return false;
  }), async url => {
    const result = await resolveLivePosition({ chainId: 1, owner: capture.owner, vault: capture.vault, rpcUrl: url, graphqlUrl: url });
    assert.equal(result.kind, 'partial'); assert.equal(result.capture.blockConfirmed, false);
    assert.ok(result.markets.every(market => market.attributedAssetsRaw === null));
    assert.ok(result.findings.some(finding => finding.code === 'reorg'));
  });
});
test('missing market calls, budget limits and unsupported assets remain partial', async () => {
  const missing = await fixture();
  missing.observations = missing.observations.filter(item => !item.data.startsWith(SELECTOR.market));
  assert.equal((await replayLiveCapture(missing)).kind, 'partial');
  const bounded = await replayLiveCapture(await fixture(), { maxMarkets: 1 });
  assert.equal(bounded.kind, 'partial'); assert.equal(bounded.markets.length, 1);
  assert.ok(bounded.findings.some(finding => finding.code === 'market-limit'));
  const wrong = await fixture(); const asset = wrong.observations.find(item => item.to === wrong.vault && item.data === SELECTOR.asset)!;
  asset.result = `0x${word(1n)}`;
  assert.equal((await replayLiveCapture(wrong)).kind, 'partial');
});
test('accounting mismatches cannot emit supported attributed amounts', async () => {
  const capture = await fixture();
  const total = capture.observations.find(item => item.to === capture.vault && item.data === SELECTOR.assets)!;
  total.result = `0x${word(123n)}`;
  const result = await replayLiveCapture(capture);
  assert.equal(result.kind, 'partial');
  assert.ok(result.findings.some(finding => finding.code === 'accounting-mismatch'));
  assert.ok(result.markets.every(market => market.attributedAssetsRaw === null));
});
test('capture boundaries reject conflicting calls, block context and fabricated verification', async () => {
  const capture = await fixture();
  assert.equal(CaptureSchema.safeParse({ ...capture, observations: [...capture.observations, capture.observations[0]] }).success, false);
  capture.observations[0]!.blockHash = `0x${'cd'.repeat(32)}`;
  assert.equal(CaptureSchema.safeParse(capture).success, false);
  const receipt = await replayLiveCapture(await fixture());
  assert.equal(LiveReceiptSchema.safeParse({ ...receipt, verification: 'verified' }).success, false);
  assert.equal(LiveReceiptSchema.safeParse({ ...receipt, markets: [] }).success, false);
  assert.equal(LiveReceiptSchema.safeParse({ ...receipt, captureDigest: `sha256:${'0'.repeat(64)}` }).success, false);
  assert.equal(LiveReceiptSchema.safeParse({ ...receipt, unattributedAssetsRaw: '0' }).success, false);
  assert.equal(CaptureSchema.safeParse({ ...receipt.capture, failedCalls: [{ to: receipt.owner, data: '0x', blockHash: `0x${'cd'.repeat(32)}`, code: 'timeout' }] }).success, false);
});
test('failed read batches finish collecting evidence before receipt finalization', async () => {
  const capture = await fixture();
  await withServer(replayHandler(capture, (call, response) => {
    if (call.method !== 'eth_call') return false;
    const tx = z.object({ to: z.string(), data: z.string() }).parse(call.params[0]);
    if (tx.data === SELECTOR.morpho) {
      json(response, { jsonrpc: '2.0', id: call.id, error: { code: -32000, message: 'private provider detail' } }); return true;
    }
    if (tx.data === SELECTOR.asset) {
      const recorded = capture.observations.find(item => item.to === tx.to && item.data === tx.data)!;
      setTimeout(() => json(response, { jsonrpc: '2.0', id: call.id, result: recorded.result }), 75); return true;
    }
    return false;
  }), async url => {
    const result = await resolveLivePosition({ chainId: 1, owner: capture.owner, vault: capture.vault, rpcUrl: url, graphqlUrl: url });
    assert.equal(result.kind, 'partial'); assert.equal(result.capture.observations.length, 1);
    assert.equal(result.capture.failedCalls.length, 1);
    assert.equal((await replayLiveCapture(result.capture)).kind, 'partial');
  });
});
test('source outages and malformed call data preserve explicit partial receipts', async () => {
  const capture = await fixture();
  await withServer((_body, response) => { response.writeHead(503); response.end(); }, async url => {
    const result = await resolveLivePosition({ chainId: 1, owner: capture.owner, vault: capture.vault, rpcUrl: url, graphqlUrl: url });
    assert.equal(result.kind, 'partial'); assert.equal(result.capture.block, null);
    assert.ok(result.findings.some(f => f.stage === 'discovery' && f.code === 'http'));
  });
  await withServer(replayHandler(capture, (call, response) => {
    if (call.method === 'eth_call') {
      const tx = z.object({ data: z.string() }).parse(call.params[0]);
      if (tx.data.startsWith(SELECTOR.market)) {
        json(response, { jsonrpc: '2.0', id: call.id, result: 'not hex' }); return true;
      }
    }
    return false;
  }), async url => {
    const result = await resolveLivePosition({ chainId: 1, owner: capture.owner, vault: capture.vault, rpcUrl: url, graphqlUrl: url });
    assert.equal(result.kind, 'partial'); assert.equal(result.markets.length, 0);
    assert.equal(result.capture.failedCalls.length, 12);
    assert.equal((await replayLiveCapture(result.capture)).kind, 'partial');
  });
});
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
function cli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/apps/cli/src/main.js', ...args], { timeout: 30000 });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
  });
}
test('CLI live path and offline replay export validated receipts without overwriting', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tare-phase3-'));
  try {
    const capture = await fixture();
    await withServer(replayHandler(capture), async url => {
      const out = join(directory, 'receipt.json'); const saved = join(directory, 'capture.json');
      const args = ['live', 'resolve', '--address', capture.owner, '--vault', capture.vault, '--rpc-url', url, '--graphql-url', url, '--json', '--out', out, '--capture-out', saved];
      const result = await cli(args);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(LiveReceiptSchema.parse(JSON.parse(result.stdout)).kind, 'complete');
      const replay = await cli(['live', 'replay', saved, '--json']);
      assert.equal(replay.code, 0, replay.stderr);
      assert.equal(LiveReceiptSchema.parse(JSON.parse(replay.stdout)).sourceMode, 'recorded-rpc');
      assert.equal((await cli(args)).code, 1);
    });
    assert.equal((await cli(['live', 'replay', capturePath, '--max-markets', '1', '--json'])).code, 2);
    assert.equal((await cli(['live', 'resolve', '--chain-id', '8453'])).code, 1);
    assert.equal((await cli(['live', 'replay', capturePath, '--rpc-url', 'http://example.invalid'])).code, 1);
    let requests = 0;
    await withServer((_body, response) => { requests++; json(response, {}); }, async url => {
      const invalid = await cli(['live', 'example', '--graphql-url', url, '--rpc-url', url, '--max-calls', '1001']);
      assert.equal(invalid.code, 1); assert.equal(requests, 0, 'Invalid options must fail before discovery');
    });
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith('tare-phase3-'));
    await rm(directory, { recursive: true, force: true });
  }
});

import { withServer as server, json } from './helpers/http.js';
import type { Handler } from './helpers/http.js';
import { runCli as cli } from './helpers/cli.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { z } from 'zod/v4';
import { GraphShareClient, GraphShareDataSchema } from '../packages/sources/src/the-graph.js';
import { SourceFailure } from '../packages/sources/src/http.js';
import { SELECTOR } from '../packages/adapters/src/morpho-blue.js';
import { word } from '../packages/sources/src/evm.js';
import { replayShareVerification, ShareVerificationReportSchema, verifyShares } from '../packages/verification/src/shares.js';

// Authored local test vectors, never presented as live Graph evidence.
const owner = `0x${'11'.repeat(20)}`; const vault = `0x${'22'.repeat(20)}`; const asset = `0x${'33'.repeat(20)}`;
const block = { number: '0x10', hash: `0x${'ab'.repeat(32)}`, timestamp: '0x100' };
const deployment = 'Qm' + 'a'.repeat(44);
function graphData(): z.infer<typeof GraphShareDataSchema> {
  return GraphShareDataSchema.parse({ _meta: { block: { number: 16, hash: block.hash }, deployment, hasIndexingErrors: false },
    vault: { id: vault, chainId: 1, asset, shareDecimals: 18, totalShares: '1000', indexedFromBlock: '0', lastUpdateBlock: '12' },
    accountBalance: { id: `${vault}-${owner}`, account: owner, vault: { id: vault }, shares: '100', lastUpdateBlock: '12' } });
}
const RpcRequest = z.object({ id: z.number(), method: z.string(), params: z.array(z.unknown()) });
function handler(data = graphData(), mutate?: (call: z.infer<typeof RpcRequest>, response: ServerResponse) => boolean): Handler {
  return (body, response) => {
    if (typeof body === 'object' && body !== null && 'query' in body) {
      const query = z.object({ query: z.string(), variables: z.unknown() }).parse(body);
      assert.deepEqual(query.variables, { block: { number: 16 }, vault, balance: `${vault}-${owner}` });
      assert.equal((query.query.match(/block:\$block/g) ?? []).length, 3);
      json(response, { data }); return;
    }
    const call = RpcRequest.parse(body); if (mutate?.(call, response)) return;
    let result: unknown;
    if (call.method === 'eth_chainId') result = '0x1';
    else if (call.method === 'eth_getBlockByNumber') result = block;
    else {
      assert.equal(call.method, 'eth_call');
      assert.deepEqual(call.params[1], { blockHash: block.hash, requireCanonical: true });
      const tx = z.object({ to: z.string(), data: z.string() }).parse(call.params[0]); assert.equal(tx.to, vault);
      const values: Record<string, bigint | string> = { [SELECTOR.asset]: asset, [SELECTOR.decimals]: 18n, [SELECTOR.supply]: 1000n, [SELECTOR.balance + word(owner)]: 100n };
      assert.ok(values[tx.data] !== undefined); result = `0x${word(values[tx.data]!)}`;
    }
    json(response, { jsonrpc: '2.0', id: call.id, result });
  };
}
const options = (url: string) => ({ owner, vault, rpcUrl: url, graphUrl: url, blockNumber: '16', expectedDeployment: deployment });
test('phase four compares actual pinned RPC calls with all four indexed share fields and replays evidence', async () => {
  await server(handler(), async url => {
    const result = await verifyShares(options(url));
    assert.equal(result.status, 'matched'); assert.equal(result.checks.length, 4);
    assert.equal(result.capture.rpc.health.requests, 7); assert.equal(result.capture.graphHealth.requests, 1);
    assert.equal(result.metric.kind, 'unavailable');
    const replay = replayShareVerification(result.capture);
    assert.deepEqual(replay.checks, result.checks); assert.equal(replay.sourceMode, 'recorded-graph-rpc');
    assert.equal(ShareVerificationReportSchema.safeParse({ ...result, checks: [], status: 'matched' }).success, false);
    assert.equal(ShareVerificationReportSchema.safeParse({ ...result, captureDigest: `sha256:${'0'.repeat(64)}` }).success, false);
  });
});
test('share disagreements preserve exact values and do not produce a verified metric', async () => {
  const data = graphData(); data.accountBalance!.shares = '101';
  await server(handler(data), async url => {
    const result = await verifyShares(options(url));
    assert.equal(result.status, 'mismatch'); assert.equal(result.checks[3]?.rpc, '100'); assert.equal(result.checks[3]?.graph, '101');
    assert.equal(result.verification, 'share-ledger-cross-check-only');
  });
});
test('missing owners remain unknown instead of being imputed as zero shares', async () => {
  const data = graphData(); data.accountBalance = null;
  await server(handler(data), async url => {
    const result = await verifyShares(options(url)); assert.equal(result.status, 'incomplete'); assert.equal(result.checks.length, 0);
    assert.ok(result.findings.some(f => f.code === 'missing-entity'));
  });
});
test('wrong block hashes, indexing errors, deployment drift, identities and future state reject comparison', async () => {
  const mutations: [string, (data: ReturnType<typeof graphData>) => void][] = [
    ['block-mismatch', data => { data._meta.block.hash = `0x${'cd'.repeat(32)}`; }],
    ['block-mismatch', data => { data._meta.block.number = 15; }],
    ['block-mismatch', data => { data._meta.block.hash = null; }],
    ['indexing-errors', data => { data._meta.hasIndexingErrors = true; }],
    ['deployment-mismatch', data => { data._meta.deployment = 'Qm' + 'b'.repeat(44); }],
    ['vault-identity-mismatch', data => { data.vault!.chainId = 8453; }],
    ['owner-identity-mismatch', data => { data.accountBalance!.id = 'wrong-owner'; }],
    ['invalid-history', data => { data.accountBalance!.lastUpdateBlock = '17'; }],
  ];
  for (const [code, mutate] of mutations) {
    const data = graphData(); mutate(data);
    await server(handler(data), async url => {
      const result = await verifyShares(options(url));
      assert.equal(result.status, 'incomplete', code); assert.equal(result.checks.length, 0);
      assert.ok(result.findings.some(f => f.code === code), code);
    });
  }
});
test('reorgs, chain mismatches and failed RPC calls cannot yield matched shares', async () => {
  let blocks = 0;
  await server(handler(graphData(), (call, response) => {
    if (call.method === 'eth_getBlockByNumber' && ++blocks === 2) { json(response, { jsonrpc: '2.0', id: call.id, result: { ...block, hash: `0x${'cd'.repeat(32)}` } }); return true; }
    return false;
  }), async url => {
    const result = await verifyShares(options(url)); assert.equal(result.status, 'incomplete'); assert.equal(result.checks.length, 0);
    assert.equal(result.capture.rpc.confirmed, false);
  });
  await server(handler(graphData(), (call, response) => {
    if (call.method === 'eth_call') { json(response, { jsonrpc: '2.0', id: call.id, error: { code: -32000, message: 'secret' } }); return true; }
    return false;
  }), async url => {
    const result = await verifyShares(options(url)); assert.equal(result.status, 'incomplete');
    assert.equal(result.capture.rpc.failedCalls.length, 4);
  });
  await server(handler(graphData(), (call, response) => {
    if (call.method === 'eth_chainId') { json(response, { jsonrpc: '2.0', id: call.id, result: '0x2' }); return true; }
    return false;
  }), async url => {
    const result = await verifyShares(options(url)); assert.equal(result.status, 'incomplete'); assert.equal(result.capture.graphHealth.requests, 0);
  });
});
test('Graph authentication stays in headers and GraphQL errors reject partial data without disclosing tokens', async () => {
  await server((body, response, request) => {
    assert.equal(request.headers.authorization, 'Bearer test-secret'); assert.ok(!JSON.stringify(body).includes('test-secret'));
    json(response, { data: graphData(), errors: [{ message: 'test-secret in provider response' }] });
  }, async url => {
    await assert.rejects(new GraphShareClient(url, 1000, 'test-secret').readAt(vault, owner, 16), error => error instanceof SourceFailure && error.code === 'graphql-error' && !error.message.includes('test-secret'));
  });
  assert.throws(() => new GraphShareClient('http://example.com', 1000, 'test-secret'), /HTTPS/);
});
test('Graph schema drift and HTTP failures are reported as incomplete verification', async () => {
  for (const mode of ['schema', 'http']) {
    await server((body, response, request) => {
      if (typeof body === 'object' && body !== null && 'query' in body) {
        if (mode === 'schema') json(response, { data: { _meta: {} } });
        else { response.writeHead(503); response.end(); }
      } else handler()(body, response, request);
    }, async url => {
      const result = await verifyShares(options(url)); assert.equal(result.status, 'incomplete');
      assert.equal(result.capture.graphHealth.failures, 1);
    });
  }
});
test('verification CLI exports and replays reports, refuses overwrite, and rejects unsupported options', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tare-phase4-'));
  try {
    await server(handler(), async url => {
      const out = join(directory, 'report.json');
      const args = ['verify', 'shares', '--address', owner, '--vault', vault, '--rpc-url', url, '--graph-url', url, '--graph-deployment', deployment, '--block-number', '16', '--out', out, '--json'];
      const result = await cli(args); assert.equal(result.code, 0, result.stderr);
      assert.equal(ShareVerificationReportSchema.parse(JSON.parse(await readFile(out, 'utf8'))).status, 'matched');
      const replay = await cli(['verify', 'replay', out, '--json']); assert.equal(replay.code, 0, replay.stderr);
      assert.equal(JSON.parse(replay.stdout).sourceMode, 'recorded-graph-rpc');
      assert.equal((await cli(args)).code, 1);
    });
    const mismatch = graphData(); mismatch.vault!.totalShares = '1001';
    await server(handler(mismatch), async url => {
      assert.equal((await cli(['verify', 'shares', '--address', owner, '--vault', vault, '--rpc-url', url, '--graph-url', url])).code, 2);
    });
    assert.equal((await cli(['verify', 'shares', '--max-markets', '2'])).code, 1);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith('tare-phase4-'));
    await rm(directory, { recursive: true, force: true });
  }
});

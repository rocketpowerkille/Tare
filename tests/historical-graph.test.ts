import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod/v4';
import { AddressSchema } from '../packages/domain/src/index.js';
import { accountingCapture } from './helpers/accounting.js';
import { compositionFixture } from './helpers/composition.js';
import { fixture, replayHandler } from './helpers/morpho.js';
import { json, withServer } from './helpers/http.js';
import { HistoricalGraphCaptureSchema, replayHistoricalGraph, verifyHistoricalGraph } from '../packages/verification/src/historical-graph.js';
import { TareService, configFromEnv } from '../packages/service/src/index.js';
import { compactEvidenceReport } from '../packages/receipts/src/compact.js';

// Authored historical HTTP vector. Does not establish hosted Graph acceptance.
async function historicalCapture() {
  const accounting = await accountingCapture();
  const { shareCapture: shares } = await compositionFixture();
  accounting.expectedDeployment = shares.expectedDeployment;
  accounting.graph!._meta.deployment = shares.expectedDeployment!;
  const height = 25940000;
  for (const rpc of [shares.rpc, accounting.rpc]) rpc.block!.number = `0x${height.toString(16)}`;
  accounting.graph!._meta.block.number = height;
  accounting.graph!.accountingState!.blockNumber = String(height);
  shares.graph!.requestedBlock = height;
  shares.graph!.data._meta.block.number = height;
  shares.graph!.data.vault!.indexedFromBlock = '18928285';
  shares.graph!.data.vault!.lastUpdateBlock = String(height);
  shares.graph!.data.accountBalance!.lastUpdateBlock = String(height);
  return HistoricalGraphCaptureSchema.parse({ captureVersion: 1, scope: 'historical-graph-verification',
    owner: shares.owner, accounting, shares });
}

test('historical replay joins 4 share and 56 accounting checks with explicit historical scope', async () => {
  const result = await replayHistoricalGraph(await historicalCapture());
  assert.equal(result.status, 'matched');
  assert.equal(result.shares!.checks.length, 4);
  assert.equal(result.accounting.checks.length, 56);
  assert.equal(result.checkedBlock, '25940000');
  assert.ok(result.checkedAt?.endsWith('Z'));
  assert.equal(result.sourceMode, 'recorded-historical-graph-rpc');
  assert.equal(result.coverage.currentStateVerified, false);
  assert.equal(result.coverage.executable, false);
  const compact = compactEvidenceReport(result);
  assert.equal(JSON.stringify(compact).includes('"capture":'), false);
  assert.deepEqual(compact.coverage, result.coverage);
});

test('historical join rejects identity, block, deployment, coverage and indexing gaps', async () => {
  for (const mutation of ['owner', 'block', 'deployment', 'unpinned', 'history', 'indexing', 'missing', 'unconfirmed', 'accounting-start'] as const) {
    const capture = await historicalCapture();
    if (mutation === 'owner') capture.owner = AddressSchema.parse(`0x${'1'.repeat(40)}`);
    if (mutation === 'block') capture.shares!.rpc.block!.timestamp = '0x1';
    if (mutation === 'deployment') capture.shares!.expectedDeployment = 'QmWrongDeployment';
    if (mutation === 'unpinned') capture.accounting.expectedDeployment = null;
    if (mutation === 'history') capture.shares!.graph!.data.vault!.indexedFromBlock = '20000000';
    if (mutation === 'indexing') capture.accounting.graph!._meta.hasIndexingErrors = true;
    if (mutation === 'missing') capture.shares = null;
    if (mutation === 'unconfirmed') capture.accounting.rpc.confirmed = false;
    if (mutation === 'accounting-start') capture.accounting.rpc.block!.number = '0x1';
    assert.equal((await replayHistoricalGraph(capture)).status, 'incomplete', mutation);
  }
});

test('historical replay preserves mismatches and recomputes altered share values', async () => {
  const capture = await historicalCapture();
  capture.shares!.graph!.data.accountBalance!.shares = '0';
  const report = await replayHistoricalGraph(capture);
  assert.equal(report.status, 'mismatch');
  assert.ok(report.shares!.checks.some(check => check.field === 'owner-shares' && check.status === 'mismatch'));
});

test('individually matched sources cannot disagree on shared RPC readings', async () => {
  const capture = await historicalCapture();
  const supply = capture.shares!.rpc.calls.find(call => call.data === '0x18160ddd')!;
  supply.result = `0x${(BigInt(supply.result) + 1n).toString(16).padStart(64, '0')}`;
  capture.shares!.graph!.data.vault!.totalShares = BigInt(supply.result).toString();
  const result = await replayHistoricalGraph(capture);
  assert.equal(result.shares!.status, 'matched');
  assert.equal(result.accounting.status, 'matched');
  assert.equal(result.status, 'incomplete');
  assert.ok(result.findings.includes('shared-rpc-read-disagreement'));
});

test('service uses the separate historical endpoint and pins both checks to its indexed head', async () => {
  const capture = await historicalCapture();
  const source = await fixture();
  source.block = capture.accounting.rpc.block;
  const handler = replayHandler(source, (call, response) => {
    if (call.method === 'eth_getBlockByNumber') assert.notEqual(call.params[0], 'latest');
    if (call.method !== 'eth_call') return false;
    const tx = z.object({ to: z.string(), data: z.string() }).parse(call.params[0]);
    const found = capture.shares!.rpc.calls.find(item => item.to === tx.to && item.data === tx.data);
    if (!found) return false;
    assert.deepEqual(call.params[1], { blockHash: source.block!.hash, requireCanonical: true });
    json(response, { jsonrpc: '2.0', id: call.id, result: found.result });
    return true;
  });
  const queries: string[] = [];
  await withServer((body, response, request) => {
    assert.notEqual(request.url, '/recent', 'Historical check must not query the recent-only deployment');
    if (typeof body === 'object' && body && 'query' in body) {
      const query = z.object({ query: z.string(), variables: z.record(z.string(), z.unknown()) }).parse(body);
      queries.push(query.query);
      if (query.query.includes('TareAccountingHead')) json(response, { data: { _meta: capture.accounting.graph!._meta } });
      else {
        assert.deepEqual(query.variables.block, { hash: source.block!.hash });
        json(response, { data: query.query.includes('TareShares') ? capture.shares!.graph!.data : capture.accounting.graph });
      }
    } else handler(body, response, request);
  }, async url => {
    const service = new TareService({ rpcUrl: url, graphUrl: `${url}/recent`,
      historicalGraphUrl: url, historicalGraphDeployment: capture.accounting.expectedDeployment! });
    const result = await service.run('analyze', { operation: 'verify-historical-graph', owner: capture.owner,
      vault: capture.accounting.vault }) as Awaited<ReturnType<typeof verifyHistoricalGraph>>;
    assert.equal(result.status, 'matched');
    assert.equal(result.checkedBlock, '25940000');
    assert.equal(result.sourceMode, 'live-historical-graph-rpc');
    assert.equal(queries.length, 3);
    const replay = await new TareService().run('replay', { operation: 'verify-historical-graph', capture: result.capture }) as typeof result;
    assert.equal(replay.status, 'matched');
    assert.equal(replay.sourceMode, 'recorded-historical-graph-rpc');
    assert.equal(replay.captureDigest, result.captureDigest);
  });
});

test('missing provider history is incomplete without secrets or a latest-block fallback', async () => {
  const capture = await historicalCapture();
  await withServer((_body, response) => { response.writeHead(503); response.end('SECRET'); }, async url => {
    const result = await verifyHistoricalGraph({ owner: capture.owner, vault: capture.accounting.vault,
      rpcUrl: url, graphUrl: url, expectedDeployment: capture.accounting.expectedDeployment! });
    assert.equal(result.status, 'incomplete');
    assert.equal(result.shares, null);
    assert.equal(JSON.stringify(result).includes('SECRET'), false);
  });
  assert.equal(new TareService({ rpcUrl: 'https://example.com', historicalGraphUrl: 'https://example.com' }).capabilities().live['verify-historical-graph'], false);
  const config = configFromEnv({ TARE_GRAPH_URL: 'https://recent.example', TARE_GRAPH_HISTORICAL_URL: 'https://history.example',
    TARE_GRAPH_HISTORICAL_DEPLOYMENT: 'QmHistoricalTestOnly' });
  assert.equal(config.graphUrl, 'https://recent.example');
  assert.equal(config.historicalGraphUrl, 'https://history.example');
});

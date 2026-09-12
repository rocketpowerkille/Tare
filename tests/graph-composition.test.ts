import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod/v4';
import { SELECTOR } from '../packages/adapters/src/morpho-blue.js';
import { decodeWords, word } from '../packages/sources/src/evm.js';
import { RecordedReader } from '../packages/sources/src/recorded.js';
import { readAccounting } from '../packages/adapters/src/accounting-reads.js';
import { replayGraphComposition, verifyGraphComposition } from '../packages/verification/src/graph-composition.js';
import { fixture, replayHandler } from './helpers/morpho.js';
import { json, withServer } from './helpers/http.js';

test('Graph composition joins Token API and Studio accounting with same-block RPC checks', async () => {
  const source = await fixture();
  const rpcEvidence = { block: source.block, confirmed: true, calls: source.observations, failedCalls: [] };
  const reads = await readAccounting(new RecordedReader(rpcEvidence), source.vault);
  const ownerBalanceCall = source.observations.find(call => call.to === source.vault
    && call.data === SELECTOR.balance + word(source.owner));
  assert.ok(ownerBalanceCall && source.block);
  const amount = decodeWords(ownerBalanceCall.result, 1)[0]!.toString();
  const decimals = 18;
  const deployment = 'QmGraphCompositionFixture';
  const graphData = {
    _meta: { block: { number: Number(BigInt(source.block.number)), hash: source.block.hash },
      deployment, hasIndexingErrors: false },
    accountingState: { id: source.vault, chainId: 1, blockNumber: BigInt(source.block.number).toString(),
      blockHash: source.block.hash, timestamp: BigInt(source.block.timestamp).toString(), reads },
  };
  const rpcHandler = replayHandler(source, (call, response) => {
    if (call.method !== 'eth_call') return false;
    const tx = z.object({ to: z.string(), data: z.string() }).parse(call.params[0]);
    if (tx.to !== source.vault || tx.data !== SELECTOR.decimals) return false;
    json(response, { jsonrpc: '2.0', id: call.id, result: `0x${word(18n)}` });
    return true;
  });
  await withServer((body, response, request) => {
    if (request.method === 'GET') {
      assert.equal(request.headers.authorization, 'Bearer graph-market-secret');
      const url = new URL(request.url!, 'http://fixture.local');
      assert.equal(url.pathname, '/v1/evm/balances');
      assert.equal(url.searchParams.get('address'), source.owner);
      assert.equal(url.searchParams.get('contract'), source.vault);
      assert.equal(url.searchParams.get('include_null_balances'), 'true');
      json(response, { data: [{ address: source.owner, contract: source.vault, amount, decimals,
        name: 'Steakhouse USDC', symbol: 'steakUSDC', last_update_block_num: Number(BigInt(source.block!.number)), network: 'mainnet' }] });
      return;
    }
    if (typeof body === 'object' && body && 'query' in body) {
      const query = z.object({ query: z.string() }).parse(body);
      json(response, { data: query.query.includes('TareAccountingHead') ? { _meta: graphData._meta } : graphData });
      return;
    }
    rpcHandler(body, response, request);
  }, async url => {
    const report = await verifyGraphComposition({ owner: source.owner, vault: source.vault,
      rpcUrl: url, graphUrl: url, tokenApiUrl: url, expectedDeployment: deployment }, 'graph-market-secret');
    assert.equal(report.status, 'matched');
    assert.equal(report.products.length, 2);
    assert.equal(report.checks.tokenApiAmountRaw, amount);
    assert.equal(report.checks.rpcAmountRaw, amount);
    assert.equal(report.checks.accountingReads, 56);
    assert.equal(report.checks.accountingApplicable, true);
    assert.equal(report.verification, 'two-live-graph-products-with-rpc-cross-check');
    const replay = await replayGraphComposition(report.capture);
    assert.equal(replay.status, 'matched');
    report.capture.tokenApi!.balance!.amount = (BigInt(amount) + 1n).toString();
    assert.equal((await replayGraphComposition(report.capture)).status, 'mismatch');
    report.capture.tokenApi!.balance!.amount = amount;
    report.capture.tokenApi!.balance!.decimals = null;
    const missingDecimals = await replayGraphComposition(report.capture);
    assert.equal(missingDecimals.status, 'incomplete');
    assert.deepEqual(missingDecimals.findings, ['token-api-decimals-unavailable']);
  });
});

test('Graph composition limits Studio accounting claims to its configured vault', async () => {
  const source = await fixture();
  const rpcEvidence = { block: source.block, confirmed: true, calls: source.observations, failedCalls: [] };
  const reads = await readAccounting(new RecordedReader(rpcEvidence), source.vault);
  const ownerBalanceCall = source.observations.find(call => call.to === source.vault
    && call.data === SELECTOR.balance + word(source.owner));
  assert.ok(ownerBalanceCall && source.block);
  const amount = decodeWords(ownerBalanceCall.result, 1)[0]!.toString();
  const otherVault = '0x2371e134e3455e0593363cbf89d3b6cf53740618';
  const calls = [
    { ...ownerBalanceCall, to: otherVault },
    { ...ownerBalanceCall, id: 'rpc-graph-decimals', to: otherVault,
      data: SELECTOR.decimals, result: `0x${word(18n)}` },
  ];
  const capture = {
    captureVersion: 1 as const,
    scope: 'graph-product-composition' as const,
    chainId: 1 as const,
    owner: source.owner,
    vault: otherVault,
    capturedAt: new Date().toISOString(),
    block: { number: BigInt(source.block.number).toString(), hash: source.block.hash },
    tokenApi: {
      source: 'the-graph-token-api' as const,
      schema: 'evm-wallet-balance-v1' as const,
      observedAt: new Date().toISOString(),
      network: 'mainnet', owner: source.owner, contract: otherVault,
      balance: { address: source.owner, contract: otherVault, amount, decimals: 18,
        name: 'Gauntlet WETH Prime', symbol: 'gtWETH',
        last_update_block_num: Number(BigInt(source.block.number)), network: 'mainnet' },
    },
    tokenApiFailure: null,
    accounting: {
      captureVersion: 1 as const, scope: 'morpho-v1-accounting' as const, chainId: 1 as const,
      vault: source.vault, capturedAt: new Date().toISOString(), expectedDeployment: null,
      rpc: rpcEvidence,
      graph: { _meta: { block: { number: Number(BigInt(source.block.number)), hash: source.block.hash },
        deployment: 'QmScopedAccountingFixture', hasIndexingErrors: false },
      accountingState: { id: source.vault, chainId: 1, blockNumber: BigInt(source.block.number).toString(),
        blockHash: source.block.hash, timestamp: BigInt(source.block.timestamp).toString(), reads } },
      failures: [],
    },
    shareRpc: { block: source.block, confirmed: true, calls, failedCalls: [] },
    shareRpcFailure: null,
  };
  const report = await replayGraphComposition(capture);
  assert.equal(report.status, 'matched');
  assert.equal(report.checks.accountingApplicable, false);
  assert.equal(report.verification, 'token-api-with-rpc-cross-check');
  assert.deepEqual(report.findings, []);
  assert.equal(report.products[1]?.applicable, false);
});

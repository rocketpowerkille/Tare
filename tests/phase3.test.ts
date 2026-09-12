import test from 'node:test';
import assert from 'node:assert/strict';
import { withServer, json } from './helpers/http.js';
import { fixture, replayHandler } from './helpers/morpho.js';
import { z } from 'zod/v4';
import { CaptureSchema, LiveReceiptSchema } from '../packages/domain/src/live.js';
import { replayLiveCapture, resolveLivePosition } from '../packages/resolver/src/live.js';
import { expectedMarket, SELECTOR, vaultFeeShares } from '../packages/adapters/src/morpho-blue.js';
import { decodeAddress, decodeWords, word } from '../packages/sources/src/evm.js';
import { AddressSchema } from '../packages/domain/src/index.js';

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
test('MetaMorpho V1 analysis supports WETH and preserves its 18 decimals', async () => {
  const capture = await fixture();
  const weth = AddressSchema.parse('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
  capture.metadata!.asset = { address: weth, symbol: 'WETH', decimals: 18 };
  capture.observations.find(item => item.to === capture.vault && item.data === SELECTOR.asset)!.result = `0x${word(weth)}`;
  const decimals = capture.observations.find(item => item.data === SELECTOR.decimals)!;
  decimals.to = weth; decimals.result = `0x${word(18n)}`;
  capture.observations.find(item => item.to === capture.vault && item.data === SELECTOR.offset)!.result = `0x${word(0n)}`;
  for (const item of capture.observations.filter(item => item.data.startsWith(SELECTOR.params))) {
    item.result = `0x${word(weth)}${item.result.slice(66)}`;
  }
  const result = await replayLiveCapture(capture);
  assert.ok(result.vault);
  assert.equal(result.vault?.asset, weth);
  assert.equal(result.vault?.decimals, 18);
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

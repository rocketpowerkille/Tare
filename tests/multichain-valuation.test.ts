import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAINLINK_ASSETS, SEQUENCER_FEEDS, supportedChainlinkAsset } from '../packages/domain/src/chainlink-feeds.js';
import { positionValuationInput } from '../packages/domain/src/valuation-input.js';
import { readPrice, readSequencerStatus, PRICE_SELECTORS } from '../packages/sources/src/chainlink.js';
import { word, type ContractReader } from '../packages/sources/src/evm.js';
import { valuePositionWithChainlink } from '../packages/verification/src/valuation.js';
import { TareService } from '../packages/service/src/index.js';
import { investigateWallet } from '../packages/service/src/wallet-investigation.js';
import { AnalyzeSchema } from '../packages/service/src/requests.js';
import { explanationContext } from '../packages/receipts/src/explanation.js';
import { withServer, json } from './helpers/http.js';

const block = { number: '0x64', hash: `0x${'ab'.repeat(32)}`, timestamp: '0x20000' };
const timestamp = BigInt(block.timestamp);
const encode = (values: bigint[]) => `0x${values.map(word).join('')}`;
const goodRound = [2n, 99999999n, timestamp - 2n, timestamp - 1n, 2n];
function reader(round: bigint[], decimals = 8n): ContractReader {
  return { block, async call(_to, data) { return encode(data === PRICE_SELECTORS.decimals ? [decimals] : round); } };
}

test('feed selection requires exact chain and address, not symbol or bridged token assumptions', () => {
  assert.equal(CHAINLINK_ASSETS.length, 6);
  for (const entry of CHAINLINK_ASSETS) {
    assert.equal(supportedChainlinkAsset(entry.chainId, entry.asset.toUpperCase()), entry);
    assert.match(entry.proxy, /^0x[0-9a-f]{40}$/);
  }
  for (const [chainId, asset] of [[84532, CHAINLINK_ASSETS[2]!.asset], [8453, CHAINLINK_ASSETS[0]!.asset],
    [42161, '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8'], [8453, 'USDC']] as const) {
    assert.equal(supportedChainlinkAsset(chainId, asset), undefined);
  }
});

test('each network preserves its price chain and rejects stale/invalid feed responses', async () => {
  for (const asset of CHAINLINK_ASSETS) {
    const price = await readPrice(reader(goodRound), asset.proxy, BigInt(asset.maxAgeSeconds), asset.chainId);
    assert.equal(price.chainId, asset.chainId);
    assert.equal(price.blockHash, block.hash);
    assert.equal(price.answerRaw, '99999999');
    const old = timestamp - BigInt(asset.maxAgeSeconds) - 1n;
    await assert.rejects(readPrice(reader([2n, 1n, old, old, 2n]), asset.proxy, BigInt(asset.maxAgeSeconds), asset.chainId), /stale/);
    await assert.rejects(readPrice(reader(goodRound, 18n), asset.proxy, 86400n, asset.chainId), /Invalid/);
    for (const answer of [0n, 2n ** 256n - 1n]) {
      await assert.rejects(readPrice(reader([2n, answer, timestamp - 2n, timestamp - 1n, 2n]), asset.proxy, 86400n, asset.chainId));
    }
  }
});

test('L2 uptime uses status-transition time and rejects downtime, grace and invalid rounds', async () => {
  for (const chainId of [8453, 42161]) {
    // An old UP transition is valid: do not apply price heartbeat rules to this feed.
    const status = await readSequencerStatus(reader([1n, 0n, 1n, 1n, 1n]), chainId);
    assert.equal(status.status, 'up');
    assert.equal(status.feed, SEQUENCER_FEEDS[chainId]);
    for (const round of [
      [1n, 1n, 1n, 1n, 1n], [1n, 0n, timestamp - 3600n, timestamp - 3600n, 1n],
      [1n, 0n, 0n, 0n, 1n], [1n, 0n, timestamp + 1n, timestamp + 1n, 1n],
      [0n, 0n, 1n, 1n, 0n], [1n, 2n, 1n, 1n, 1n], [1n, 0n, 2n, 1n, 1n],
      [2n, 0n, 1n, 1n, 1n],
    ]) await assert.rejects(readSequencerStatus(reader(round), chainId));
  }
  await assert.rejects(readSequencerStatus(reader([1n, 0n, 1n, 1n, 1n]), 84532));
  await assert.rejects(readSequencerStatus({ block, async call() { throw new Error('Source unavailable'); } }, 8453));
});

const sample = () => ({ sourceMode: 'live-rpc', chainId: 8453, status: 'complete', protocol: 'erc4626',
  position: { asset: CHAINLINK_ASSETS[2]!.asset, decimals: 6, assetsRaw: '1018718' },
  capture: { block, blockConfirmed: true } });
const input = { operation: 'resolve-erc4626', chainId: 8453 };

test('shared UI/investigation input pins quote identity; missing and recorded data never get fresh pricing', () => {
  assert.deepEqual(positionValuationInput(sample(), input), { chainId: 8453, asset: CHAINLINK_ASSETS[2]!.asset,
    amountRaw: '1018718', assetDecimals: 6, blockNumber: '100', blockHash: block.hash });
  for (const report of [
    { ...sample(), sourceMode: 'recorded-rpc' }, { ...sample(), chainId: 1 },
    { ...sample(), position: null }, { ...sample(), capture: { block, blockConfirmed: false } },
    { ...sample(), capture: { block: { number: '100' }, blockConfirmed: true } },
    { ...sample(), position: { ...sample().position, decimals: 18 } },
    { ...sample(), position: { ...sample().position, assetsRaw: undefined } },
    { ...sample(), position: { ...sample().position, assetsRaw: (2n ** 256n).toString() } },
  ]) assert.equal(positionValuationInput(report, input), undefined);
  assert.equal(positionValuationInput(sample(), { ...input, operation: 'unsupported' }), undefined);
  assert.equal(positionValuationInput({ ...sample(), position: { ...sample().position, assetsRaw: '0' } }, input)?.amountRaw, '0');
  assert.equal(positionValuationInput({ ...sample(), kind: 'complete', status: undefined,
    vault: { ...sample().position, convertToAssetsRaw: '5' } }, { ...input, operation: 'resolve-v1' })?.amountRaw, '5');
});

test('service routes all six mappings to the correct RPC, pins hashes and exposes sequencer provenance', async () => {
  for (const asset of CHAINLINK_ASSETS) {
    await withServer((body, response) => {
      const call = body as { id: number; method: string; params: unknown[] };
      let result: unknown;
      if (call.method === 'eth_chainId') result = `0x${asset.chainId.toString(16)}`;
      else if (call.method === 'eth_getBlockByNumber') {
        assert.equal(call.params[0], '0x64');
        result = block;
      } else {
        assert.equal(call.method, 'eth_call');
        assert.deepEqual(call.params[1], { blockHash: block.hash, requireCanonical: true });
        const tx = call.params[0] as { to: string; data: string };
        if (tx.to === SEQUENCER_FEEDS[asset.chainId]) result = encode([1n, 0n, 1n, 1n, 1n]);
        else {
          assert.equal(tx.to, asset.proxy);
          result = encode(tx.data === PRICE_SELECTORS.decimals ? [8n] : goodRound);
        }
      }
      json(response, { jsonrpc: '2.0', id: call.id, result });
    }, async rpcUrl => {
      const config = asset.chainId === 1 ? { rpcUrl } : asset.chainId === 8453 ? { baseMainnetRpcUrl: rpcUrl } : { arbitrumRpcUrl: rpcUrl };
      const service = new TareService(config);
      assert.equal(service.capabilities().live['value-position'], true);
      assert.ok(service.capabilities().chainlinkAssets.every(item => item.chainId === asset.chainId));
      const request = { operation: 'value-position', chainId: asset.chainId, asset: asset.asset, amountRaw: '0',
        assetDecimals: asset.assetDecimals, blockNumber: '100', blockHash: block.hash };
      const report = await service.run('analyze', request) as Awaited<ReturnType<typeof valuePositionWithChainlink>>;
      assert.equal(report.value.valueRaw, '0');
      assert.equal(report.chainId, asset.chainId);
      assert.equal(report.capture.confirmed, true);
      assert.equal(report.sequencer?.status, asset.chainId === 1 ? undefined : 'up');
      assert.match(report.limitations.join(' '), /does not verify vault backing/);
      assert.ok(!JSON.stringify(report).includes(rpcUrl));
      assert.ok(!('confidence' in report));
      const context = explanationContext(report);
      assert.ok(context.evidenceCategories.marketPriced.length > 0);
      if (asset.chainId !== 1) assert.ok(context.evidenceCategories.observed.some(fact => fact.field === 'sequencer.status'));
      await assert.rejects(service.run('analyze', { ...request, blockHash: `0x${'cd'.repeat(32)}` }), /block hashes differ/);
      await assert.rejects(service.run('analyze', { ...request, assetDecimals: 9 }), /decimals/);
    });
  }
});

test('unsupported assets, testnet and wrong network fail closed without a USD value', async () => {
  const request = { operation: 'value-position', chainId: 84532, asset: CHAINLINK_ASSETS[2]!.asset, amountRaw: '1', assetDecimals: 6 };
  assert.equal(AnalyzeSchema.safeParse(request).success, false);
  await assert.rejects(new TareService({ rpcUrl: 'http://127.0.0.1:1' }).run('analyze', { ...request, chainId: 8453 }), /No RPC/);
  await assert.rejects(valuePositionWithChainlink({ ...request, chainId: 8453, asset: `0x${'1'.repeat(40)}`, rpcUrl: 'http://127.0.0.1:1' }));
  await withServer((_body, response) => { response.writeHead(429); response.end(); }, async rpcUrl => {
    await assert.rejects(valuePositionWithChainlink({ ...request, chainId: 8453, rpcUrl }));
    await assert.rejects(new TareService({ baseMainnetRpcUrl: rpcUrl }).run('analyze', { ...request, chainId: 8453 }),
      (error: unknown) => {
        assert.equal((error as { status: number }).status, 503);
        assert.match((error as Error).message, /No USD estimate/);
        assert.ok(!(error as Error).message.includes(rpcUrl));
        return true;
      });
  });
});

test('wallet investigation reuses exact Base and Arbitrum quote input without inventing Graph comparisons', async () => {
  for (const chainId of [8453, 42161]) {
    const asset = CHAINLINK_ASSETS.find(item => item.chainId === chainId && item.symbol === 'USDC')!;
    const owner = `0x${'1'.repeat(40)}`;
    const vault = `0x${'2'.repeat(40)}`;
    let priced = false;
    const service = {
      capabilities: () => ({ live: { 'verify-graph-composition': true } }),
      async run(action: string, request: Record<string, unknown>) {
        if (action === 'discover') return { positions: [{ vault, chainId, support: { status: 'supported', operation: 'resolve-erc4626' } }] };
        if (request.operation === 'resolve-erc4626') return { ...sample(), chainId, position: { ...sample().position, asset: asset.asset } };
        assert.deepEqual(request, { operation: 'value-position', chainId, asset: asset.asset,
          amountRaw: '1018718', assetDecimals: 6, blockNumber: '100', blockHash: block.hash });
        priced = true;
        return { reportType: 'chainlink-position-valuation', status: 'complete' };
      },
    } as unknown as TareService;
    const result = await investigateWallet(service, { owner });
    assert.equal(priced, true);
    const combined = result.results[0]!.report as { modules: { id: string }[] };
    assert.deepEqual(combined.modules.map(module => module.id), ['chainlink']);
    assert.match(result.limitations.join(' '), /do not prove backing/);
  }
});

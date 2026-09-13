import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatEvidenceAmount } from '../packages/receipts/src/explanation-amounts.js';
import { explanationContext, explanationPrompt } from '../packages/receipts/src/explanation.js';
import { compactEvidenceReport } from '../packages/receipts/src/compact.js';
import { readJsonFile } from '../packages/sources/src/snapshot.js';
import { replayLiveCapture } from '../packages/resolver/src/live.js';

test('exact formatting handles zero, tiny, huge and differing decimal amounts', () => {
  for (const [raw, decimals, display] of [
    ['28728443339809', 6, '28,728,443.339809 USDC'],
    ['14764611631285', 6, '14,764,611.631285 USDC'],
    ['0', 18, '0 USDC'], ['42', 0, '42 USDC'],
    ['1', 18, '0.000000000000000001 USDC'],
    ['1', 36, '0.000000000000000000000000000000000001 USDC'],
    ['900719925474099300000001', 6, '900,719,925,474,099,300.000001 USDC'],
    ['123456789', 8, '1.23456789 USDC'],
    ['1000000000000000000', 18, '1 USDC'],
  ] as const) {
    const result = formatEvidenceAmount(raw, decimals, 'USDC', 'test.decimals');
    assert.equal(result.status, 'formatted');
    if (result.status !== 'formatted') throw new Error('Expected exact amount');
    assert.equal(result.display, display);
    const [whole, fraction = ''] = result.decimal.split('.');
    assert.equal(BigInt(whole! + fraction.padEnd(decimals, '0')).toString(), raw);
  }
});

test('missing and invalid decimals or raw values cannot produce a formatted amount', () => {
  for (const decimals of [undefined, null, '6', NaN, Infinity, -1, 37, 1.5]) {
    assert.equal(formatEvidenceAmount('1', decimals, 'asset', 'test').status, 'unavailable');
  }
  for (const raw of [undefined, null, 12, '1e6', '-1', '1.0', '001', '9'.repeat(79)]) {
    assert.equal(formatEvidenceAmount(raw, 6, 'asset', 'test').status, 'unavailable');
  }
});

test('saved Steakhouse report prevents the million-fold amount error without inventing share precision', async () => {
  const report = await replayLiveCapture(await readJsonFile('fixtures/live/steakhouse-usdc.capture.json'));
  const context = explanationContext(report);
  const amount = context.evidenceCategories.derived.find(fact => fact.field === 'underlyingAssetQuoteRaw');
  assert.equal(amount?.value, '28728443339809');
  assert.equal(amount?.formattedAmount?.status, 'formatted');
  if (amount?.formattedAmount?.status !== 'formatted') throw new Error('Missing display-ready quote');
  assert.equal(amount.formattedAmount.display, '28,728,443.339809 USDC');
  assert.equal(amount.formattedAmount.decimalsSource, 'vault.decimals');
  const allocations = context.evidenceCategories.derived.filter(fact => fact.field.startsWith('markets['));
  for (const fact of allocations) {
    assert.equal(fact.formattedAmount?.status, 'formatted');
    if (fact.formattedAmount?.status !== 'formatted') throw new Error('Missing allocation amount');
    const [whole, fraction = ''] = fact.formattedAmount.decimal.split('.');
    assert.equal(BigInt(whole! + fraction.padEnd(6, '0')).toString(), fact.value);
  }
  const shares = context.evidenceCategories.observed.filter(fact => ['vault.sharesRaw', 'vault.totalSupplyRaw'].includes(fact.field));
  assert.equal(shares.length, 2);
  assert.ok(shares.every(fact => fact.formattedAmount?.status === 'unavailable'));
  assert.equal(context.freshness, 'saved-evidence');
  assert.equal(context.evidenceCategories.marketPriced.length, 0);
  assert.match(context.supportedConclusion, /full backing and safety are not established/);
  assert.deepEqual(compactEvidenceReport(report).explanationContext, context);
});

test('explicit share precision is separate from ERC-4626 asset precision', () => {
  const context = explanationContext({ protocol: 'erc4626', status: 'complete', position: {
    sharesRaw: '1000000000000000000', totalSupplyRaw: '2000000000000000000', shareDecimals: 18,
    assetsRaw: '1234567', totalAssetsRaw: '2469134', decimals: 6, assetSymbol: 'USDC',
  } });
  const shares = context.evidenceCategories.observed.find(fact => fact.field === 'vault.sharesRaw')?.formattedAmount;
  const assets = context.evidenceCategories.derived.find(fact => fact.field === 'underlyingAssetQuoteRaw')?.formattedAmount;
  assert.ok(shares?.status === 'formatted' && shares.display === '1 vault shares' && shares.decimalsSource === 'position.shareDecimals');
  assert.ok(assets?.status === 'formatted' && assets.display === '1.234567 USDC');
});

test('missing asset precision and missing conversions stay unavailable', () => {
  const context = explanationContext({ protocol: 'erc4626', status: 'partial', position: { assetsRaw: '1000000', assetSymbol: 'USDC' } });
  assert.equal(context.evidenceCategories.derived[0]?.formattedAmount?.status, 'unavailable');
  const missing = explanationContext({ protocol: 'erc4626', status: 'partial', position: { decimals: 6 } });
  assert.equal(missing.evidenceCategories.derived.length, 0);
});

test('a known nested adapter formats only its scoped USDC quote and allocations', () => {
  const report = { reportType: 'nested-exposure', status: 'complete', capture: { scope: 'morpho-v2-v1-blue', chainId: 1 },
    analysis: { quoteRaw: '1234567', branches: [{ attributedAssetsRaw: '1000000', markets: [{ attributedAssetsRaw: '1' }] }] } };
  const derived = explanationContext(report).evidenceCategories.derived;
  assert.ok(derived.some(f => f.formattedAmount?.status === 'formatted' && f.formattedAmount.display === '1.234567 USDC'));
  const unknown = explanationContext({ ...report, capture: { scope: 'unknown' } });
  assert.ok(unknown.evidenceCategories.derived.every(f => f.formattedAmount?.status !== 'formatted'));
});

test('USD formatting uses price precision and never creates a missing price or value', () => {
  const report = { reportType: 'chainlink-position-valuation', status: 'complete',
    price: { answerRaw: '100000001', decimals: 8, feed: `0x${'3'.repeat(40)}`, updatedAt: '1' },
    value: { valueRaw: '2872844333980900', decimals: 8 } };
  const context = explanationContext(report);
  const usd = context.evidenceCategories.marketPriced.find(f => f.field === 'usd.valueRaw')?.formattedAmount;
  assert.ok(usd?.status === 'formatted' && usd.display === '28,728,443.339809 USD');
  assert.equal(explanationContext({ ...report, price: undefined }).evidenceCategories.marketPriced.length, 0);
  assert.ok(!explanationContext({ ...report, value: undefined }).evidenceCategories.marketPriced.some(f => f.field === 'usd.valueRaw'));
});

test('UI module context formats returned USD and keeps the Chainlink source link', () => {
  const context = explanationContext({ primary: { protocol: 'erc4626', status: 'complete' }, status: 'complete', modules: [{
    id: 'chainlink', status: 'verified', report: { price: { answerRaw: '100000000', decimals: 8, feed: `0x${'3'.repeat(40)}`, updatedAt: '1' },
      value: { valueRaw: '123456789', decimals: 8 } },
  }] });
  const fact = context.evidenceCategories.marketPriced.find(f => f.field === 'usd.valueRaw');
  assert.equal(fact?.source, 'chainlink');
  assert.ok(fact?.formattedAmount?.status === 'formatted' && fact.formattedAmount.display === '1.23456789 USD');
});

test('agent prompt requires prose and using exact display amounts without rescaling', () => {
  const prompt = explanationPrompt({ protocol: 'erc4626', status: 'partial' });
  assert.match(prompt, /No JSON or code block unless the user explicitly requests it/);
  assert.match(prompt, /copy formattedAmount.display exactly/);
  assert.match(prompt, /never divide, rescale/);
  assert.match(prompt, /Never apply asset decimals to vault shares/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { explanationContext, explanationPrompt } from '../packages/receipts/src/explanation.js';
import { compactEvidenceReport } from '../packages/receipts/src/compact.js';

const owner = `0x${'1'.repeat(40)}`;
const vault = `0x${'2'.repeat(40)}`;
const feed = `0x${'3'.repeat(40)}`;
const report = {
  protocol: 'metamorpho-v1-blue-v1', kind: 'complete', sourceMode: 'live-rpc', chainId: 1, owner,
  captureDigest: `sha256:${'a'.repeat(64)}`,
  capture: { owner, vault, block: { number: '0x10', hash: `0x${'b'.repeat(64)}` }, capturedAt: '2026-09-12T00:00:00.000Z' },
  vault: { address: vault, asset: feed, sharesRaw: '9007199254740993123456', totalSupplyRaw: '9999999999999999999999', convertToAssetsRaw: '1234567', decimals: 6 },
  markets: [], findings: [], metric: { kind: 'unavailable', reasons: ['missing-independent-backing-verification'] },
};
const price = { feed, answerRaw: '100000001', decimals: 8, updatedAt: '1', roundId: '2' };
const valuation = { reportType: 'chainlink-position-valuation', status: 'complete', sourceMode: 'live-rpc', chainId: 1, price, value: { valueRaw: '123456789', decimals: 8 }, capture: report.capture };
const graph = { reportType: 'graph-product-composition', status: 'matched', sourceMode: 'live-graph-products-rpc', verification: 'token-api-with-rpc-cross-check', capture: report.capture,
  checks: { tokenApiAmountRaw: '42', rpcAmountRaw: '42', accountingApplicable: false }, findings: [] };
const composed = (modules: unknown[], status = 'complete') => ({ reportType: 'comprehensive-position-check', status, primary: report, modules });

test('observed values retain exact raw integers and source block provenance', () => {
  const context = explanationContext(report);
  assert.equal(context.evidenceCategories.observed.find(f => f.field === 'vault.sharesRaw')?.value, report.vault.sharesRaw);
  assert.equal(context.observedBlock, '16');
  assert.equal(context.network, 'Ethereum');
  assert.equal(context.evidenceId, report.captureDigest);
});
test('derived conversion is distinct from the observed contract quote', () => {
  const categories = explanationContext(report).evidenceCategories;
  assert.equal(categories.observed.find(f => f.field === 'contractConversionQuoteRaw')?.value, '1234567');
  assert.equal(categories.derived.find(f => f.field === 'underlyingAssetQuoteRaw')?.value, '1234567');
});
test('market-priced values retain price, precision, source and timestamp without rounding', () => {
  const context = explanationContext(valuation);
  assert.equal(context.evidenceCategories.marketPriced.find(f => f.field === 'usd.valueRaw')?.value, '123456789');
  assert.equal(context.evidenceCategories.marketPriced.find(f => f.field === 'price.updatedAt')?.value, '1970-01-01T00:00:01.000Z');
});
test('checked facts require a returned comparison, not just a completed trace', () => {
  assert.equal(explanationContext(report).evidenceCategories.checked.length, 0);
  assert.equal(explanationContext(graph).evidenceCategories.checked[0]?.value, 'token-api-with-rpc-cross-check');
});
test('interpretation of nonzero shares remains inferred, not custody evidence', () => {
  assert.match(String(explanationContext(report).evidenceCategories.inferred[0]?.value), /not direct custody/);
});
test('not-verified includes global safety and full-backing boundaries', () => {
  assert.match(JSON.stringify(explanationContext(report).evidenceCategories.notVerified), /solvency.*safety.*loan recovery/);
});
test('fresh and saved reports are not interchangeable', () => {
  assert.equal(explanationContext(report).freshness, 'live-observation-at-recorded-block');
  assert.equal(explanationContext({ ...report, sourceMode: 'recorded-rpc' }).freshness, 'saved-evidence');
});
test('different source blocks remain explicit', () => {
  const context = explanationContext(composed([{ id: 'the-graph', status: 'verified', report: { ...graph, capture: { ...graph.capture, block: { number: '17' } } } }]));
  assert.equal(context.sourceBlocksDiffer, true);
  assert.ok(context.evidenceCategories.notVerified.some(f => f.field === 'sameBlockAgreement'));
});
test('missing Chainlink price cannot create a USD estimate', () => {
  const context = explanationContext({ ...valuation, price: undefined });
  assert.equal(context.evidenceCategories.marketPriced.length, 0);
});
test('missing Graph evidence does not become agreement', () => {
  const context = explanationContext(report);
  assert.equal(context.sourceSummary.find(s => s.id === 'the-graph')?.status, 'not-included');
  assert.equal(context.evidenceCategories.checked.length, 0);
});
test('Bazantic authorization never becomes checked vault evidence or an invented receipt', () => {
  const context = explanationContext(composed([{ id: 'bazantic', status: 'verified', accessToken: 'SECRET_TOKEN' }]));
  assert.equal(context.authorization.status, 'verified');
  assert.equal(context.authorization.settlementReceipt, 'not-included');
  assert.ok(!JSON.stringify(context).includes('SECRET_TOKEN'));
  assert.equal(context.evidenceCategories.checked.length, 0);
});
test('incomplete report cannot be explained as fully verified', () => {
  const context = explanationContext({ ...report, kind: 'partial', findings: [{ code: 'source-unavailable' }] });
  assert.equal(context.summaryStatus, 'partial');
  assert.match(context.supportedConclusion, /incomplete/);
  assert.equal(context.findings[0]?.code, 'source-unavailable');
});
test('mismatched comparison does not produce a matched conclusion', () => {
  const context = explanationContext({ ...graph, status: 'mismatch' });
  assert.match(context.supportedConclusion, /disagrees/);
  assert.equal(context.evidenceCategories.checked.length, 0);
});
test('unsupported report shapes remain uninterpreted', () => {
  const context = explanationContext({ reportType: 'new-unapproved-protocol', status: 'complete', vault: report.vault });
  assert.equal(context.operation, 'unsupported');
  assert.equal(context.summaryStatus, 'unavailable');
  assert.equal(context.evidenceCategories.observed.length, 0);
});
test('zero-share position never produces an inferred positive holding', () => {
  const context = explanationContext({ ...report, vault: { ...report.vault, sharesRaw: '0' } });
  assert.equal(context.evidenceCategories.inferred.length, 0);
  assert.ok(context.evidenceCategories.notVerified.some(f => f.field === 'positivePosition'));
});
test('missing conversion stays unavailable', () => {
  const context = explanationContext({ ...report, vault: { ...report.vault, convertToAssetsRaw: null } });
  assert.equal(context.evidenceCategories.derived.length, 0);
  assert.ok(context.evidenceCategories.notVerified.some(f => f.field === 'assetConversion'));
});
test('missing backing metric remains explicit', () => {
  assert.ok(explanationContext({ ...report, metric: undefined }).evidenceCategories.notVerified.some(f => f.field === 'backingMetric'));
});
test('a reference price alone does not invent a USD position value', () => {
  const context = explanationContext({ ...valuation, value: undefined });
  assert.ok(!context.evidenceCategories.marketPriced.some(f => f.field === 'usd.valueRaw'));
});
test('no confidence score is copied or created', () => {
  const context = explanationContext({ ...report, confidenceScore: 100 });
  assert.ok(!('confidenceScore' in context));
  assert.ok(!JSON.stringify(context.evidenceCategories).includes('confidence'));
});
test('complete trace does not support a safety conclusion', () => {
  assert.match(explanationContext(report).supportedConclusion, /full backing and safety are not established/);
});
test('context is deterministic, does not mutate reports, and excludes raw capture secrets', () => {
  const input = { ...report, capture: { ...report.capture, rpcUrl: 'https://secret-provider.example/PRIVATE_KEY', accessToken: 'SECRET' }, apiKey: 'SECRET', modules: [{ id: 'the-graph', status: 'unavailable', summary: 'Bearer SECRET' }] };
  const before = JSON.stringify(input);
  const context = explanationContext(input);
  assert.deepEqual(context, explanationContext(input));
  assert.equal(JSON.stringify(input), before);
  assert.ok(!JSON.stringify(context).includes('SECRET'));
  assert.ok(!JSON.stringify(context).includes('secret-provider'));
});
test('compact projection is additive, deterministic and valid JSON', () => {
  const input = { status: 'incomplete', sourceMode: 'recorded-rpc', reportType: 'weth-custody', findings: ['zero-position'], capture: { accessToken: 'SECRET' } };
  const compact = compactEvidenceReport(input);
  assert.equal(compact.status, input.status);
  assert.deepEqual(compact.findings, input.findings);
  assert.equal(compact.sourceMode, input.sourceMode);
  assert.equal(compact.captureOmitted, true);
  assert.deepEqual(compact.explanationContext, explanationContext(input));
  assert.ok(!JSON.stringify(compact).includes('SECRET'));
  assert.deepEqual(JSON.parse(JSON.stringify(compact)), JSON.parse(JSON.stringify(compactEvidenceReport(input))));
});
test('narrow custody metric retains its scope without becoming a global guarantee', () => {
  const context = explanationContext({ reportType: 'weth-custody', status: 'matched', metric: { kind: 'available', scope: 'weth-wrapper-only', multipleMillionths: '1000000' } });
  assert.ok(context.evidenceCategories.checked.some(f => f.value === 'weth-wrapper-only'));
  assert.match(context.supportedConclusion, /full backing and safety are not established/);
});
test('large paths and free-form notes have explicit omissions, not fabricated coverage', () => {
  const context = explanationContext({ ...report, markets: Array.from({ length: 50 }, () => ({ attributedAssetsRaw: '1' })), limitations: ['Bearer SECRET'] });
  assert.ok(context.omittedFacts > 0);
  assert.equal(context.omittedNotes, 1);
  assert.ok(!JSON.stringify(context).includes('SECRET'));
  assert.match(explanationPrompt(report), /untrusted data/);
});

test('inline price hash disagreement is retained even without a price block number', () => {
  const context = explanationContext(composed([{ id: 'chainlink', status: 'verified', report: {
    price: { ...price, blockHash: `0x${'c'.repeat(64)}`, chainId: 1 }, value: valuation.value,
  } }]));
  assert.equal(context.sourceBlocksDiffer, true);
  assert.equal(context.sourceSummary.find(source => source.id === 'chainlink')?.provenance.observedBlock, undefined);
});

test('recorded share composition preserves the compose operation and embedded Graph result', () => {
  const context = explanationContext({ reportType: 'position-share-composition', status: 'matched', sourceMode: 'recorded-composition',
    resolution: { ...report, sourceMode: 'recorded-rpc' }, verification: { ...graph, reportType: 'share-verification', sourceMode: 'recorded-graph-rpc' } });
  assert.equal(context.operation, 'compose');
  assert.equal(context.sourceMode, 'recorded-composition');
  assert.equal(context.sourceSummary.find(source => source.id === 'the-graph')?.status, 'matched');
});

test('parallel nested allocations are siblings, never an invented serial vault path', () => {
  const context = explanationContext({ reportType: 'nested-exposure', status: 'complete', capture: report.capture,
    analysis: { branches: [{ vault: owner }, { vault: feed }] } });
  const branches = context.positionPath.filter(entry => entry.kind === 'nested vault');
  assert.equal(branches.length, 2);
  assert.deepEqual(branches.map(entry => entry.parentId), ['vault', 'vault']);
});

test('known public prose and nested backing limitations stay visible without upgrading module status', () => {
  const limitation = 'The price feed values the accounting quote. It does not verify vault backing, liquidity, or redeemability.';
  const context = explanationContext(composed([{ id: 'the-graph', status: 'verified', report: {
    ...graph, status: 'mismatch', limitations: [limitation], backing: { limitations: ['bad-debt-not-valued'] },
  } }]));
  assert.equal(context.sourceSummary.find(source => source.id === 'the-graph')?.status, 'mismatch');
  assert.ok(context.limitations.some(note => note.text === limitation));
  assert.ok(context.limitations.some(note => note.code === 'bad-debt-not-valued'));
});

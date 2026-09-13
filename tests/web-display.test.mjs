import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Load the pure browser presentation helpers without adding them to the API build.
const types = ts.transpileModule(await readFile(new URL('../apps/web/src/lib/types.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const typesUrl = `data:text/javascript;base64,${Buffer.from(types).toString('base64')}`;
async function webModule(name) {
  const source = await readFile(new URL(`../apps/web/src/lib/${name}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replaceAll("'./types'", JSON.stringify(typesUrl));
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const { formatAmount, displayBlock, displayTimestamp, positionValues, positionTree, priceEvidence } = await webModule('report-display');
const { initialStages, observePrimary, observeModule } = await webModule('progress');
const receipt = JSON.parse(await readFile(new URL('../fixtures/live/steakhouse-usdc.receipt.json', import.meta.url), 'utf8'));

test('display preserves exact large units, zero decimals and explicit truncation', () => {
  assert.equal(formatAmount('900719925474099300000001', 6), '900,719,925,474,099,300.000001');
  assert.equal(formatAmount('42', 0), '42');
  assert.equal(formatAmount('0', 18), '0');
  assert.equal(formatAmount('1', 18), '≈0');
  assert.equal(formatAmount('123456789', 6, 2), '≈123.45');
  for (const [raw, decimals] of [[undefined, 6], ['-1', 6], ['1', -1], ['1', 37], ['1', NaN]]) assert.equal(formatAmount(raw, decimals), undefined);
});

test('metadata handles recorded blocks, missing values and invalid timestamps honestly', () => {
  assert.equal(displayBlock(receipt), '25937756');
  assert.equal(displayBlock({ capture: { rpc: { block: { number: '0x10' } } } }), '16');
  assert.equal(displayBlock({ capture: { block: { number: 'not-a-block' } } }), undefined);
  assert.equal(displayTimestamp('bad'), undefined);
  assert.equal(displayTimestamp('1'), '1970-01-01T00:00:01.000Z');
});

test('V1 diagram retains all markets, zero allocations and actual loan asset addresses', () => {
  const tree = positionTree(receipt);
  assert.equal(tree.reference, receipt.owner);
  const vault = tree.children[0];
  assert.equal(vault.reference, receipt.vault.address);
  assert.equal(vault.children.length, receipt.markets.length);
  assert.equal(vault.children[0].fields[0][1], '0 USDC');
  assert.equal(vault.children[1].children[0].reference, receipt.markets[1].loanToken);
  assert.match(vault.children[1].status, /not independently verified/);
  assert.equal(positionValues(receipt).amount, '28,728,443.339809');
  assert.equal(priceEvidence(receipt).amount, undefined);
});

test('nested paths never invent an unresolved child vault or hidden share balance', () => {
  const report = { reportType: 'nested-exposure', capture: { vault: receipt.vault.address }, analysis: { quoteRaw: '0', branches: [{ adapter: '0xabc', vault: null, attributedAssetsRaw: null, markets: [] }] } };
  const tree = positionTree(report);
  assert.equal(tree.children[0].kind, 'Adapter');
  assert.equal(tree.children[0].reference, '0xabc');
  assert.equal(tree.children[0].fields[0][1], 'Unavailable');
  assert.equal(positionValues(report).shares, undefined);
  assert.equal(positionTree({ reportType: 'unrecognized' }), undefined);
});

test('USD presentation requires returned numeric evidence and preserves price provenance', () => {
  const module = { id: 'chainlink', report: { value: { valueRaw: '123456789', decimals: 8 }, price: { answerRaw: '100000000', decimals: 8, feed: '0xfeed', updatedAt: '1', roundId: '2' } } };
  const evidence = priceEvidence({}, [module]);
  assert.equal(evidence.amount, '≈1.23');
  assert.equal(evidence.feed, '0xfeed');
  assert.equal(evidence.updatedAt, '1970-01-01T00:00:01.000Z');
  assert.equal(evidence.round, '2');
  assert.equal(priceEvidence({}, [{ id: 'chainlink', status: 'verified' }]).amount, undefined);
  assert.equal(priceEvidence({}, [{ id: 'chainlink', report: { value: { valueRaw: '100', decimals: 2 } } }]).amount, undefined);
});

test('timeline does not claim trace completion before a source response', () => {
  const stages = initialStages(true);
  assert.equal(stages.length, 8);
  assert.equal(stages.find(stage => stage.id === 'layers').status, 'waiting');
  assert.equal(stages.find(stage => stage.id === 'report').status, 'waiting');
  assert.ok(!stages.some(stage => stage.status === 'complete'));
  assert.match(initialStages(false, true).find(stage => stage.id === 'request').detail, /No live blockchain query/);
});

test('zero shares, missing quotes and unavailable providers remain distinct', () => {
  const events = [];
  const notify = (...event) => events.push(event);
  observePrimary({ ...receipt, vault: { ...receipt.vault, sharesRaw: '0' } }, notify);
  assert.equal(events.find(([id]) => id === 'position')[1], 'warning');
  events.length = 0;
  observePrimary({ status: 'partial' }, notify);
  assert.equal(events.find(([id]) => id === 'position')[1], 'warning');
  assert.equal(events.find(([id]) => id === 'allocations')[1], 'unavailable');
  observeModule({ id: 'the-graph', status: 'unavailable', summary: 'Source timed out.' }, notify);
  assert.deepEqual(events.at(-1), ['the-graph', 'unavailable', 'Source timed out.']);
  observeModule({ id: 'chainlink', status: 'unavailable', technicalError: true, summary: 'Invalid response.' }, notify);
  assert.deepEqual(events.at(-1), ['chainlink', 'error', 'Invalid response.']);
});

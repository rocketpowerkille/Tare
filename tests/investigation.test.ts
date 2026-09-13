import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { InvestigationStore } from '../apps/api/src/investigation-store.js';
import { InvestigationRunner } from '../apps/api/src/investigation-runner.js';
import { RecipeError } from '../apps/api/src/recipe-errors.js';
import { investigationFacts, compareInvestigationReports, answerSections } from '../packages/receipts/src/investigation.js';
import { ServiceError } from '../packages/service/src/requests.js';
import { investigationFromEnv } from '../apps/api/src/investigation-routes.js';

const report = { protocol: 'metamorpho-v1-blue-v1', kind: 'complete', sourceMode: 'recorded-rpc', chainId: 1,
  owner: `0x${'1'.repeat(40)}`, capture: { vault: `0x${'2'.repeat(40)}`, block: { number: '20' } },
  vault: { address: `0x${'2'.repeat(40)}`, sharesRaw: '0', convertToAssetsRaw: '1234567', decimals: 6 },
  metric: { kind: 'unavailable', reasons: ['missing-independent-backing-verification'] } };

test('snapshot facts preserve zero shares, exact amounts, saved provenance and missing prices', () => {
  const a = investigationFacts(report);
  assert.deepEqual(a, investigationFacts(report));
  assert.ok(a.facts.some(fact => JSON.stringify(fact.value).includes('"value":"0"')));
  assert.equal(a.context.freshness, 'saved-evidence');
  assert.equal(a.context.evidenceCategories.marketPriced.length, 0);
  assert.match(JSON.stringify(a.facts), /solvency.*safety/);
});

test('comparison refuses different identity and does not calculate profits', () => {
  assert.equal(compareInvestigationReports(report, { ...report, chainId: 8453 }).comparable, false);
  const comparison = compareInvestigationReports(report, { ...report, kind: 'incomplete' });
  assert.equal(comparison.comparable, true);
  assert.ok(comparison.changes.length > 0);
  assert.match(comparison.limitation, /not proof/);
});

test('snapshot ownership, expiration, bounds, secret rejection and pagination', () => {
  let now = 1;
  const store = new InvestigationStore(() => now);
  const saved = store.create('alice', { report });
  assert.throws(() => store.get(saved.reference, 'bob'), /unavailable/);
  assert.equal(store.allPagesRead(saved.reference), false);
  const first = store.read(saved.reference, 0);
  for (let page = 1; page < first.pages; page++) store.read(saved.reference, page);
  assert.equal(store.allPagesRead(saved.reference), true);
  assert.throws(() => store.read(saved.reference, 63), /outside/);
  assert.throws(() => store.create('alice', { report: { ...report, accessToken: 'secret' } }), /credentials/);
  assert.throws(() => store.create('alice', { report: { ...report, note: 'Bearer abcdefghijklmnopqrstuvwxyz' } }), /credentials/);
  assert.throws(() => store.create('alice', { report: { note: 'a'.repeat(1_048_577) } }), /limited/);
  now += 600_001;
  assert.throws(() => store.get(saved.reference, 'alice'), /expired/);
});

test('snapshot retains separate Graph blocks and incomplete status', () => {
  const saved = new InvestigationStore().create('alice', { report: {
    reportType: 'comprehensive-position-check', status: 'incomplete', primary: report,
    modules: [{ id: 'the-graph', status: 'incomplete', report: { reportType: 'accounting-verification', status: 'incomplete', capture: { chainId: 1, rpc: { block: { number: '21' } } } } }, { id: 'chainlink', status: 'unavailable' }],
  } });
  assert.match(JSON.stringify(saved.facts), /sameBlockAgreement/);
  assert.match(JSON.stringify(saved.facts), /incomplete/);
  assert.doesNotMatch(JSON.stringify(saved.facts), /confidenceScore/);
});

test('assistant defaults disabled and malformed configured handle fails closed', () => {
  assert.deepEqual(investigationFromEnv({}), {});
  assert.throws(() => investigationFromEnv({ TARE_RECIPE_ENABLED: 'true', TARE_INVESTIGATION_RECIPE: '../bad' }));
});

async function finish(runner: InvestigationRunner, id: string) {
  for (let i = 0; i < 50; i++) {
    const result = runner.get('alice', id);
    if (result.status !== 'running') return result;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error('Mock run did not finish');
}

test('run deduplicates double clicks and keys, cites pinned context and records no settlement claim', async () => {
  const store = new InvestigationStore();
  const saved = store.create('alice', { report });
  let executions = 0;
  const runner = new InvestigationRunner(store, { async execute(_handle, question) {
    executions++;
    assert.ok(question.includes(saved.reference));
    const first = store.read(saved.reference, 0);
    for (let page = 1; page < first.pages; page++) store.read(saved.reference, page);
    return { output: { sections: answerSections.map(title => ({ title, text: 'Saved accounting evidence does not establish backing.', citations: ['current.limitations'] })) },
      gateway: 'https://example.bazgateway.com', elapsedMs: 10, payment: 'not-requested' };
  } }, 'test-recipe');
  const input = { reference: saved.reference, requestId: randomUUID(), question: 'Explain', consent: true };
  const run = runner.start('alice', input);
  assert.equal(runner.start('alice', input).id, run.id);
  assert.equal(runner.start('alice', { ...input, requestId: randomUUID() }).id, run.id);
  assert.throws(() => runner.start('alice', { ...input, question: 'Different' }), /identifier/);
  assert.throws(() => runner.get('bob', run.id), /unavailable/);
  const result = await finish(runner, run.id);
  assert.equal(result.status, 'complete');
  assert.equal(result.receipt?.settlement, 'not-confirmed');
  assert.equal(result.receipt?.cost, null);
  assert.equal(executions, 1);
});

test('missing context fetch or invented citation withholds the answer', async () => {
  for (const readPages of [false, true]) {
    const store = new InvestigationStore();
    const saved = store.create('alice', { report });
    const runner = new InvestigationRunner(store, { async execute() {
      if (readPages) { const first = store.read(saved.reference, 0); for (let p = 1; p < first.pages; p++) store.read(saved.reference, p); }
      return { output: { sections: answerSections.map(title => ({ title, text: 'Text', citations: [readPages ? 'invented' : 'current.limitations'] })) }, gateway: 'https://example.bazgateway.com', elapsedMs: 0, payment: 'not-requested' };
    } }, 'test');
    const run = runner.start('alice', { reference: saved.reference, requestId: randomUUID(), question: 'Explain', consent: true });
    const result = await finish(runner, run.id);
    assert.equal(result.status, 'review-required');
    assert.equal(result.sections, undefined);
    assert.deepEqual(result.review?.reasons, [readPages ? 'unknown-citations' : 'missing-context-pages']);
    assert.equal(result.review?.retrievedPages, readPages ? result.review.expectedPages : 0);
  }
});

test('failed execution records retain safe diagnostics without inventing a receipt', async () => {
  const store = new InvestigationStore();
  const saved = store.create('alice', { report });
  const diagnostic = { stage: 'execution' as const, code: 'recipe-tool-error', upstreamCode: 'no_tool_calls' };
  const runner = new InvestigationRunner(store, { async execute() {
    throw new RecipeError(502, diagnostic.code, 'No tool calls occurred.', diagnostic);
  } }, 'test');
  const run = runner.start('alice', { reference: saved.reference, requestId: randomUUID(), question: 'Explain', consent: true });
  const result = await finish(runner, run.id);
  assert.deepEqual(result.diagnostic, diagnostic);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.sections, undefined);
  assert.equal(result.receipt, undefined);
});

test('payment challenge stops run, retains no fabricated receipt and does not retry', async () => {
  let calls = 0;
  const store = new InvestigationStore();
  const saved = store.create('alice', { report });
  const runner = new InvestigationRunner(store, { async execute() { calls++; throw new ServiceError(402, 'payment', 'Payment required; not retried.'); } }, 'test');
  const input = { reference: saved.reference, requestId: randomUUID(), question: 'Explain', consent: true };
  const run = runner.start('alice', input);
  const result = await finish(runner, run.id);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.receipt, undefined);
  runner.start('alice', input);
  assert.equal(calls, 1);
});

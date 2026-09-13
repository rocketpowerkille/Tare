import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewInvestigationAnswer } from '../apps/api/src/investigation-review.js';
import { answerSections } from '../packages/receipts/src/investigation.js';

const reference = 'a'.repeat(48);
const ids = new Set(['current.limitations']);
const coverage = { expectedPages: 8, retrievedPages: 8 };
const answer = () => ({ sections: answerSections.map(title => ({ title,
  text: 'Saved evidence does not establish full backing.', citations: ['current.limitations'] })) });

test('answer review accepts exactly the existing cited schema and JSON fences', () => {
  for (const output of [answer(), JSON.stringify(answer()), '```json\n' + JSON.stringify(answer()) + '\n```']) {
    const result = reviewInvestigationAnswer(output, ids, reference, coverage);
    assert.deepEqual(result.sections, answer().sections);
    assert.deepEqual(result.diagnostic.reasons, []);
  }
});

test('answer review distinguishes invalid JSON, schema and missing pages without leaking content', () => {
  const invalid = reviewInvestigationAnswer('secret rejected model text', ids, reference, coverage);
  assert.deepEqual(invalid.diagnostic.reasons, ['invalid-json', 'invalid-answer-schema']);
  assert.equal(invalid.sections, undefined);
  assert.doesNotMatch(JSON.stringify(invalid), /secret rejected model text/);
  const wrongSchema = reviewInvestigationAnswer({ summary: 'Wrong shape' }, ids, reference, coverage);
  assert.deepEqual(wrongSchema.diagnostic.reasons, ['invalid-answer-schema']);
  const missing = reviewInvestigationAnswer(answer(), ids, reference, { expectedPages: 8, retrievedPages: 1 });
  assert.deepEqual(missing.diagnostic.reasons, ['missing-context-pages']);
  assert.equal(missing.diagnostic.retrievedPages, 1);
  assert.equal(missing.sections, undefined);
});

test('answer review reports ordering and unknown citations without exposing rejected values', () => {
  const output = answer();
  output.sections.reverse();
  output.sections[0]!.citations = ['private-reference-not-a-fact'];
  const result = reviewInvestigationAnswer(output, ids, reference, coverage);
  assert.deepEqual(result.diagnostic.reasons, ['section-order', 'unknown-citations']);
  assert.equal(result.diagnostic.unknownCitationCount, 1);
  assert.equal(result.sections, undefined);
  assert.doesNotMatch(JSON.stringify(result), /private-reference-not-a-fact/);
});

test('answer review preserves sensitive-output and strict schema rejection', () => {
  for (const text of [reference, 'Bearer example-secret', 'tare_sandbox_v1.example']) {
    const output = answer();
    output.sections[0]!.text = text;
    const result = reviewInvestigationAnswer(output, ids, reference, coverage);
    assert.deepEqual(result.diagnostic.reasons, ['sensitive-output']);
    assert.equal(result.sections, undefined);
    assert.equal(JSON.stringify(result).includes(text), false);
  }
  assert.equal(reviewInvestigationAnswer({ ...answer(), extra: true }, ids, reference, coverage).sections, undefined);
});

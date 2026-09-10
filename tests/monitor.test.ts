import test from 'node:test';
import assert from 'node:assert/strict';
import { advance } from '../packages/monitor/src/engine.js';
import { currentSummary, Position } from '../packages/monitor/src/model.js';
import { evaluateCaptures } from '../packages/monitor/src/evaluate.js';
import { monitorFixture, monitorHash } from './helpers/monitor.js';

test('monitor coalesces events and deduplicates replay without losing its cursor', async () => {
  const f = await monitorFixture();
  let calls = 0;
  const evaluate = () => { calls++; return f.evaluate(); };
  const frame = { ...f.frame, events: [...f.frame.events, ...f.frame.events, { ...f.frame.events[0]!, logIndex: 1 }] };
  const first = await advance(f.state, frame, evaluate);
  assert.equal(calls, 1);
  assert.deepEqual(first.emitted[0]!.reasons, ['initial-observation']);
  assert.equal(currentSummary(first.state)!.status, 'matched');
  assert.equal(currentSummary(first.state)!.metric, 'unavailable');
  const duplicate = await advance(first.state, { ...frame, cursor: 'resumed' }, evaluate);
  assert.equal(calls, 1);
  assert.equal(duplicate.emitted.length, 0);
  assert.equal(duplicate.state.cursor, 'resumed');
  assert.equal(f.state.cursor, '');
});

test('monitor undo retracts orphan alerts, restores the baseline and permits replacement blocks', async () => {
  const f = await monitorFixture();
  const first = await advance(f.state, f.frame, f.evaluate);
  const evaluation = await f.evaluate();
  const replacement = { ...f.frame, block: { number: String(BigInt(f.frame.block.number) + 1n), hash: monitorHash('b') }, cursor: 'b' };
  const second = await advance(first.state, replacement, async () => ({ ...evaluation, summary: { ...evaluation.summary, shares: '7' } }));
  const undo = await advance(second.state, { type: 'undo', block: f.frame.block, cursor: 'undo-a' }, async () => { throw new Error('Undo must not resolve'); });
  assert.deepEqual(undo.emitted[0]!.invalidated, [second.emitted[0]!.id]);
  assert.equal(undo.state.cursor, 'undo-a');
  assert.deepEqual(currentSummary(undo.state), currentSummary(first.state));
  const canonical = await advance(undo.state, { ...replacement, block: { ...replacement.block, hash: monitorHash('c') } }, async () => evaluation);
  assert.equal(canonical.emitted.length, 0);
  assert.equal(canonical.state.sequence, undo.state.sequence);
  const replayedUndo = await advance(undo.state, { type: 'undo', block: f.frame.block, cursor: 'undo-a' }, f.evaluate);
  assert.equal(replayedUndo.emitted.length, 0);
});

test('undo before the first observation removes the baseline and unknown deep forks fail closed', async () => {
  const f = await monitorFixture();
  const first = await advance(f.state, f.frame, f.evaluate);
  const ancestor = { number: String(BigInt(f.frame.block.number) - 1n), hash: monitorHash('b') };
  const undo = await advance(first.state, { type: 'undo', block: ancestor, cursor: 'before-start' }, f.evaluate);
  assert.equal(currentSummary(undo.state), null);
  assert.deepEqual(undo.emitted[0]!.invalidated, [first.emitted[0]!.id]);
  await assert.rejects(advance(first.state, { type: 'undo', block: { ...ancestor, number: '0' }, cursor: 'old' }, f.evaluate), /outside retained/);
});

test('checkpoint stays unchanged after failed resolution or conflicting provider data', async () => {
  const f = await monitorFixture();
  const original = structuredClone(f.state);
  await assert.rejects(advance(f.state, f.frame, async () => { throw new Error('RPC unavailable'); }), /RPC unavailable/);
  assert.deepEqual(f.state, original);
  const first = await advance(f.state, f.frame, f.evaluate);
  await assert.rejects(advance(first.state, { ...f.frame, block: { ...f.frame.block, hash: monitorHash('b') } }, f.evaluate), /undo first/);
  await assert.rejects(advance(first.state, { type: 'undo', block: { ...f.frame.block, hash: monitorHash('b') }, cursor: 'wrong' }, f.evaluate), /ancestor hash/);
  await assert.rejects(advance(f.state, { ...f.frame, events: [f.frame.events[0], { ...f.frame.events[0], address: `0x${'1'.repeat(40)}` }] }, f.evaluate), /Conflicting duplicate/);
});

test('unrelated events only advance progress; retained history is bounded', async () => {
  const f = await monitorFixture();
  let state = f.state;
  for (let index = 0; index < 130; index++) {
    const frame = { ...f.frame, block: { number: String(BigInt(f.frame.block.number) + BigInt(index)), hash: `0x${index.toString(16).padStart(64, '0')}` },
      cursor: `cursor-${index}`, events: [{ ...f.frame.events[0], address: `0x${'1'.repeat(40)}` }] };
    state = (await advance(state, frame, async () => { throw new Error('Unrelated event must not resolve'); })).state;
  }
  assert.equal(state.history.length, 128);
  assert.equal(state.base.number, String(BigInt(f.frame.block.number) + 1n));
  assert.equal(state.alerts.length, 0);
  assert.equal(currentSummary(state), null);
});

test('monitor accepts real capture composition but rejects a different position or stream block', async () => {
  const f = await monitorFixture();
  const evaluation = await f.evaluate();
  assert.equal(evaluation.summary.status, 'matched');
  await assert.rejects(evaluateCaptures(f.evidence, Position.parse({ ...f.position, owner: `0x${'1'.repeat(40)}` }), f.frame.block), /position mismatch/);
  await assert.rejects(evaluateCaptures(f.evidence, f.position, { ...f.frame.block, hash: monitorHash('b') }), /stream\/RPC block mismatch/);
  const partial = structuredClone(f.evidence);
  partial.graphResponse = { errors: ['graphql-error'], data: null };
  const next = await evaluateCaptures(partial, f.position, f.frame.block);
  assert.equal(next.summary.status, 'incomplete');
  const first = await advance(f.state, f.frame, f.evaluate);
  const degraded = await advance(first.state, { ...f.frame, block: { ...f.frame.block, number: String(BigInt(f.frame.block.number) + 1n) } }, async () => next);
  assert.ok(degraded.emitted[0]!.reasons.includes('evidence-changed'));
  assert.equal(degraded.emitted[0]!.summary!.metric, 'unavailable');
});

test('undo to a filtered-out block retains the previous observation; older duplicates cannot rewind the cursor', async () => {
  const f = await monitorFixture();
  const first = await advance(f.state, f.frame, f.evaluate);
  const later = { ...f.frame, cursor: 'later', events: [], block: {
    number: String(BigInt(f.frame.block.number) + 3n), hash: monitorHash('c'),
  } };
  const next = await advance(first.state, later, f.evaluate);
  const duplicate = await advance(next.state, f.frame, f.evaluate);
  assert.equal(duplicate.state.cursor, 'later');
  const undo = await advance(next.state, { type: 'undo', cursor: 'gap', block: {
    number: String(BigInt(f.frame.block.number) + 1n), hash: monitorHash('b'),
  } }, f.evaluate);
  assert.deepEqual(currentSummary(undo.state), currentSummary(first.state));
  assert.equal(undo.state.history.at(-1)!.block.hash, monitorHash('b'));
  assert.deepEqual(undo.emitted[0]!.invalidated, []);
});

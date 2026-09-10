import { MORPHO_BLUE_ETHEREUM } from '../../adapters/src/morpho-blue.js';
import { evidenceDigest } from '../../sources/src/recorded.js';
import { Frame, currentSummary } from './model.js';
import type { State, Summary, Alert } from './model.js';

export type Evaluation = { summary: Summary; evidence: unknown };
export type Evaluate = (block: Extract<Frame, { type: 'block' }>['block']) => Promise<Evaluation>;

function changed(before: Summary | null, after: Summary): string[] {
  if (!before) return ['initial-observation'];
  const reasons: string[] = [];
  if (before.shares !== after.shares) reasons.push('shares-changed');
  if (before.allocationDigest !== after.allocationDigest) reasons.push('allocation-changed');
  if (before.fee !== after.fee) reasons.push('fee-changed');
  if (before.status !== after.status || JSON.stringify(before.findings) !== JSON.stringify(after.findings)) reasons.push('evidence-changed');
  return reasons;
}

/** A transition has no persistence or notification side effects. Failed reads leave the cursor untouched. */
export async function advance(input: State, raw: unknown, evaluate: Evaluate) {
  const frame = Frame.parse(raw);
  const state = structuredClone(input);
  const emitted: Alert[] = [];
  const tip = state.history.at(-1)?.block ?? state.base;
  const emit = (kind: Alert['kind'], reasons: string[], invalidated: string[], summary: Summary | null) => {
    const alert: Alert = { id: `${state.scope}:${++state.sequence}`, kind, block: frame.block, reasons, invalidated, summary };
    state.alerts = [...state.alerts, alert].slice(-256);
    emitted.push(alert);
    return alert.id;
  };

  if (frame.type === 'undo') {
    const height = BigInt(frame.block.number);
    if (height < BigInt(state.base.number) || height > BigInt(tip.number)) throw new Error('Undo is outside retained monitor history');
    const known = state.history.find(entry => entry.block.number === frame.block.number)?.block
      ?? (state.base.number === frame.block.number ? state.base : undefined);
    if (known?.hash && known.hash !== frame.block.hash) throw new Error('Undo ancestor hash does not match retained history');
    if (state.base.number === frame.block.number && !state.base.hash) state.base.hash = frame.block.hash;
    const removed = state.history.filter(entry => BigInt(entry.block.number) > height);
    state.history = state.history.filter(entry => BigInt(entry.block.number) <= height);
    const summary = currentSummary(state);
    if (removed.length) emit('undo', ['orphaned-observations'], removed.flatMap(entry => entry.alertId ? [entry.alertId] : []), summary);
    // An undo may point to a block omitted by the upstream event filter.
    if (!known) state.history.push({ block: frame.block, eventDigest: '', summary, alertId: null });
    state.cursor = frame.cursor;
    return { state, emitted, evidence: undefined };
  }

  if (BigInt(frame.block.number) < BigInt(state.startBlock)) throw new Error('Stream block precedes configured start');
  const ids = new Map(frame.events.map(event => [
    `${state.position.chainId}:${frame.block.hash}:${event.transactionHash}:${event.logIndex}`, event,
  ]));
  if (ids.size !== frame.events.length) {
    for (const event of frame.events) {
      const key = `${state.position.chainId}:${frame.block.hash}:${event.transactionHash}:${event.logIndex}`;
      if (ids.get(key)!.address !== event.address) throw new Error('Conflicting duplicate event identity');
    }
  }
  const events = [...ids.entries()].sort(([a], [b]) => a.localeCompare(b));
  const eventDigest = evidenceDigest(events);
  const previous = state.history.find(entry => entry.block.number === frame.block.number);
  if (previous) {
    if (previous.block.hash !== frame.block.hash || previous.eventDigest !== eventDigest) throw new Error('Conflicting block replay requires an undo first');
    if (frame.block.number === tip.number) state.cursor = frame.cursor;
    return { state, emitted, evidence: undefined };
  }
  if (BigInt(frame.block.number) <= BigInt(tip.number)) throw new Error('Out-of-order block requires an undo first');

  const relevant = events.some(([, event]) => [state.position.vault, MORPHO_BLUE_ETHEREUM].includes(event.address));
  let summary = currentSummary(state);
  let evidence: unknown;
  let alertId: string | null = null;
  if (relevant) {
    const result = await evaluate(frame.block);
    const reasons = changed(summary, result.summary);
    summary = result.summary;
    evidence = result.evidence;
    if (reasons.length) alertId = emit('change', reasons, [], summary);
  }
  state.history.push({ block: frame.block, eventDigest, summary, alertId });
  if (state.history.length > 128) {
    const oldest = state.history.shift()!;
    state.base = { ...oldest.block, summary: oldest.summary };
  }
  state.cursor = frame.cursor;
  return { state, emitted, evidence };
}

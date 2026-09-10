import { setTimeout as delay } from 'node:timers/promises';
import { advance } from './engine.js';
import type { Evaluate } from './engine.js';
import type { State, Frame, Alert } from './model.js';
import type { openStore } from './store.js';

type Store = Awaited<ReturnType<typeof openStore>>;
type Stream = (cursor: string, start: string, stop: string | undefined, signal: AbortSignal) => AsyncIterable<Frame>;

export async function runMonitor(store: Store, stream: Stream, evaluate: Evaluate,
  options: { signal: AbortSignal; maxBlocks: number; stopBlock?: string }, emit: (alerts: Alert[]) => void) {
  let state: State = store.state;
  let processed = 0;
  let failures = 0;
  while (!options.signal.aborted && processed < options.maxBlocks) {
    const iterator = stream(state.cursor, state.startBlock, options.stopBlock, options.signal)[Symbol.asyncIterator]();
    try {
      while (!options.signal.aborted && processed < options.maxBlocks) {
        let item: IteratorResult<Frame>;
        try {
          item = await iterator.next();
          if (item.done && !options.stopBlock && !options.signal.aborted) throw new Error('Unexpected stream end');
        } catch {
          if (options.signal.aborted) return state;
          if (++failures > 5) throw new Error('Substreams reconnect budget exhausted; restart from the saved checkpoint');
          await delay(Math.min(1000 * 2 ** (failures - 1), 16000), undefined, { signal: options.signal });
          break;
        }
        if (item.done) return state;
        if (item.value.type === 'block' && options.stopBlock && BigInt(item.value.block.number) >= BigInt(options.stopBlock)) {
          throw new Error('Provider returned a block outside the requested range');
        }
        // Acquisition, validation and disk failures deliberately propagate without skipping the block.
        const next = await advance(state, item.value, evaluate);
        await store.commit(next.state, next.evidence);
        state = next.state;
        failures = 0;
        if (item.value.type === 'block') processed++;
        emit(next.emitted);
      }
    } finally { await iterator.return?.(); }
  }
  return state;
}

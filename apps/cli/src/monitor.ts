import { resolve } from 'node:path';
import { z } from 'zod/v4';
import { allowOptions, required, integer, type CliValues } from './args.js';
import { configFromEnv } from '../../../packages/service/src/index.js';
import { readJsonFile } from '../../../packages/sources/src/snapshot.js';
import { evidenceDigest } from '../../../packages/sources/src/recorded.js';
import { eventStream, loadEventPackage, SUBSTREAM_PACKAGE } from '../../../packages/sources/src/substreams.js';
import { Frame, Height, Position, initialState, currentSummary } from '../../../packages/monitor/src/model.js';
import { advance } from '../../../packages/monitor/src/engine.js';
import { evaluateCaptures, liveEvaluator } from '../../../packages/monitor/src/evaluate.js';
import { loadState, openStore } from '../../../packages/monitor/src/store.js';
import { runMonitor } from '../../../packages/monitor/src/worker.js';

const Recording = z.strictObject({ version: z.literal(1), sourceMode: z.literal('recorded-substreams'),
  position: Position, startBlock: Height, frames: z.array(z.strictObject({ frame: Frame, evidence: z.unknown().optional() })).max(1000) });

export async function runMonitorCommand(positionals: string[], values: CliValues): Promise<number> {
  const action = positionals[1];
  if (action === 'replay') {
    allowOptions(values, positionals, [], 3);
    const recording = Recording.parse(await readJsonFile(required(positionals[2], 'recording path'), 16 * 1024 * 1024));
    let state = initialState(recording.position, recording.startBlock, 'recorded-substreams', 'offline-replay');
    for (const item of recording.frames) {
      const next = await advance(state, item.frame, block => evaluateCaptures(item.evidence, recording.position, block));
      state = next.state;
    }
    console.log(JSON.stringify({ sourceMode: state.sourceMode, position: state.position,
      alerts: state.alerts, summary: currentSummary(state), cursor: state.cursor }));
    return currentSummary(state)?.status === 'matched' ? 0 : 2;
  }
  if (action === 'status') {
    allowOptions(values, positionals, ['home'], 2);
    const state = await loadState(resolve(required(values.home, '--home')));
    console.log(JSON.stringify({ sourceMode: state.sourceMode, position: state.position, cursor: state.cursor,
      block: state.history.at(-1)?.block ?? state.base, summary: currentSummary(state), alerts: state.alerts }));
    return 0;
  }
  if (action !== 'run') throw new Error('Unknown monitor command; use --help');
  allowOptions(values, positionals, ['home', 'address', 'vault', 'block-number', 'stop-block-number', 'max-blocks', 'spkg'], 2);
  const position = Position.parse({ chainId: 1, owner: required(values.address, '--address'), vault: required(values.vault, '--vault') });
  const start = Height.parse(required(values['block-number'], '--block-number'));
  const stop = values['stop-block-number'] === undefined ? undefined : Height.parse(values['stop-block-number']);
  if (stop && BigInt(stop) <= BigInt(start)) throw new Error('--stop-block-number must exceed --block-number (exclusive end)');
  const maxBlocks = integer(values['max-blocks'] ?? '1000', '--max-blocks');
  if (maxBlocks > 100000) throw new Error('--max-blocks must not exceed 100000');
  const config = configFromEnv();
  const evaluate = liveEvaluator(position, config);
  const loaded = await loadEventPackage(required(values.spkg, '--spkg'), position);
  const endpoint = process.env.TARE_SUBSTREAMS_URL ?? 'https://mainnet.eth.streamingfast.io';
  const stream = eventStream(loaded, endpoint, process.env.SUBSTREAMS_API_TOKEN ?? '');
  const initial = initialState(position, start, 'live-substreams', { package: SUBSTREAM_PACKAGE.sha256,
    filter: loaded.filter, provider: evidenceDigest({ endpoint, rpc: config.rpcUrl, graph: config.graphUrl }), deployment: config.expectedDeployment });
  const store = await openStore(resolve(required(values.home, '--home')), initial);
  const controller = new AbortController();
  const stopWorker = () => controller.abort();
  process.once('SIGINT', stopWorker);
  process.once('SIGTERM', stopWorker);
  try {
    const state = await runMonitor(store, stream, evaluate, { signal: controller.signal, maxBlocks,
      ...(stop ? { stopBlock: stop } : {}) }, alerts => {
      for (const alert of alerts) console.log(JSON.stringify({ sourceMode: 'live-substreams', ...alert }));
    });
    return currentSummary(state)?.status === 'matched' ? 0 : 2;
  } catch (error) { if (!controller.signal.aborted) throw error; return 0; }
  finally {
    process.removeListener('SIGINT', stopWorker);
    process.removeListener('SIGTERM', stopWorker);
    await store.close();
  }
}

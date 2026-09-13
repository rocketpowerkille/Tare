import { writeFile } from 'node:fs/promises';
import { integerOption, required, stringOption, type Values } from './args.js';
import { readJsonFile } from '../../../packages/sources/src/snapshot.js';
import { HISTORICAL_VAULT, replayHistoricalGraph, verifyHistoricalGraph } from '../../../packages/verification/src/historical-graph.js';

export async function runHistoricalGraphCommand(positionals: string[], values: Values): Promise<number> {
  const replay = positionals[1] === 'historical-replay';
  const allowed = replay ? ['json', 'out'] : ['json', 'out', 'address', 'rpc-url', 'block-number', 'timeout-ms'];
  for (const key of Object.keys(values)) if (!allowed.includes(key)) throw new Error(`Unsupported historical option --${key}`);
  if (positionals.length !== (replay ? 3 : 2)) throw new Error('Unexpected or missing historical verification arguments');
  const result = replay
    ? await replayHistoricalGraph(await readJsonFile(positionals[2]!))
    : await verifyHistoricalGraph({
      owner: required(stringOption(values, 'address'), '--address'), vault: HISTORICAL_VAULT,
      rpcUrl: required(stringOption(values, 'rpc-url') ?? process.env.TARE_RPC_URL, 'TARE_RPC_URL'),
      graphUrl: required(process.env.TARE_GRAPH_HISTORICAL_URL, 'TARE_GRAPH_HISTORICAL_URL'),
      expectedDeployment: required(process.env.TARE_GRAPH_HISTORICAL_DEPLOYMENT, 'TARE_GRAPH_HISTORICAL_DEPLOYMENT'),
      ...(values['block-number'] ? { blockNumber: stringOption(values, 'block-number')! } : {}),
      timeoutMs: integerOption(values, 'timeout-ms', 10000),
    }, process.env.GRAPH_API_KEY);
  const path = stringOption(values, 'out');
  if (path) await writeFile(path, `${JSON.stringify(result.capture, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(values.json ? JSON.stringify(result, null, 2) : [
    `Tare | historical Graph verification | ${result.sourceMode} | ${result.status}`,
    `Block: ${result.checkedBlock ?? 'unavailable'}; block time: ${result.checkedAt ?? 'unavailable'}`,
    `Share comparisons: ${result.shares?.checks.length ?? 0}; accounting comparisons: ${result.accounting.checks.length}`,
    ...result.findings.map(finding => `Finding: ${finding}`),
    'Historical evidence only. Current state, backing and solvency are not verified; not executable.',
  ].join('\n'));
  return result.status === 'matched' ? 0 : 2;
}

import { writeFile } from 'node:fs/promises';
import { integerOption, required, stringOption } from './args.js';
import type { Values } from './args.js';
import { readJsonFile } from '../../../packages/sources/src/snapshot.js';
import { replayAccounting, verifyAccounting } from '../../../packages/verification/src/accounting.js';

export async function runAccountingCommand(positionals: string[], values: Values): Promise<number> {
  const replay = positionals[1] === 'accounting-replay';
  const allowed = replay ? ['json', 'out'] : ['json', 'out', 'vault', 'rpc-url', 'graph-url', 'graph-deployment', 'block-number', 'timeout-ms'];
  for (const key of Object.keys(values)) if (!allowed.includes(key)) throw new Error(`Unsupported accounting option --${key}`);
  if (positionals.length !== (replay ? 3 : 2)) throw new Error('Unexpected or missing accounting arguments');
  const deployment = stringOption(values, 'graph-deployment') ?? process.env.TARE_GRAPH_DEPLOYMENT;
  const result = replay
    ? await replayAccounting(await readJsonFile(positionals[2]!, 10 * 1024 * 1024))
    : await verifyAccounting({
      vault: required(stringOption(values, 'vault'), '--vault'),
      rpcUrl: required(stringOption(values, 'rpc-url') ?? process.env.TARE_RPC_URL, '--rpc-url or TARE_RPC_URL'),
      graphUrl: required(stringOption(values, 'graph-url') ?? process.env.TARE_GRAPH_URL, '--graph-url or TARE_GRAPH_URL'),
      ...(deployment ? { expectedDeployment: deployment } : {}),
      ...(values['block-number'] ? { blockNumber: stringOption(values, 'block-number')! } : {}),
      timeoutMs: integerOption(values, 'timeout-ms', 10000),
    }, process.env.GRAPH_API_KEY);
  const path = stringOption(values, 'out');
  if (path) await writeFile(path, `${JSON.stringify(result.capture, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(values.json ? JSON.stringify(result, null, 2) : [
    `Tare | underlying accounting verification | ${result.sourceMode} | ${result.status}`,
    `Checks: ${result.checks.length}; mismatches: ${result.checks.filter(check => check.status === 'mismatch').length}`,
    ...result.findings.map(finding => `Finding: ${finding}`),
    'Raw accounting agreement does not establish independent backing or solvency.',
  ].join('\n'));
  return result.status === 'matched' ? 0 : 2;
}

import { writeFile } from 'node:fs/promises';
import { integerOption, required, stringOption } from './args.js';
import type { Values } from './args.js';
import { readJsonFile } from '../../../packages/sources/src/snapshot.js';
import { replayGraphComposition, verifyGraphComposition } from '../../../packages/verification/src/graph-composition.js';

export async function runGraphCompositionCommand(positionals: string[], values: Values): Promise<number> {
  const replay = positionals[1] === 'graph-replay';
  const allowed = replay ? ['json', 'out']
    : ['json', 'out', 'address', 'vault', 'rpc-url', 'graph-url', 'graph-deployment', 'token-api-url', 'timeout-ms'];
  for (const key of Object.keys(values)) if (!allowed.includes(key)) throw new Error(`Unsupported Graph composition option --${key}`);
  if (positionals.length !== (replay ? 3 : 2)) throw new Error('Unexpected or missing Graph composition arguments');
  const result = replay
    ? await replayGraphComposition(await readJsonFile(positionals[2]!, 16 * 1024 * 1024))
    : await verifyGraphComposition({
      owner: required(stringOption(values, 'address'), '--address'),
      vault: required(stringOption(values, 'vault'), '--vault'),
      rpcUrl: required(stringOption(values, 'rpc-url') ?? process.env.TARE_RPC_URL, '--rpc-url or TARE_RPC_URL'),
      graphUrl: required(stringOption(values, 'graph-url') ?? process.env.TARE_GRAPH_URL, '--graph-url or TARE_GRAPH_URL'),
      tokenApiUrl: stringOption(values, 'token-api-url') ?? process.env.TARE_GRAPH_TOKEN_API_URL ?? 'https://token-api.thegraph.com',
      ...((stringOption(values, 'graph-deployment') ?? process.env.TARE_GRAPH_DEPLOYMENT)
        ? { expectedDeployment: stringOption(values, 'graph-deployment') ?? process.env.TARE_GRAPH_DEPLOYMENT! } : {}),
      timeoutMs: integerOption(values, 'timeout-ms', 10000),
    }, required(process.env.GRAPH_MARKET_API_TOKEN, 'GRAPH_MARKET_API_TOKEN'), process.env.GRAPH_API_KEY);
  const path = stringOption(values, 'out');
  if (path) await writeFile(path, `${JSON.stringify(result.capture, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(values.json ? JSON.stringify(result, null, 2) : [
    `Tare | Graph product composition | ${result.sourceMode} | ${result.status}`,
    `Token API shares: ${result.checks.tokenApiAmountRaw ?? 'unavailable'}`,
    `Same-block RPC shares: ${result.checks.rpcAmountRaw ?? 'unavailable'}`,
    `Studio accounting: ${result.checks.accountingStatus}; ${result.checks.accountingReads} reads`,
    ...result.findings.map(finding => `Finding: ${finding}`),
    'Scope: wallet vault-share balance and vault accounting. Independent backing and valuation remain unverified.',
  ].join('\n'));
  return result.status === 'matched' ? 0 : 2;
}

import { writeFile } from 'node:fs/promises';
import { required, integerOption, stringOption } from './args.js';
import type { Values } from './args.js';
import { readJsonFile } from '../../../packages/sources/src/snapshot.js';
import { replayNestedCapture, resolveNestedPosition } from '../../../packages/resolver/src/nested.js';

export async function runNestedCommand(positionals: string[], values: Values): Promise<number> {
  const replay = positionals[1] === 'nested-replay';
  const allowed = replay ? ['json', 'out'] : ['json', 'out', 'address', 'vault', 'rpc-url', 'timeout-ms', 'block-number'];
  for (const key of Object.keys(values)) if (!allowed.includes(key)) throw new Error(`Unsupported nested option --${key}`);
  if (positionals.length !== (replay ? 3 : 2)) throw new Error('Unexpected or missing nested arguments');
  const result = replay
    ? await replayNestedCapture(await readJsonFile(positionals[2]!, 10 * 1024 * 1024))
    : await resolveNestedPosition({
      owner: required(stringOption(values, 'address'), '--address'),
      vault: required(stringOption(values, 'vault'), '--vault'),
      rpcUrl: required(stringOption(values, 'rpc-url') ?? process.env.TARE_RPC_URL, '--rpc-url or TARE_RPC_URL'),
      timeoutMs: integerOption(values, 'timeout-ms', 10000),
      ...(values['block-number'] ? { blockNumber: stringOption(values, 'block-number')! } : {}),
    });
  const path = stringOption(values, 'out');
  if (path) await writeFile(path, `${JSON.stringify(result.capture, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(values.json ? JSON.stringify(result, null, 2) : [
    `Tare | nested Morpho exposure | ${result.sourceMode} | ${result.status}`,
    `Economic layers: ${result.analysis?.economicLayers ?? 'unavailable'}`,
    `Root claim: ${result.analysis?.quoteRaw ?? 'unavailable'} raw USDC`,
    ...(result.analysis?.branches.map(branch => `${branch.adapter} -> ${branch.vault ?? 'unexpanded zero allocation'}; ${branch.markets.length} markets`) ?? []),
    ...result.findings.map(finding => `Finding: ${finding}`),
    'Accounting exposure only; lending backing is unverified and the metric is unavailable.',
  ].join('\n'));
  return result.status === 'complete' ? 0 : 2;
}

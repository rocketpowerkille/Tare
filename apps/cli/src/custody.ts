import { writeFile } from 'node:fs/promises';
import { integerOption, required, stringOption } from './args.js';
import type { Values } from './args.js';
import { readJsonFile } from '../../../packages/sources/src/snapshot.js';
import { replayCustody, verifyWethCustody } from '../../../packages/verification/src/custody.js';

export async function runCustodyCommand(positionals: string[], values: Values): Promise<number> {
  const replay = positionals[1] === 'custody-replay';
  const allowed = replay ? ['json', 'out'] : ['json', 'out', 'address', 'rpc-url', 'secondary-rpc-url', 'block-number', 'timeout-ms'];
  for (const key of Object.keys(values)) if (!allowed.includes(key)) throw new Error(`Unsupported custody option --${key}`);
  if (positionals.length !== (replay ? 3 : 2)) throw new Error('Unexpected or missing custody arguments');
  const result = replay
    ? await replayCustody(await readJsonFile(positionals[2]!))
    : await verifyWethCustody({
      owner: required(stringOption(values, 'address'), '--address'),
      rpcUrl: required(stringOption(values, 'rpc-url') ?? process.env.TARE_RPC_URL, '--rpc-url or TARE_RPC_URL'),
      secondaryRpcUrl: required(stringOption(values, 'secondary-rpc-url') ?? process.env.TARE_SECONDARY_RPC_URL, '--secondary-rpc-url or TARE_SECONDARY_RPC_URL'),
      ...(values['block-number'] ? { blockNumber: stringOption(values, 'block-number')! } : {}),
      timeoutMs: integerOption(values, 'timeout-ms', 10000),
    });
  const path = stringOption(values, 'out');
  if (path) await writeFile(path, `${JSON.stringify(result.capture, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(values.json ? JSON.stringify(result, null, 2) : [
    `Tare | WETH native custody | ${result.sourceMode} | ${result.status}`,
    result.metric.kind === 'available' ? 'Scoped WETH wrapper claim multiple: 1.000000x' : `Metric unavailable: ${result.findings.join(', ')}`,
    'Scope: the WETH wrapper only; other holder liabilities are excluded. Provider independence is not proven.',
  ].join('\n'));
  return result.status === 'matched' ? 0 : 2;
}

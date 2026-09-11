import { writeFile } from 'node:fs/promises';
import { integerOption, required, stringOption } from './args.js';
import type { Values } from './args.js';
import { readJsonFile } from '../../../packages/sources/src/snapshot.js';
import { BaseSepoliaCustodyDeploymentSchema } from '../../../packages/verification/src/base-sepolia-custody-capture.js';
import { replayBaseSepoliaCustody, verifyBaseSepoliaCustody } from '../../../packages/verification/src/base-sepolia-custody.js';

export async function runBaseCustodyCommand(positionals: string[], values: Values): Promise<number> {
  const replay = positionals[1] === 'base-custody-replay';
  const allowed = replay ? ['json', 'out']
    : ['json', 'out', 'address', 'deployment', 'rpc-url', 'secondary-rpc-url', 'block-number', 'timeout-ms'];
  for (const key of Object.keys(values)) if (!allowed.includes(key)) throw new Error(`Unsupported base custody option --${key}`);
  if (positionals.length !== (replay ? 3 : 2)) throw new Error('Unexpected or missing base custody arguments');
  const result = replay
    ? await replayBaseSepoliaCustody(await readJsonFile(positionals[2]!))
    : await verifyBaseSepoliaCustody({
      owner: required(stringOption(values, 'address'), '--address'),
      deployment: BaseSepoliaCustodyDeploymentSchema.parse(await readJsonFile(
        required(stringOption(values, 'deployment'), '--deployment'),
      )),
      rpcUrl: required(stringOption(values, 'rpc-url') ?? process.env.TARE_BASE_RPC_URL,
        '--rpc-url or TARE_BASE_RPC_URL'),
      secondaryRpcUrl: required(stringOption(values, 'secondary-rpc-url') ?? process.env.TARE_BASE_SECONDARY_RPC_URL,
        '--secondary-rpc-url or TARE_BASE_SECONDARY_RPC_URL'),
      ...(values['block-number'] ? { blockNumber: stringOption(values, 'block-number')! } : {}),
      timeoutMs: integerOption(values, 'timeout-ms', 10000),
    });
  const path = stringOption(values, 'out');
  if (path) await writeFile(path, `${JSON.stringify(result.capture, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(values.json ? JSON.stringify(result, null, 2) : [
    `Tare | Base Sepolia two-layer custody | ${result.sourceMode} | ${result.status}`,
    result.metric.kind === 'available'
      ? `Verified gross-claim multiple: ${result.metric.multipleMillionths.slice(0, -6)}.${result.metric.multipleMillionths.slice(-6)}x`
      : `Metric unavailable: ${result.findings.join(', ')}`,
    'Scope: allowlisted Base Sepolia control contracts at one confirmed block across two RPC hosts.',
  ].join('\n'));
  return result.status === 'matched' ? 0 : 2;
}

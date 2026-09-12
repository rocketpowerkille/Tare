import { stringOption as value } from './args.js';
import type { Values } from './args.js';
import { writeFile } from 'node:fs/promises';
import { readJsonFile } from '../../../packages/sources/src/snapshot.js';
import { replayShareVerification, ShareVerificationReportSchema, verifyShares } from '../../../packages/verification/src/shares.js';
import { runAccountingCommand } from './accounting.js';
import { runCustodyCommand } from './custody.js';
import { runBaseCustodyCommand } from './base-custody.js';
import { runGraphCompositionCommand } from './graph-composition.js';

function required(input: string | undefined, name: string): string {
  if (!input) throw new Error(`Missing ${name}`); return input;
}
export async function runVerifyCommand(positionals: string[], values: Values): Promise<number> {
  const action = positionals[1];
  if (action === 'accounting' || action === 'accounting-replay') return runAccountingCommand(positionals, values);
  if (action === 'custody' || action === 'custody-replay') return runCustodyCommand(positionals, values);
  if (action === 'base-custody' || action === 'base-custody-replay') return runBaseCustodyCommand(positionals, values);
  if (action === 'graph-products' || action === 'graph-replay') return runGraphCompositionCommand(positionals, values);
  if (!['shares', 'replay'].includes(action ?? '')) throw new Error('Use verify shares or verify replay');
  const allowed = action === 'replay' ? ['json', 'out'] : ['json', 'out', 'address', 'vault', 'rpc-url', 'graph-url', 'graph-deployment', 'block-number', 'timeout-ms'];
  for (const option of Object.keys(values)) if (!allowed.includes(option)) throw new Error(`Unsupported verify option --${option}`);
  if (positionals.length !== (action === 'replay' ? 3 : 2)) throw new Error('Unexpected or missing verification arguments');
  let result;
  if (action === 'replay') {
    const previous = ShareVerificationReportSchema.parse(await readJsonFile(positionals[2]!));
    result = replayShareVerification(previous.capture);
  } else {
    const timeout = value(values, 'timeout-ms') ?? '10000';
    if (!/^[1-9][0-9]*$/.test(timeout)) throw new Error('--timeout-ms requires a positive integer');
    result = await verifyShares({
      owner: required(value(values, 'address'), '--address'), vault: required(value(values, 'vault'), '--vault'),
      rpcUrl: required(value(values, 'rpc-url') ?? process.env.TARE_RPC_URL, '--rpc-url or TARE_RPC_URL'),
      graphUrl: required(value(values, 'graph-url') ?? process.env.TARE_GRAPH_URL, '--graph-url or TARE_GRAPH_URL'),
      ...(values['block-number'] ? { blockNumber: value(values, 'block-number')! } : {}),
      ...((values['graph-deployment'] ?? process.env.TARE_GRAPH_DEPLOYMENT) ? { expectedDeployment: value(values, 'graph-deployment') ?? process.env.TARE_GRAPH_DEPLOYMENT! } : {}),
      timeoutMs: Number(timeout),
    }, process.env.GRAPH_API_KEY);
  }
  const path = value(values, 'out');
  if (path) await writeFile(path, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(values.json ? JSON.stringify(result, null, 2) : [
    `Tare | share ledger verification | ${result.sourceMode} | ${result.status}`,
    `Vault: ${result.capture.vault}; owner: ${result.capture.owner}`,
    `Block: ${result.capture.rpc.block ? BigInt(result.capture.rpc.block.number) : 'unavailable'}`,
    `Graph deployment: ${result.capture.graph?.data._meta.deployment ?? 'unavailable'}`,
    ...result.checks.map(check => `${check.field}: ${check.status}; RPC=${check.rpc}; Graph=${check.graph}`),
    ...result.findings.map(finding => `Finding [${finding.code}]: ${finding.stage}`),
    'Scope: share ledger agreement only. Backing and valuation remain unverified; metric unavailable.',
  ].join('\n'));
  return result.status === 'matched' ? 0 : 2;
}

import { stringOption as string, integerOption as integer } from './args.js';
import type { Values } from './args.js';
import { renderLiveReceipt } from '../../../packages/receipts/src/live.js';
export { renderLiveReceipt } from '../../../packages/receipts/src/live.js';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LiveReceiptSchema } from '../../../packages/domain/src/live.js';
import type { LiveReceipt } from '../../../packages/domain/src/live.js';
import { MorphoDiscovery } from '../../../packages/sources/src/morpho.js';
import { readJsonFile } from '../../../packages/sources/src/snapshot.js';
import { getWallet } from '../../../packages/wallet/src/index.js';
import { PUBLIC_EXAMPLE_VAULT } from '../../../packages/adapters/src/morpho-blue.js';
import { LiveOptionsSchema, replayLiveCapture, resolveLivePosition } from '../../../packages/resolver/src/live.js';
import { validateHttpUrl } from '../../../packages/sources/src/http.js';

async function output(result: LiveReceipt, values: Values): Promise<number> {
  const validated = LiveReceiptSchema.parse(result);
  const receiptPath = string(values, 'out'); const capturePath = string(values, 'capture-out');
  if (receiptPath && capturePath && resolve(receiptPath).toLowerCase() === resolve(capturePath).toLowerCase()) throw new Error('Receipt and capture output paths must differ');
  if (capturePath) await writeFile(capturePath, `${JSON.stringify(validated.capture, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  if (receiptPath) await writeFile(receiptPath, `${JSON.stringify(validated, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(values.json ? JSON.stringify(validated, null, 2) : renderLiveReceipt(validated));
  return result.kind === 'partial' ? 2 : 0;
}
export async function runLiveCommand(positionals: string[], values: Values): Promise<number> {
  const action = positionals[1];
  const common = ['json', 'out', 'capture-out', 'max-markets'];
  const allowed = action === 'replay' ? common
    : ['address', 'wallet', 'home', 'chain-id', 'vault', 'graphql-url', 'timeout-ms', ...(action === 'resolve' ? [] : ['max-positions']),
      ...(action === 'discover' ? ['json'] : [...common, 'rpc-url', 'block-number', 'max-calls', 'deadline-ms'])];
  for (const key of Object.keys(values)) if (!allowed.includes(key)) throw new Error(`Option --${key} is not supported for live ${action ?? ''}`);
  if (positionals.length > (action === 'replay' ? 3 : 2)) throw new Error('Unexpected live command arguments');
  if (action === 'replay') {
    const path = positionals[2]; if (!path) throw new Error('live replay requires a capture path');
    return output(await replayLiveCapture(await readJsonFile(path, 10 * 1024 * 1024), { maxMarkets: integer(values, 'max-markets', 32) }), values);
  }
  if (!['discover', 'resolve', 'example'].includes(action ?? '')) throw new Error('Unknown live command; use --help');
  const walletName = string(values, 'wallet');
  if (walletName && values.address) throw new Error('Select either --wallet or --address');
  if (values.home && !walletName) throw new Error('--home requires --wallet');
  const wallet = walletName ? await getWallet(resolve(string(values, 'home') ?? process.env.TARE_HOME ?? '.tare'), walletName) : null;
  const chainId = integer(values, 'chain-id', wallet?.chainId ?? 1);
  if (chainId !== 1 || (wallet && wallet.chainId !== chainId)) throw new Error('This live adapter supports Ethereum mainnet (chain 1) only');
  const graphqlUrl = string(values, 'graphql-url');
  const timeoutMs = integer(values, 'timeout-ms', 10000);
  if (timeoutMs < 100 || timeoutMs > 60000) throw new Error('--timeout-ms must be between 100 and 60000');
  const client = new MorphoDiscovery(graphqlUrl, timeoutMs);
  let owner = wallet?.address ?? string(values, 'address');
  const vault = string(values, 'vault') ?? (action === 'example' ? PUBLIC_EXAMPLE_VAULT : undefined);
  if (action === 'discover') {
    const result = await client.positions({ chainId, ...(owner ? { owner } : {}), ...(vault ? { vault } : {}), maxPositions: integer(values, 'max-positions', 100) });
    console.log(values.json ? JSON.stringify({ ...result, health: client.health }, null, 2) : [
      `Discovery: ${result.positions.length} indexed Morpho V1 positions; ${result.complete ? 'complete within index scope' : 'incomplete'}`,
      ...result.positions.map(position => `${position.owner} -> ${position.vault}; indexed shares=${position.reportedSharesRaw ?? 'unavailable'}`),
      ...result.issues.map(issue => `Finding: ${issue}`),
      'Index discovery is not block-aligned and does not prove absence of other positions.',
    ].join('\n'));
    return result.complete ? 0 : 2;
  }
  if (!vault) throw new Error('live resolve requires --vault');
  const rpcUrl = string(values, 'rpc-url') ?? process.env.TARE_RPC_URL;
  if (!rpcUrl) throw new Error('Live resolution requires --rpc-url or TARE_RPC_URL');
  if (action === 'example' && owner) throw new Error('live example selects a public depositor; use live resolve for your wallet');
  if (action === 'resolve' && !owner) throw new Error('live resolve requires --address or --wallet');
  const options = LiveOptionsSchema.parse({ owner: owner ?? `0x${'0'.repeat(40)}`, vault, chainId,
    rpcUrl: validateHttpUrl(rpcUrl), ...(graphqlUrl ? { graphqlUrl } : {}), ...(values['block-number'] ? { blockNumber: string(values, 'block-number')! } : {}),
    timeoutMs, maxMarkets: integer(values, 'max-markets', 32), maxCalls: integer(values, 'max-calls', 250), deadlineMs: integer(values, 'deadline-ms', 120000),
  });
  let discovery = null;
  if (action === 'example') {
    discovery = await client.positions({ chainId, vault, maxPositions: integer(values, 'max-positions', 5) });
    owner = discovery.positions.find(position => position.reportedSharesRaw !== null && BigInt(position.reportedSharesRaw) > 0n)?.owner;
  }
  if (!owner) throw new Error('No owner supplied or funded example depositor discovered');
  return output(await resolveLivePosition({ ...options, owner }, discovery), values);
}

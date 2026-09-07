#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ZodError } from 'zod/v4';
import { loadSnapshot } from '../../../packages/sources/src/snapshot.js';
import { resolveSnapshot } from '../../../packages/resolver/src/index.js';
import { renderReceipt, serializeReceipt, writeReceipt } from '../../../packages/receipts/src/index.js';
import { addWallet, getWallet, listWallets, removeWallet } from '../../../packages/wallet/src/index.js';

const help = `Tare 0.1.0 — offline exposure CLI

  tare demo [control|deep|degraded|cycle|all] [--json]
  tare resolve <snapshot.json> [--wallet <name>] [--json] [--out <receipt.json>]
       [--max-depth <1..128>] [--max-visits <1..100000>]
  tare snapshot validate <snapshot.json>
  tare wallet add <name> --address <0x...> --chain-id <number>
  tare wallet list
  tare wallet show <name>
  tare wallet remove <name>

Wallet commands accept --home <directory>; resolve --wallet does too.
Default profile directory: TARE_HOME or .tare in the current directory.
Watch-only profiles store public addresses only. No chain connections or signing.
Snapshots and demos are synthetic, not live or independently verified evidence.
Exit codes: 0 success; 1 invalid input/I/O; 2 partial resolution.
Output files are created exclusively; existing files are never overwritten.`;

function required(value: string | undefined, label: string): string {
  if (!value) throw new Error(`Missing ${label}; use --help`);
  return value;
}
function integer(value: string | undefined, label: string): number {
  if (!value || !/^[1-9][0-9]*$/.test(value)) throw new Error(`${label} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} exceeds the safe integer range`);
  return parsed;
}
async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true, strict: true,
    options: {
      help: { type: 'boolean', short: 'h' }, json: { type: 'boolean' }, out: { type: 'string' },
      home: { type: 'string' }, address: { type: 'string' }, 'chain-id': { type: 'string' },
      wallet: { type: 'string' }, 'max-depth': { type: 'string' }, 'max-visits': { type: 'string' },
    },
  });
  if (values.help || positionals.length === 0) { console.log(help); return 0; }
  const [command, action, argument] = positionals;
  const home = resolve(values.home ?? process.env.TARE_HOME ?? '.tare');
  function allow(options: string[], maxPositionals: number) {
    for (const key of Object.keys(values)) if (!options.includes(key)) throw new Error(`Option --${key} is not supported for this command`);
    if (positionals.length > maxPositionals) throw new Error('Unexpected positional arguments');
  }
  if (command === 'wallet') {
    allow(action === 'add' ? ['home', 'address', 'chain-id'] : ['home'], action === 'list' ? 2 : 3);
    switch (action) {
      case 'add': console.log(JSON.stringify(await addWallet(home, {
        schemaVersion: 1, mode: 'watch-only', name: required(argument, 'wallet name'),
        address: required(values.address, '--address'), chainId: integer(values['chain-id'], '--chain-id'),
      }), null, 2)); break;
      case 'list': console.log(JSON.stringify(await listWallets(home), null, 2)); break;
      case 'show': console.log(JSON.stringify(await getWallet(home, required(argument, 'wallet name')), null, 2)); break;
      case 'remove': await removeWallet(home, required(argument, 'wallet name')); console.log('Wallet profile removed'); break;
      default: throw new Error('Unknown wallet command; use --help');
    }
    return 0;
  }
  if (command === 'snapshot' && action === 'validate') {
    allow([], 3);
    const snapshot = await loadSnapshot(required(argument, 'snapshot path'));
    console.log(`Valid synthetic snapshot: ${snapshot.name} (${snapshot.nodes.length} nodes)`);
    return 0;
  }
  if (command === 'demo') {
    allow(['json'], 2);
    const names = ['control', 'deep', 'degraded', 'cycle'];
    const selection = action ?? 'all';
    if (selection !== 'all' && !names.includes(selection)) throw new Error('Unknown demo; use --help');
    const receipts = [];
    for (const name of selection === 'all' ? names : [selection]) {
      const path = fileURLToPath(new URL(`../../../../fixtures/synthetic/${name}.json`, import.meta.url));
      receipts.push(resolveSnapshot(await loadSnapshot(path)));
    }
    console.log(values.json ? JSON.stringify(receipts, null, 2) : receipts.map(renderReceipt).join('\n\n'));
    // The demo command succeeds only when its intentional partial cases behave as expected.
    const expected = (name: string) => name === 'degraded' || name === 'cycle' ? 'partial' : 'complete';
    return receipts.every(receipt => receipt.kind === expected(receipt.name)) ? 0 : 1;
  }
  if (command === 'resolve') {
    allow(['wallet', 'home', 'json', 'out', 'max-depth', 'max-visits'], 2);
    if (values.home && !values.wallet) throw new Error('--home requires --wallet for resolve');
    const snapshot = await loadSnapshot(required(action, 'snapshot path'));
    if (values.wallet) {
      const wallet = await getWallet(home, values.wallet);
      if (wallet.address !== snapshot.root.owner || wallet.chainId !== snapshot.chainId) throw new Error('Snapshot owner/network does not match the selected wallet profile');
    }
    const receipt = resolveSnapshot(snapshot, {
      ...(values['max-depth'] ? { maxDepth: integer(values['max-depth'], '--max-depth') } : {}),
      ...(values['max-visits'] ? { maxVisits: integer(values['max-visits'], '--max-visits') } : {}),
    });
    if (values.out) await writeReceipt(values.out, receipt);
    process.stdout.write(values.json ? serializeReceipt(receipt) : `${renderReceipt(receipt)}\n`);
    return receipt.kind === 'partial' ? 2 : 0;
  }
  throw new Error('Unknown command; use --help');
}

try { process.exitCode = await main(); }
catch (error) {
  // Do not echo rejected inputs: users can accidentally paste credentials into an argument.
  const message = error instanceof ZodError
    ? `Validation failed: ${error.issues.map(issue => `${issue.path.join('.') || 'input'}: ${issue.message}`).join('; ')}`
    : error instanceof Error && 'code' in error
      ? `Operation failed (${String(error.code)}); check command options, local paths and existing files`
      : error instanceof Error ? error.message : 'Unknown failure';
  console.error(`tare: ${message}`);
  process.exitCode = 1;
}

#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { ZodError } from 'zod/v4';
import { loadSnapshot, loadInputSnapshot, readJsonFile } from '../../../packages/sources/src/snapshot.js';
import { normalizeRecording } from '../../../packages/adapters/src/index.js';
import { resolveSnapshotV2 } from '../../../packages/resolver/src/v2.js';
import { renderReceiptV2, serializeReceiptV2 } from '../../../packages/receipts/src/v2.js';
import { getNativeBalance } from '../../../packages/sources/src/rpc.js';
import { resolveSnapshot } from '../../../packages/resolver/src/index.js';
import { renderReceipt, serializeReceipt, writeReceipt } from '../../../packages/receipts/src/index.js';
import { addWallet, getWallet, listWallets, removeWallet } from '../../../packages/wallet/src/index.js';

const help = `Tare 0.1.0 — offline exposure CLI

  tare demo [control|deep|degraded|cycle|all|phase2] [--json]
  tare resolve <snapshot.json> [--wallet <name>] [--json] [--out <receipt.json>]
       [--max-depth <1..128>] [--max-visits <1..100000>] [--max-edges <1..100000>]
  tare replay <recording.json> [--wallet <name>] [--json] [--out <receipt.json>]
  tare snapshot normalize <recording.json> --out <snapshot.json>
  tare snapshot validate <snapshot.json>
  tare wallet add <name> --address <0x...> --chain-id <number>
  tare wallet list
  tare wallet show <name>
  tare wallet balance <name> --rpc-url <https://...> [--symbol <symbol>]
       [--decimals <0..36>] [--timeout-ms <100..60000>] [--json]
  tare wallet remove <name>

Wallet commands accept --home <directory>; resolve --wallet does too.
Default profile directory: TARE_HOME or .tare in the current directory.
Watch-only profiles store public addresses only. Balance reads are opt-in and never sign.
RPC URLs may also be supplied through TARE_RPC_URL instead of --rpc-url.
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
function nonnegativeInteger(value: string | undefined, label: string): number {
  if (value === undefined || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`${label} must be a nonnegative integer`);
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
      'rpc-url': { type: 'string' }, symbol: { type: 'string' }, decimals: { type: 'string' },
      'timeout-ms': { type: 'string' },
      'max-edges': { type: 'string' },
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
    allow(
      action === 'add' ? ['home', 'address', 'chain-id']
        : action === 'balance' ? ['home', 'rpc-url', 'symbol', 'decimals', 'timeout-ms', 'json']
          : ['home'],
      action === 'list' ? 2 : 3,
    );
    switch (action) {
      case 'add': console.log(JSON.stringify(await addWallet(home, {
        schemaVersion: 1, mode: 'watch-only', name: required(argument, 'wallet name'),
        address: required(values.address, '--address'), chainId: integer(values['chain-id'], '--chain-id'),
      }), null, 2)); break;
      case 'list': console.log(JSON.stringify(await listWallets(home), null, 2)); break;
      case 'show': console.log(JSON.stringify(await getWallet(home, required(argument, 'wallet name')), null, 2)); break;
      case 'balance': {
        const wallet = await getWallet(home, required(argument, 'wallet name'));
        const result = await getNativeBalance(
          required(values['rpc-url'] ?? process.env.TARE_RPC_URL, '--rpc-url or TARE_RPC_URL'),
          wallet,
          { symbol: values.symbol ?? 'NATIVE', decimals: values.decimals === undefined ? 18 : nonnegativeInteger(values.decimals, '--decimals') },
          { timeoutMs: values['timeout-ms'] === undefined ? 10000 : integer(values['timeout-ms'], '--timeout-ms') },
        );
        console.log(values.json ? JSON.stringify(result, null, 2) : [
          `Native balance: ${result.balance} ${result.asset.symbol} (${result.balanceRaw} raw)`,
          `Address: ${result.address}`,
          `Chain: ${result.chainId}`,
          `Block: ${result.block.number} (${result.block.hash})`,
          'Verification: observed through the supplied EVM JSON-RPC endpoint',
        ].join('\n'));
        break;
      }
      case 'remove': await removeWallet(home, required(argument, 'wallet name')); console.log('Wallet profile removed'); break;
      default: throw new Error('Unknown wallet command; use --help');
    }
    return 0;
  }
  if (command === 'snapshot' && action === 'validate') {
    allow([], 3);
    const snapshot = await loadInputSnapshot(required(argument, 'snapshot path'));
    console.log(`Valid synthetic snapshot: ${snapshot.name} (${snapshot.nodes.length} nodes; schema ${snapshot.schemaVersion})`);
    return 0;
  }
  if (command === 'snapshot' && action === 'normalize') {
    allow(['out'], 3);
    const output = required(values.out, '--out');
    const snapshot = normalizeRecording(await readJsonFile(required(argument, 'recording path')));
    await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(`Normalized synthetic snapshot: ${snapshot.name} (${snapshot.nodes.length} nodes; schema 2)`);
    return 0;
  }
  if (command === 'demo') {
    allow(['json'], 2);
    if (action === 'phase2') {
      const cases = ['multi-asset', 'overlap', 'debt', 'degraded', 'cycle', 'schema-drift'];
      const receipts = [];
      for (const name of cases) {
        const path = fileURLToPath(new URL(`../../../../fixtures/recordings/${name}.json`, import.meta.url));
        receipts.push(resolveSnapshotV2(normalizeRecording(await readJsonFile(path))));
      }
      console.log(values.json ? JSON.stringify(receipts, null, 2) : receipts.map(renderReceiptV2).join('\n\n'));
      return receipts.every(receipt => receipt.kind === (['multi-asset', 'overlap'].includes(receipt.name) ? 'complete' : 'partial')) ? 0 : 1;
    }
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
  if (command === 'resolve' || command === 'replay') {
    allow(['wallet', 'home', 'json', 'out', 'max-depth', 'max-visits', 'max-edges'], 2);
    if (values.home && !values.wallet) throw new Error('--home requires --wallet for resolve');
    const snapshot = command === 'replay'
      ? normalizeRecording(await readJsonFile(required(action, 'recording path')))
      : await loadInputSnapshot(required(action, 'snapshot path'));
    if (values.wallet) {
      const wallet = await getWallet(home, values.wallet);
      const owner = snapshot.schemaVersion === 2 ? snapshot.owner : snapshot.root.owner;
      if (wallet.address !== owner || wallet.chainId !== snapshot.chainId) throw new Error('Snapshot owner/network does not match the selected wallet profile');
    }
    const limits = {
      ...(values['max-depth'] ? { maxDepth: integer(values['max-depth'], '--max-depth') } : {}),
      ...(values['max-visits'] ? { maxVisits: integer(values['max-visits'], '--max-visits') } : {}),
    };
    if (snapshot.schemaVersion === 2) {
      const receipt = resolveSnapshotV2(snapshot, { ...limits, ...(values['max-edges'] ? { maxEdges: integer(values['max-edges'], '--max-edges') } : {}) });
      if (values.out) await writeFile(values.out, serializeReceiptV2(receipt), { flag: 'wx', mode: 0o600 });
      process.stdout.write(values.json ? serializeReceiptV2(receipt) : `${renderReceiptV2(receipt)}\n`);
      return receipt.kind === 'partial' ? 2 : 0;
    }
    if (values['max-edges']) throw new Error('--max-edges requires schema 2');
    const receipt = resolveSnapshot(snapshot, limits);
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

import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { loadInputSnapshot, readJsonFile } from '../../../packages/sources/src/snapshot.js';
import { normalizeRecording } from '../../../packages/adapters/src/index.js';
import { resolveSnapshot } from '../../../packages/resolver/src/index.js';
import { resolveSnapshotV2 } from '../../../packages/resolver/src/v2.js';
import { renderReceipt, serializeReceipt, writeReceipt } from '../../../packages/receipts/src/index.js';
import { renderReceiptV2, serializeReceiptV2 } from '../../../packages/receipts/src/v2.js';
import { getWallet } from '../../../packages/wallet/src/index.js';
import { allowOptions, integer, required } from './args.js';
import type { CliValues } from './args.js';

export async function runSnapshotCommand(positionals: string[], values: CliValues): Promise<number> {
  const [command, action, argument] = positionals;
  const home = resolve(values.home ?? process.env.TARE_HOME ?? '.tare');
  if (command === 'snapshot' && action === 'validate') {
    allowOptions(values, positionals, [], 3);
    const snapshot = await loadInputSnapshot(required(argument, 'snapshot path'));
    console.log(`Valid synthetic snapshot: ${snapshot.name} (${snapshot.nodes.length} nodes; schema ${snapshot.schemaVersion})`);
    return 0;
  }
  if (command === 'snapshot' && action === 'normalize') {
    allowOptions(values, positionals, ['out'], 3);
    const output = required(values.out, '--out');
    const snapshot = normalizeRecording(await readJsonFile(required(argument, 'recording path')));
    await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(`Normalized synthetic snapshot: ${snapshot.name} (${snapshot.nodes.length} nodes; schema 2)`);
    return 0;
  }
  if (command === 'resolve' || command === 'replay') {
    allowOptions(values, positionals, ['wallet', 'home', 'json', 'out', 'max-depth', 'max-visits', 'max-edges'], 2);
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

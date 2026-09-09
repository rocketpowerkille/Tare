import { fileURLToPath } from 'node:url';
import { loadSnapshot, readJsonFile } from '../../../packages/sources/src/snapshot.js';
import { normalizeRecording } from '../../../packages/adapters/src/index.js';
import { resolveSnapshot } from '../../../packages/resolver/src/index.js';
import { resolveSnapshotV2 } from '../../../packages/resolver/src/v2.js';
import { renderReceipt } from '../../../packages/receipts/src/index.js';
import { renderReceiptV2 } from '../../../packages/receipts/src/v2.js';
import { allowOptions } from './args.js';
import type { CliValues } from './args.js';

export async function runDemoCommand(positionals: string[], values: CliValues): Promise<number> {
  const action = positionals[1];
  allowOptions(values, positionals, ['json'], 2);
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

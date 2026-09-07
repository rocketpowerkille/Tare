import { writeFile } from 'node:fs/promises';
import { formatUnits, ReceiptSchema } from '../../domain/src/index.js';
import type { Resolution } from '../../domain/src/index.js';

export function serializeReceipt(receipt: Resolution): string { return `${JSON.stringify(ReceiptSchema.parse(receipt), null, 2)}\n`; }
export async function writeReceipt(path: string, receipt: Resolution): Promise<void> {
  await writeFile(path, serializeReceipt(receipt), { flag: 'wx', mode: 0o600 });
}
export function renderReceipt(receipt: Resolution): string {
  const lines = [
    `Tare | ${receipt.name} | SYNTHETIC / UNVERIFIED`,
    `Resolution: ${receipt.kind}; chain ${receipt.chainId}; block ${receipt.block.number}`,
    `Coverage: ${receipt.coverage.resolvedTerminals} terminal visits, ${receipt.coverage.unresolvedBranches} findings; value coverage unavailable`,
    `Sources (snapshot-declared): ${receipt.sources.map(source => `${source.id}=${source.status}`).join(', ')}`,
    'Terminal token exposures:',
    ...receipt.leaves.map(leaf => `  ${leaf.nodeId}: ${formatUnits(leaf.amountRaw, leaf.decimals)} ${leaf.symbol} (${leaf.amountRaw} raw; unverified)`),
    ...receipt.gaps.map(gap => `Finding [${gap.reason}]: ${gap.path.join(' -> ')}; ${gap.detail}`),
    `Effective collateral multiple: unavailable (${receipt.metric.reasons.join('; ')})`,
  ];
  return lines.join('\n');
}

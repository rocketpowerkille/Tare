import { formatUnits } from '../../domain/src/index.js';
import { ReceiptV2Schema } from '../../domain/src/v2.js';
import type { ResolutionV2 } from '../../domain/src/v2.js';

export function serializeReceiptV2(receipt: ResolutionV2): string {
  return `${JSON.stringify(ReceiptV2Schema.parse(receipt), null, 2)}\n`;
}
export function renderReceiptV2(receipt: ResolutionV2): string {
  return [
    `Tare | ${receipt.name} | SYNTHETIC / UNVERIFIED | schema 2`,
    `Resolution: ${receipt.kind}; ${receipt.positions.length} positions; chain ${receipt.chainId}; block ${receipt.block.number}`,
    `Coverage: ${receipt.coverage.visits} visits; ${receipt.findings.length} findings; value coverage unavailable`,
    'Terminal token exposures (identified by chain and address):',
    ...receipt.leaves.map(leaf => `  ${leaf.assetId}: ${formatUnits(leaf.amountRaw, leaf.decimals)} ${leaf.symbol} (${leaf.amountRaw} raw; unverified)`),
    ...receipt.dependencies.map(edge => `Reference [${edge.kind}]: ${edge.from} -> ${edge.to} (not counted as holdings)`),
    ...receipt.findings.map(finding => `Finding [${finding.reason}]: ${finding.path.join(' -> ')}`),
    `Effective collateral multiple: unavailable (${receipt.metric.blockers.join('; ')})`,
  ].join('\n');
}

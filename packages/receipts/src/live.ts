import { formatUnits } from '../../domain/src/index.js';
import type { LiveReceipt } from '../../domain/src/live.js';

export function renderLiveReceipt(result: LiveReceipt): string {
  const block = result.capture.block;
  return [
    `Tare | MetaMorpho V1 | ${result.sourceMode} | ${result.kind}`,
    `Owner: ${result.owner}; vault: ${result.capture.vault}`,
    `Block: ${block ? `${BigInt(block.number)} (${block.hash})` : 'unavailable'}`,
    'Scope: vault -> Morpho Blue loan receivables; collateral is a dependency, not an owned asset.',
    `Vault conversion quote: ${result.vault ? `${formatUnits(result.vault.convertToAssetsRaw, result.vault.decimals)} USDC` : 'unavailable'}`,
    `Markets observed: ${result.coverage.observedMarkets}/${result.coverage.expectedMarkets ?? 'unknown'}`,
    ...result.markets.map(market => `  ${market.marketId}: ${market.attributedAssetsRaw === null ? 'unresolved' : `${formatUnits(market.attributedAssetsRaw, 6)} USDC receivable`}; collateral=${market.collateralToken}; oracle=${market.oracle}`),
    `Unattributed quote units (rounding and/or unresolved allocations): ${result.unattributedAssetsRaw ?? 'unavailable'}`,
    ...result.capture.health.map(health => `Source ${health.source}: ${health.status}; ${health.requests} requests; ${health.failures} transport failures`),
    ...result.findings.map(finding => `Finding [${finding.code}]: ${finding.stage}${finding.marketId ? ` ${finding.marketId}` : ''}`),
    'Verification: not independently verified. Effective collateral multiple: unavailable.',
  ].join('\n');
}

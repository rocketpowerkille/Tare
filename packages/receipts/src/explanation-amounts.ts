import { formatUnits } from '../../domain/src/units.js';
import { address, code, object, raw } from './explanation-data.js';
import type { EvidenceRecord } from './explanation-data.js';

export type FormattedAmount = {
  status: 'formatted';
  decimals: number;
  decimalsSource: string;
  decimal: string;
  display: string;
  unit: string;
} | {
  status: 'unavailable';
  reason: 'missing-or-invalid-decimals' | 'invalid-raw-value';
};

/** Insert the decimal point once. Never round, abbreviate, or use floating point. */
export function formatEvidenceAmount(value: unknown, decimals: unknown, unit: string, decimalsSource: string): FormattedAmount {
  const amount = raw(value);
  if (amount === undefined) return { status: 'unavailable', reason: 'invalid-raw-value' };
  if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    return { status: 'unavailable', reason: 'missing-or-invalid-decimals' };
  }
  const decimal = formatUnits(amount, decimals);
  const [whole, fraction] = decimal.split('.');
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
  return { status: 'formatted', decimals, decimalsSource, decimal, display: `${grouped} ${unit}`, unit };
}

/** Map only known report fields to their own units. Asset decimals are never share decimals. */
export function explanationAmount(report: EvidenceRecord, field: string, value: unknown): FormattedAmount | undefined {
  const isErc4626 = report.protocol === 'erc4626';
  const vault = object(isErc4626 ? report.position : report.vault);
  const vaultField = isErc4626 ? 'position' : 'vault';
  const capture = object(report.capture);
  const metadataAsset = object(object(capture.metadata).asset);
  const unit = code(vault.assetSymbol ?? metadataAsset.symbol) ?? address(vault.asset) ?? 'asset units';
  const assetAmount = () => formatEvidenceAmount(value, vault.decimals, unit, `${vaultField}.decimals`);
  if (['vault.sharesRaw', 'vault.totalSupplyRaw'].includes(field)) {
    return formatEvidenceAmount(value, vault.shareDecimals, 'vault shares', `${vaultField}.shareDecimals`);
  }
  if (['vault.totalAssetsRaw', 'contractConversionQuoteRaw', 'underlyingAssetQuoteRaw'].includes(field)) return assetAmount();
  if (/^markets\[\d+\]\.attributedAssetsRaw$/.test(field)) return assetAmount();

  if (field === 'nested.quoteRaw' || /^analysis\.branches\[\d+\](\.markets\[\d+\])?\.attributedAssetsRaw$/.test(field)) {
    // The current nested adapter validates Ethereum USDC, not arbitrary token decimals.
    const supportedUsdc = report.reportType === 'nested-exposure' && capture.chainId === 1 && capture.scope === 'morpho-v2-v1-blue';
    return formatEvidenceAmount(value, supportedUsdc ? 6 : undefined, 'USDC', 'adapter:morpho-v2-v1-blue:USDC');
  }
  if (['claim.balanceRaw', 'claim.supplyRaw'].includes(field)) {
    // The WETH custody adapter explicitly validates 18 decimals before emitting a claim.
    return formatEvidenceAmount(value, report.reportType === 'weth-custody' ? 18 : undefined, 'WETH', 'adapter:weth-custody:WETH');
  }
  if (field.startsWith('view.')) return formatEvidenceAmount(value, undefined, 'units', 'not-returned');
  if (['checks.tokenApiAmountRaw', 'checks.rpcAmountRaw'].includes(field)) {
    return formatEvidenceAmount(value, object(report.checks).decimals, 'token units', 'checks.decimals');
  }

  const valuation = object(report.valuation ?? (report.claim ? { price: object(report.claim).price } : report));
  const price = object(valuation.price);
  if (field === 'price.answerRaw') return formatEvidenceAmount(value, price.decimals, 'USD per feed unit', 'price.decimals');
  if (field === 'usd.valueRaw') {
    const pricedValue = object(valuation.value ?? valuation.rootClaim);
    const hasValueDecimals = pricedValue.decimals !== undefined;
    return formatEvidenceAmount(value, hasValueDecimals ? pricedValue.decimals : price.decimals, 'USD', hasValueDecimals ? 'value.decimals' : 'price.decimals');
  }
  if (['metric.numeratorRaw', 'metric.denominatorRaw'].includes(field)) {
    const metric = object(report.metric);
    return formatEvidenceAmount(value, metric.decimals, code(metric.currency) ?? 'metric units', 'metric.decimals');
  }
  return undefined;
}

import { array, object, raw, address, code, timestamp } from './explanation-data.js';
import type { Category, EvidenceRecord, ExplanationFact } from './explanation-data.js';

export type AddFact = (category: Category, field: string, value: ExplanationFact['value'] | undefined, source: string, formattedAmount?: ExplanationFact['formattedAmount']) => void;

export function classifyPosition(report: EvidenceRecord, source: string, add: AddFact) {
  const vault = object(report.protocol === 'erc4626' ? report.position : report.vault);
  for (const field of ['sharesRaw', 'totalSupplyRaw', 'totalAssetsRaw']) add('observed', `vault.${field}`, raw(vault[field]), source);
  add('observed', 'vault.asset', address(vault.asset), source);
  if (typeof vault.decimals === 'number') add('observed', 'vault.assetDecimals', vault.decimals, source);
  add('observed', 'vault.assetSymbol', code(vault.assetSymbol ?? object(object(object(report.capture).metadata).asset).symbol), source);
  // The contract-returned quote is observed; interpreting it as position assets is derived.
  const quote = raw(vault.convertToAssetsRaw ?? vault.assetsRaw);
  add('observed', 'contractConversionQuoteRaw', quote, source);
  add('derived', 'underlyingAssetQuoteRaw', quote, source);
  if (raw(vault.sharesRaw) === '0') add('notVerified', 'positivePosition', 'The reported wallet share balance is zero.', source);
  else if (raw(vault.sharesRaw)) add('inferred', 'shareMeaning', 'Shares represent a contract-reported claim, not direct custody of underlying assets.', source);
  const analysis = object(report.analysis);
  if (['metamorpho-v1-blue-v1', 'erc4626'].includes(String(report.protocol)) && quote === undefined) {
    add('notVerified', 'assetConversion', 'No underlying asset conversion returned.', source);
  }
  add('derived', 'nested.quoteRaw', raw(analysis.quoteRaw), source);
  const branches = array(analysis.branches);
  branches.forEach((item, index) => {
    const branch = object(item);
    add('derived', `analysis.branches[${index}].vault`, address(branch.vault), source);
    add('derived', `analysis.branches[${index}].attributedAssetsRaw`, raw(branch.attributedAssetsRaw), source);
    if (!address(branch.vault)) add('notVerified', `analysis.branches[${index}]`, 'Nested vault not resolved.', source);
  });
  const marketGroups = [{ path: 'markets', items: array(report.markets) },
    ...branches.map((item, index) => ({ path: `analysis.branches[${index}].markets`, items: array(object(item).markets) }))];
  for (const group of marketGroups) group.items.forEach((item, index) => {
    const market = object(item);
    add('derived', `${group.path}[${index}].attributedAssetsRaw`, raw(market.attributedAssetsRaw), source);
    add('observed', `${group.path}[${index}].marketId`, code(market.marketId), source);
  });
  const claim = object(report.claim);
  add('observed', 'claim.balanceRaw', raw(claim.balanceRaw), source);
  add('observed', 'claim.supplyRaw', raw(claim.supplyRaw), source);
  const view = object(report.view);
  for (const field of ['ownerShares', 'outerSupply', 'innerSupply', 'outerCustodyShares', 'terminalCustody']) add('observed', `view.${field}`, raw(view[field]), source);
  for (const field of ['ownerInnerShares', 'ownerTerminalAssets']) add('derived', `view.${field}`, raw(view[field]), source);
}

export function classifyPrice(report: EvidenceRecord, source: string, add: AddFact) {
  const valuation = object(report.valuation ?? (report.claim ? { price: object(report.claim).price } : report));
  const price = object(valuation.price);
  const value = object(valuation.value ?? valuation.rootClaim);
  const hasPrice = raw(price.answerRaw) !== undefined && address(price.feed) !== undefined
    && typeof price.decimals === 'number' && timestamp(price.updatedAt) !== undefined;
  if (!hasPrice) {
    add('notVerified', 'marketPrice', 'No qualifying price with feed and timestamp in this response.', source);
    return false;
  }
  for (const field of ['answerRaw', 'roundId']) add('marketPriced', `price.${field}`, raw(price[field]), source);
  add('marketPriced', 'price.decimals', price.decimals as number, source);
  add('marketPriced', 'price.feed', address(price.feed), source);
  add('marketPriced', 'price.updatedAt', timestamp(price.updatedAt), source);
  add('marketPriced', 'asset', address(report.asset), source);
  add('marketPriced', 'assetSymbol', code(report.assetSymbol), source);
  add('marketPriced', 'usd.valueRaw', raw(value.valueRaw), source);
  if (raw(value.valueRaw) !== undefined) add('marketPriced', 'usd.decimals', typeof value.decimals === 'number' ? value.decimals : price.decimals as number, source);
  // Do not calculate a missing USD amount, even if a price and balance are present.
  if (raw(value.valueRaw) === undefined) add('notVerified', 'usdEstimate', 'No USD estimate returned.', source);
  return true;
}

export function classifyChecks(report: EvidenceRecord, source: string, add: AddFact) {
  const checks = object(report.checks);
  add('observed', 'checks.tokenApiAmountRaw', raw(checks.tokenApiAmountRaw), source);
  add('observed', 'checks.rpcAmountRaw', raw(checks.rpcAmountRaw), source);
  if (typeof checks.tokenApiLastUpdateBlock === 'number') add('observed', 'checks.tokenApiLastUpdateBlock', checks.tokenApiLastUpdateBlock, source);
  if (report.status === 'matched') {
    add('checked', 'comparison', code(report.verification) ?? code(report.reportType), source);
  }
  // A complete report by itself does not establish any comparison.
  const matched = array(report.checks).map(object).filter(check => check.status === 'matched');
  if (matched.length) add('checked', 'matchedComparisonCount', matched.length, source);
  if (checks.accountingApplicable === false) add('notVerified', 'studioAccounting', 'Outside configured Studio accounting scope.', source);
  else if (checks.accountingStatus === 'matched') add('checked', 'studioAccounting', 'Bounded Studio/RPC accounting comparison matched; inspect report findings.', source);
  else if (report.reportType === 'graph-product-composition') add('notVerified', 'studioAccounting', 'No matched Studio comparison established.', source);
  const metric = object(report.metric);
  if (metric.kind === 'available' && code(metric.scope)) {
    add('checked', 'metric.scope', code(metric.scope), source);
    for (const field of ['numeratorRaw', 'denominatorRaw', 'multipleMillionths']) add('derived', `metric.${field}`, raw(metric[field]), source);
  } else add('notVerified', 'backingMetric', 'No scoped backing metric available.', source);
}

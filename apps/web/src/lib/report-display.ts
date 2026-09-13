import { list, record, text, type JsonRecord } from './types';

/** Format integer units without converting financial amounts to floating point. */
export function formatAmount(raw: unknown, decimals: unknown, digits = 6): string | undefined {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || typeof decimals !== 'number'
    || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return undefined;
  const padded = raw.padStart(decimals + 1, '0');
  const integer = decimals ? padded.slice(0, -decimals) : padded;
  const fraction = decimals ? padded.slice(-decimals) : '';
  const shown = fraction.slice(0, digits).replace(/0+$/, '');
  return `${/[1-9]/.test(fraction.slice(digits)) ? '≈' : ''}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${shown ? `.${shown}` : ''}`;
}

export function displayBlock(report: JsonRecord): string | undefined {
  const capture = record(report.capture);
  const witness = record(list(capture.witnesses)[0]);
  const block = record(capture.block ?? record(capture.rpc).block ?? record(witness.rpc).block);
  try { return block.number === undefined ? undefined : BigInt(String(block.number)).toString(); }
  catch { return undefined; }
}

export function displayTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const date = /^\d+$/.test(String(value)) ? new Date(Number(value) * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function positionValues(report: JsonRecord) {
  const capture = record(report.capture);
  const vault = record(report.protocol === 'erc4626' ? report.position : report.vault);
  const nested = report.reportType === 'nested-exposure';
  const raw = nested ? record(report.analysis).quoteRaw : vault.convertToAssetsRaw ?? vault.assetsRaw;
  const decimals = nested ? 6 : vault.decimals;
  return {
    shares: text(vault.sharesRaw),
    raw: text(raw),
    amount: formatAmount(raw, decimals),
    decimals,
    symbol: nested ? 'USDC' : text(vault.assetSymbol) ?? text(record(record(capture.metadata).asset).symbol) ?? 'asset units',
  };
}

export function priceEvidence(report: JsonRecord, modules: JsonRecord[] = []) {
  const module = modules.find(item => item.id === 'chainlink');
  const valuation = module ? record(module.report) : record(report.valuation);
  const price = record(valuation.price);
  const value = record(valuation.value ?? valuation.rootClaim);
  const updatedAt = displayTimestamp(price.updatedAt);
  const priced = text(price.feed) && formatAmount(price.answerRaw, price.decimals) && updatedAt;
  return {
    amount: priced ? formatAmount(value.valueRaw, value.decimals ?? price.decimals, 2) : undefined,
    feed: text(price.feed),
    updatedAt,
    raw: text(value.valueRaw),
    round: text(price.roundId),
    quote: formatAmount(price.answerRaw, price.decimals),
    report: valuation,
  };
}

export interface PathNode {
  id: string;
  label: string;
  kind: 'Wallet' | 'Vault' | 'Market' | 'Asset' | 'Adapter';
  reference: string;
  status: string;
  fields: [string, string][];
  raw: JsonRecord;
  children: PathNode[];
}

function marketNode(market: JsonRecord, id: string, symbol: string, decimals: unknown): PathNode {
  const asset = text(market.loanToken);
  const amount = formatAmount(market.attributedAssetsRaw, decimals);
  return {
    id, label: 'Morpho Blue market', kind: 'Market', reference: text(market.marketId) ?? 'ID unavailable',
    status: 'Accounting exposure; backing not independently verified',
    fields: [['Derived position allocation', amount ? `${amount} ${symbol}` : 'Unavailable'], ['Allocation raw', text(market.attributedAssetsRaw) ?? 'Unavailable'], ['Collateral token', text(market.collateralToken) ?? 'Unavailable']],
    raw: market,
    children: asset ? [{ id: `${id}-asset`, label: 'Loan asset', kind: 'Asset', reference: asset, status: 'Observed token identity, not proof of custody', fields: [['Asset', symbol]], raw: { loanToken: asset }, children: [] }] : [],
  };
}

/** Only present paths explicitly returned by a supported receipt schema. */
export function positionTree(report: JsonRecord): PathNode | undefined {
  const capture = record(report.capture);
  const values = positionValues(report);
  if (!['metamorpho-v1-blue-v1', 'erc4626'].includes(String(report.protocol)) && report.reportType !== 'nested-exposure') return undefined;
  const vault = record(report.protocol === 'erc4626' ? report.position : report.vault);
  const address = text(vault.address) ?? text(capture.vault);
  if (!address) return undefined;
  const metadata = record(capture.metadata);
  const vaultNode: PathNode = {
    id: 'vault', label: text(vault.vaultName) ?? text(metadata.name) ?? (report.reportType === 'nested-exposure' ? 'Outer V2 vault' : 'Vault'),
    kind: 'Vault', reference: address, status: values.amount ? 'Derived asset quote, not verified backing' : 'Position quote unavailable',
    fields: [['Observed shares (raw)', values.shares ?? 'Not included in this receipt'], ['Derived asset quote', values.amount ? `${values.amount} ${values.symbol}` : 'Unavailable']],
    raw: Object.keys(vault).length ? vault : record(report.analysis), children: [],
  };
  if (report.reportType === 'nested-exposure') {
    vaultNode.children = list(record(report.analysis).branches).map((value, index) => {
      const branch = record(value);
      const amount = formatAmount(branch.attributedAssetsRaw, values.decimals);
      return {
        id: `branch-${index}`, label: text(branch.vault) ? 'Nested V1 vault' : 'Unresolved adapter',
        kind: text(branch.vault) ? 'Vault' as const : 'Adapter' as const,
        reference: text(branch.vault) ?? text(branch.adapter) ?? 'Unavailable',
        status: text(branch.vault) ? 'Traced allocation; backing not verified' : 'No qualifying nested vault evidence',
        fields: [['Derived position allocation', amount ? `${amount} ${values.symbol}` : 'Unavailable'], ['Adapter', text(branch.adapter) ?? 'Unavailable']],
        raw: branch, children: list(branch.markets).map((item, i) => marketNode(record(item), `branch-${index}-market-${i}`, values.symbol, values.decimals)),
      };
    });
  } else if (report.protocol === 'metamorpho-v1-blue-v1') {
    vaultNode.children = list(report.markets).map((item, index) => marketNode(record(item), `market-${index}`, values.symbol, values.decimals));
  } else if (text(vault.asset)) {
    vaultNode.children = [{ id: 'asset', label: 'Underlying asset', kind: 'Asset', reference: String(vault.asset), status: 'Observed identity; downstream holdings not checked', fields: [['Asset', values.symbol]], raw: { asset: vault.asset }, children: [] }];
  }
  const owner = text(capture.owner) ?? text(report.owner);
  return owner ? {
    id: 'wallet', label: 'Wallet position', kind: 'Wallet', reference: owner,
    status: values.shares === '0' ? 'Observed zero shares' : 'Requested wallet; inspect share balance below',
    fields: [['Observed shares (raw)', values.shares ?? 'Not included in this receipt']], raw: { owner }, children: [vaultNode],
  } : vaultNode;
}

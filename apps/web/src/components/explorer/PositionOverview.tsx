import { list, record, text, type JsonRecord } from '../../lib/types';

interface PositionOverviewData {
  amount: string;
  symbol: string;
  vaultName: string;
  checkedBlock?: string;
  path: string[];
  explanation: string;
}

function formatUnits(raw: string, decimals: number, maximumFractionDigits = 6) {
  const padded = raw.padStart(decimals + 1, '0');
  const integer = decimals ? padded.slice(0, -decimals) : padded;
  const fullFraction = decimals ? padded.slice(-decimals) : '';
  const fraction = decimals
    ? fullFraction.slice(0, maximumFractionDigits).replace(/0+$/, '')
    : '';
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const approximate = /[1-9]/.test(fullFraction.slice(maximumFractionDigits));
  return `${approximate ? '≈' : ''}${fraction ? `${grouped}.${fraction}` : grouped}`;
}

function blockNumber(capture: JsonRecord) {
  const direct = record(capture.block);
  if (direct.number !== undefined) return BigInt(String(direct.number)).toString();
  const rpcBlock = record(record(capture.rpc).block);
  return rpcBlock.number !== undefined ? BigInt(String(rpcBlock.number)).toString() : undefined;
}

function v1Overview(report: JsonRecord, capture: JsonRecord): PositionOverviewData | undefined {
  const vault = record(report.vault);
  const amountRaw = text(vault.convertToAssetsRaw);
  const decimals = typeof vault.decimals === 'number' ? vault.decimals : undefined;
  if (!amountRaw || decimals === undefined) return undefined;

  const metadata = record(capture.metadata);
  const asset = record(metadata.asset);
  const marketCount = list(report.markets).length;
  const vaultName = text(metadata.name) ?? 'MetaMorpho V1 vault';
  return {
    amount: formatUnits(amountRaw, decimals),
    symbol: text(asset.symbol) ?? 'underlying units',
    vaultName,
    checkedBlock: blockNumber(capture),
    path: ['Wallet', vaultName, `${marketCount} Morpho Blue market${marketCount === 1 ? '' : 's'}`],
    explanation: `Tare converted this wallet's vault shares into the underlying asset at one block, then traced how the vault allocates assets across ${marketCount} lending market${marketCount === 1 ? '' : 's'}.`,
  };
}

function nestedOverview(report: JsonRecord, capture: JsonRecord): PositionOverviewData | undefined {
  const analysis = record(report.analysis);
  const amountRaw = text(analysis.quoteRaw);
  if (!amountRaw) return undefined;

  const activeBranches = list(analysis.branches)
    .map(record)
    .filter(branch => text(branch.vault));
  const marketCount = activeBranches.reduce((total, branch) => total + list(branch.markets).length, 0);
  const branchLabel = `${activeBranches.length} V1 vault branch${activeBranches.length === 1 ? '' : 'es'}`;
  return {
    amount: formatUnits(amountRaw, 6),
    symbol: 'USDC',
    vaultName: 'Nested V2 vault',
    checkedBlock: blockNumber(capture),
    path: ['Wallet', 'V2 vault', branchLabel, `${marketCount} Morpho Blue market${marketCount === 1 ? '' : 's'}`],
    explanation: `Tare converted this wallet's V2 vault shares into USDC at one block, then followed ${activeBranches.length} supported V1 branch${activeBranches.length === 1 ? '' : 'es'} into ${marketCount} lending market${marketCount === 1 ? '' : 's'}.`,
  };
}

function overview(report: JsonRecord) {
  const capture = record(report.capture);
  return text(report.protocol) === 'metamorpho-v1-blue-v1'
    ? v1Overview(report, capture)
    : text(report.reportType) === 'nested-exposure'
      ? nestedOverview(report, capture)
      : undefined;
}

export function PositionOverview({ report }: { report: JsonRecord }) {
  const position = overview(report);
  if (!position) return null;

  return <section className="position-overview" aria-labelledby="position-overview-title">
    <div className="position-amount">
      <p className="section-label">Your position</p>
      <h3 id="position-overview-title">{position.amount} <span>{position.symbol}</span></h3>
      <p>Current vault share value at the checked block. This is not a wallet cash balance or a guarantee of redemption.</p>
    </div>
    <div className="position-context">
      <strong>{position.vaultName}</strong>
      <p>{position.explanation}</p>
      {position.checkedBlock && <small>Calculated from public data at block {position.checkedBlock}.</small>}
    </div>
    <ol className="position-path" aria-label="Position path">
      {position.path.map((step, index) => <li key={`${step}-${index}`}><span>{index + 1}</span><strong>{step}</strong></li>)}
    </ol>
  </section>;
}

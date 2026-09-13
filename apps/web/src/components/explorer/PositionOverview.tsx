import { list, record, type JsonRecord } from '../../lib/types';
import { positionValues } from '../../lib/report-display';

export function PositionOverview({ report }: { report: JsonRecord }) {
  if (!positionValues(report).raw) return null;
  const branches = list(record(report.analysis).branches);
  const markets = list(report.markets).length + branches.reduce<number>((total, branch) => total + list(record(branch).markets).length, 0);
  const explanation = report.protocol === 'erc4626'
    ? 'The contract reports a share balance and a quote in its underlying asset. Protocol-specific downstream holdings are outside this generic check.'
    : report.reportType === 'nested-exposure'
      ? `The report follows ${branches.length} adapter branches and ${markets} market entries. Unresolved branches stay visible. Zero-valued entries are not positive positions.`
      : `The report contains ${markets} Morpho Blue market entries. Pro-rata allocations describe accounting exposure, not guaranteed cash or recoverable collateral.`;
  return <section className="position-overview" aria-label="Position interpretation">
    <div className="position-context"><h3>Position interpretation</h3><p>{explanation}</p></div>
  </section>;
}

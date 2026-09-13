import { list, record, text, type JsonRecord } from '../../lib/types';

export function HistoricalEvidence({ report }: { report: JsonRecord }) {
  const accounting = record(report.accounting);
  const shares = record(report.shares);
  const coverage = record(report.coverage);
  return <section className="report-section">
    <h3>Historical evidence coverage</h3>
    <p className="source-caution">Historical block only. This report does not verify current wallet state, prove solvency, or authorize execution.</p>
    <dl className="fact-grid">
      <div><dt>Checked block</dt><dd>{text(report.checkedBlock) ?? 'Unavailable'}</dd></div>
      <div><dt>Block timestamp (UTC)</dt><dd>{text(report.checkedAt) ?? 'Unavailable'}</dd></div>
      <div><dt>Share ledger starts</dt><dd>{text(coverage.shareStartBlock)}</dd></div>
      <div><dt>Accounting starts</dt><dd>{text(coverage.accountingStartBlock)}</dd></div>
      <div><dt>Share comparisons</dt><dd>{text(shares.status) ?? 'Unavailable'} · {list(shares.checks).length} returned</dd></div>
      <div><dt>Accounting comparisons</dt><dd>{text(accounting.status) ?? 'Unavailable'} · {list(accounting.checks).length} returned</dd></div>
    </dl>
    {list(shares.checks).map((value, index) => {
      const check = record(value);
      return <p key={index}><strong>{text(check.field)}: {text(check.status)}</strong><br />RPC: {text(check.rpc)} · Graph: {text(check.graph)}</p>;
    })}
    {[shares, accounting].map((source, index) => list(source.findings).length > 0 && <div key={index}>
      <h4>{index === 0 ? 'Share ledger' : 'Accounting'} findings</h4>
      <ul>{list(source.findings).map((finding, i) => <li key={i}>{typeof finding === 'string' ? finding : text(record(finding).code)}</li>)}</ul>
    </div>)}
  </section>;
}

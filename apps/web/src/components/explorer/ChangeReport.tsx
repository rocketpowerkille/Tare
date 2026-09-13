import { investigateChanges } from '../../../../../packages/receipts/src/position-changes';
import { CopyValue } from '../CopyValue';
import type { JsonRecord } from '../../lib/types';

const fieldLabels: Record<string, string> = {
  sharesRaw: 'Wallet share balance', totalSupplyRaw: 'Vault share supply', totalAssetsRaw: 'Vault reported assets',
  conversionQuoteRaw: 'Position conversion quote', feeRaw: 'Reported fee', vaultAssetsRaw: 'Vault market allocation',
  attributedAssetsRaw: 'Attributed position exposure', 'market-presence': 'Market membership',
};

export function downloadInvestigation(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

export function ChangeReport({ current, previous }: { current: JsonRecord; previous: JsonRecord }) {
  const comparison = investigateChanges(current, previous);
  const changed = comparison.changes.filter(item => item.status !== 'unchanged');
  return <section className="change-report" aria-label="Two-block change report">
    <p className="section-label">What changed?</p><h3>{!comparison.comparable ? 'Reports cannot be compared at two confirmed blocks'
      : comparison.changedFields ? `${comparison.changedFields} changed ${comparison.changedFields === 1 ? 'field' : 'fields'} in the returned evidence` : 'No changes in comparable returned fields'}</h3>
    <p>Comparison status: {comparison.status}. This describes comparison coverage, not vault safety.</p>
    <p>{comparison.comparable ? 'Deterministic comparison, not an AI conclusion. Missing fields and partial coverage remain below.' : 'No amount differences were calculated. Review the position identities, source blocks and coverage.'}</p>
    <div className="change-endpoints">{([['Previous', comparison.before], ['Current', comparison.after]] as const).map(([label, item]) => <section key={label}>
      <h4>{label} observation</h4><p>Chain: {item.chainId ?? 'unavailable'}<br />Original source mode (as reported): {item.sourceMode}<br />Block: {item.observedBlock ?? 'unavailable'}<br />Block time: {item.blockTimestamp ?? 'unavailable'}<br />Captured: {item.capturedAt ?? 'unavailable'}</p>
      {item.vault && <CopyValue value={item.vault} label={`${label} vault`} />}
      {item.blockHash && <CopyValue value={item.blockHash} label={`${label} block hash`} />}
      <p>RPC report: {item.status}. Market coverage: {item.completeMarkets ? 'complete returned set' : 'incomplete or unsupported'}.</p>
      <p>The Graph: {item.graph.status}. {item.graph.supportsAccounting ? 'Aligned accounting comparison supports the checked vault reads.' : 'No complete aligned accounting agreement established.'}<br />Graph block: {item.graph.provenance.observedBlock ?? 'unavailable'}</p>
      <p className="muted">{item.graph.scope}</p>
    </section>)}</div>
    {comparison.issues.length > 0 && <ul className="finding-list">{comparison.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
    <ol className="change-timeline">{changed.map((item, index) => <li key={`${item.field}-${item.marketId ?? index}`}>
      <details><summary>{fieldLabels[item.field] ?? item.field} · {item.status} {item.deltaRaw !== undefined ? `· Δ ${item.deltaRaw} raw` : ''}</summary>
        <p>{item.category === 'derived' ? 'Derived accounting amount' : 'Observed contract value'}; the difference is derived. Units: {item.unit}.</p>
        {item.marketId && <CopyValue value={item.marketId} label="Market ID" />}
        <p>Before: <code>{item.before ?? 'Unavailable'}</code><br />After: <code>{item.after ?? 'Unavailable'}</code></p>
        <p>No cause, transaction, profit or loss is inferred from this difference.</p>
      </details>
    </li>)}</ol>
    <details><summary>All compared fields, including unchanged values</summary><pre tabIndex={0}>{JSON.stringify(comparison.changes, null, 2)}</pre></details>
    <h4>What this comparison does not establish</h4><ul>{comparison.limitations.map(item => <li key={item}>{item}</li>)}</ul>
    <div className="assistant-presets">
      <button className="button secondary" type="button" onClick={() => downloadInvestigation(comparison, 'tare-position-changes.json')}>Download comparison</button>
      <button className="button quiet" type="button" onClick={() => downloadInvestigation(previous, 'tare-previous-report.json')}>Download previous report</button>
      <button className="button quiet" type="button" onClick={() => downloadInvestigation(current, 'tare-current-report.json')}>Download current report</button>
    </div>
    <details><summary>Full comparison and source provenance</summary><pre tabIndex={0}>{JSON.stringify(comparison, null, 2)}</pre></details>
  </section>;
}

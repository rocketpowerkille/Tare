import { list, record, text, type JsonRecord } from '../../lib/types';
import { displayBlock, priceEvidence } from '../../lib/report-display';
import { StatusBadge } from '../StatusBadge';
import { CopyValue } from '../CopyValue';
import { Term } from '../Term';

function sourceState(status: string) {
  if (['complete', 'verified', 'matched'].includes(status)) return { label: 'Evidence found', tone: 'success' as const };
  if (status === 'mismatch') return { label: 'Evidence disagrees', tone: 'danger' as const };
  if (status === 'unavailable') return { label: 'Source unavailable', tone: 'warning' as const };
  if (status === 'not-eligible') return { label: 'No qualifying evidence', tone: 'neutral' as const };
  if (status === 'not-used') return { label: 'Not used', tone: 'neutral' as const };
  return { label: 'Evidence incomplete', tone: 'warning' as const };
}

export function EvidenceSources({ report, modules }: { report: JsonRecord; modules: JsonRecord[] }) {
  const primaryBlock = displayBlock(report);
  return <section className="report-section evidence-sources">
    <p className="section-label">Evidence checks</p><h3>Sources and what they establish</h3>
    <p className="path-help">Each source has its own scope and observation time. <Term name="evidence coverage" /> is not a safety rating.</p>
    <div className="source-cards">{modules.map(module => {
      const id = String(module.id);
      const status = text(module.status) ?? 'unavailable';
      const state = module.technicalError === true ? { label: 'Technical error', tone: 'danger' as const } : sourceState(status);
      const evidence = record(module.report);
      const checks = record(evidence.checks);
      const capture = record(evidence.capture);
      const block = displayBlock(evidence);
      const price = priceEvidence({}, [module]);
      const graph = id === 'the-graph';
      const valuation = id === 'chainlink';
      const authorization = id === 'bazantic';
      const conclusion = authorization ? 'Access authorization only. Does not establish custody, backing or solvency.'
        : status === 'mismatch' ? 'Contradicts agreement within the compared scope. Review the differing values.'
        : valuation ? (status === 'verified' ? 'The returned price supports a market estimate of the accounting quote. It does not establish custody, liquidity or backing.' : 'No qualifying price conclusion established. Custody, liquidity and backing remain unverified.')
        : graph ? (status === 'verified' ? 'Agreement supports the compared accounting facts, not independent backing.' : 'Only returned comparisons can support accounting facts. Missing comparisons establish no agreement or independent backing.')
        : 'Establishes only the supported position accounting and reported path.';
      return <article className="source-card" key={id}>
        <header><div><span className="section-label">{text(module.partner) ?? 'Tare · Direct reads'}</span><h4>{text(module.name)}</h4></div><StatusBadge tone={state.tone}>{authorization && status === 'verified' ? 'Session accepted' : state.label}</StatusBadge></header>
        <p>{text(module.summary)}</p>
        <dl className="source-facts">
          <div><dt>What was checked</dt><dd>{graph ? 'Wallet vault-share balance via Token API; configured Studio accounting against RPC.' : valuation ? 'Eligible Chainlink USD feed and accounting quote.' : authorization ? 'The request credential, not the position.' : 'Wallet shares, asset conversion and supported allocations.'}</dd></div>
          <div><dt>Block / observation</dt><dd>{block ?? (valuation ? price.updatedAt : text(capture.capturedAt)) ?? 'Not available in this evidence'}</dd></div>
          {graph && <>
            <div><dt>Token API shares, raw</dt><dd>{text(checks.tokenApiAmountRaw) ?? 'Unavailable'}</dd></div>
            <div><dt>RPC shares, raw</dt><dd>{text(checks.rpcAmountRaw) ?? 'Unavailable'}</dd></div>
            <div><dt>Token balance last updated at block</dt><dd>{String(checks.tokenApiLastUpdateBlock ?? 'Unavailable')}</dd></div>
            <div><dt>Studio coverage</dt><dd>{checks.accountingApplicable === false ? 'Not configured for this vault' : checks.accountingStatus ? `${checks.accountingStatus} · ${checks.accountingReads ?? 0} comparisons` : 'Not available'}</dd></div>
          </>}
          {valuation && price.feed && <><div><dt>Price feed</dt><dd><CopyValue value={price.feed} label="price feed" /></dd></div><div><dt>Price updated</dt><dd>{price.updatedAt ?? 'Unavailable'}</dd></div><div><dt>Round</dt><dd>{price.round ?? 'Unavailable'}</dd></div></>}
          {authorization && <div><dt>Settlement receipt</dt><dd>Not included in the analysis response. Refer to the Bazantic purchase receipt.</dd></div>}
        </dl>
        {block && primaryBlock && block !== primaryBlock && <p className="source-caution">This source checked block {block}; the primary position uses block {primaryBlock}. Do not treat these as a same-block comparison.</p>}
        <p className="source-conclusion">{['incomplete', 'unavailable', 'not-eligible', 'not-used'].includes(status) ? 'No complete conclusion established by this source. ' : ''}{conclusion}</p>
        {list(evidence.findings).length > 0 && <ul>{list(evidence.findings).map((finding, index) => <li key={index}>{typeof finding === 'string' ? finding.replaceAll('-', ' ') : JSON.stringify(finding)}</li>)}</ul>}
        <details><summary>Source response and technical details</summary><pre>{JSON.stringify(module.report ?? { status, summary: module.summary }, null, 2)}</pre></details>
      </article>;
    })}</div>
  </section>;
}

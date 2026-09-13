import { exposureOverlap } from '../../../../../packages/receipts/src/exposure-overlap';
import type { JsonRecord } from '../../lib/types';
import { CopyValue } from '../CopyValue';

export function ExposureOverlap({ report }: { report: JsonRecord }) {
  const result = exposureOverlap(report);
  return <section className="exposure-overlap" aria-label="Shared market exposure">
    <p className="section-label">Exposure overlap</p><h3>Which positions share a market?</h3>
    <p>{result.eligiblePositions} eligible Morpho V1 positions inspected; {result.excludedPositions} excluded. This is not a full wallet inventory.</p>
    {!result.overlaps.length && <p>No shared market found within returned coverage. This does not establish diversification.</p>}
    {result.overlaps.map(overlap => <details key={overlap.key}>
      <summary>{overlap.members.length} positions share market {overlap.marketId.slice(0, 12)}… · {overlap.status}</summary>
      <CopyValue value={overlap.marketId} label="Shared market ID" />
      <p>Chain: {overlap.chainId}. {overlap.totalAttributedAssetsRaw === null ? 'Combined amount unavailable. Different blocks or missing/incompatible units are never summed.' : `Derived total: ${overlap.totalAttributedAssetsRaw} asset raw units. Not a USD value.`}</p>
      <div className="overlap-members">{overlap.members.map(member => <section key={member.vault}>
        <h4>Vault position</h4><CopyValue value={member.vault} label="Overlap vault" />
        <p>Block: {member.observedBlock ?? 'unavailable'} · {member.sourceMode}<br />Derived attributed amount: {member.market.attributedAssetsRaw ?? 'unavailable'} raw units<br />Asset: {member.asset ?? 'unavailable'} · Decimals: {member.decimals ?? 'unavailable'}</p>
        <details><summary>Dependencies and provenance</summary><p>Collateral and oracle are dependencies, not wallet holdings.</p><pre tabIndex={0}>{JSON.stringify(member, null, 2)}</pre></details>
      </section>)}</div>
    </details>)}
    <ul>{result.limitations.map(item => <li key={item}>{item}</li>)}</ul>
  </section>;
}

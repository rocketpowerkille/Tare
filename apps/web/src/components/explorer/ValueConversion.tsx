import { positionValues, priceEvidence } from '../../lib/report-display';
import type { JsonRecord } from '../../lib/types';
import { CopyValue } from '../CopyValue';
import { Term } from '../Term';

export function ValueConversion({ report, modules = [] }: { report: JsonRecord; modules?: JsonRecord[] }) {
  const position = positionValues(report);
  const usd = priceEvidence(report, modules);
  if (!position.raw) return null;
  return <section className="value-conversion" aria-label="From shares to estimated value">
    <div className="value-steps">
      <article><span className="value-label">{position.shares ? 'Observed' : 'Unavailable'}</span><h4>Vault shares</h4><strong title={position.shares}>{position.shares ?? 'Not included'}</strong><small>Raw share units. Not underlying asset units.</small></article>
      <article><span className="value-label">Derived</span><h4>Underlying asset quote</h4><strong>{position.amount ?? 'Unavailable'} <span>{position.symbol}</span></strong><small>Contract conversion at the checked block.</small></article>
      <article><span className={`value-label ${usd.amount ? '' : 'uncertain'}`}>{usd.amount ? 'Market-priced' : 'Unavailable'}</span><h4>Estimated USD value</h4><strong>{usd.amount ? `$${usd.amount}` : 'USD estimate unavailable'}</strong><small>{usd.amount ? 'Accounting quote × Chainlink reference price.' : 'No qualifying price returned for this report.'}</small></article>
    </div>
    {usd.amount && <div className="price-provenance"><span>Chainlink · {usd.quote ? `${usd.quote.startsWith('≈') ? '≈$' + usd.quote.slice(1) : '$' + usd.quote} / ${position.symbol === 'asset units' ? 'underlying asset (symbol unavailable)' : position.symbol}` : 'Reference price'}</span><span>Price timestamp: {usd.updatedAt ?? 'Unavailable'}</span>{usd.feed && <CopyValue value={usd.feed} label="Chainlink feed address" />}</div>}
    <p className="value-caution">A conversion or market price does not prove <Term name="custody" />, <Term name="backing" /> or redeemability. Values marked ≈ are truncated for display; exact units remain in the report.</p>
  </section>;
}

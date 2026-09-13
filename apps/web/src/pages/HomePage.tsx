import { ArrowRight, Eye, Layers3, FileCheck2, ScanSearch, ShieldCheck } from '../components/Icons';
import { AppLink } from '../components/AppLink';
import { StatusBadge } from '../components/StatusBadge';

const steps = [
  { name: 'Trace', icon: ScanSearch, description: 'Follow supported vault layers and market allocations from a public address.' },
  { name: 'Check', icon: ShieldCheck, description: 'Compare direct reads with eligible accounting and price evidence.' },
  { name: 'Explain', icon: FileCheck2, description: 'Get reproducible reports with sources, blocks, findings and limitations.' },
];

export function HomePage() {
  return <div className="landing">
    <section className="landing-hero page-width">
      <div>
        <p className="kicker">DeFi vault evidence</p>
        <h1>Know what a vault position actually rests on.</h1>
        <p className="lead">Trace a position through nested vaults. See what the evidence supports, and where it stops.</p>
        <div className="button-row">
          <AppLink href="/explore" className="button primary">Open explorer <ArrowRight size={16} /></AppLink>
          <AppLink href="/explore#examples" className="button secondary">View example report</AppLink>
        </div>
        <p className="hero-note"><Eye size={15} /> Read-only analysis. No wallet connection needed to inspect a position.</p>
      </div>
      <figure className="trace-schematic">
        <figcaption><span className="section-label">Anatomy of a check</span><span>Illustrative path</span></figcaption>
        <ol>
          {[
            ['Wallet position', 'Start with a public address', '01'],
            ['Outer vault shares', 'Read the claim held by the wallet', '02'],
            ['Nested allocations', 'Follow supported vaults and markets', '03'],
            ['Evidence report', 'Observations, calculations and limits', '04'],
          ].map(([title, detail, number]) => <li key={number}><span className="schematic-number">{number}</span><div><strong>{title}</strong><small>{detail}</small></div><Layers3 size={18} /></li>)}
        </ol>
        <div className="schematic-limit"><span className="status-dot warning" /> A traced position is not proof of backing.</div>
      </figure>
    </section>
    <section className="landing-section page-width">
      <div className="landing-section-heading"><p className="kicker">The process</p><h2>Follow the evidence.</h2><p>From a position to an answer you can inspect.</p></div>
      <div className="process-cards">{steps.map((step, index) => <article key={step.name}>
        <div><step.icon size={21} /><span>0{index + 1}</span></div><h3>{step.name}</h3><p>{step.description}</p>
      </article>)}</div>
    </section>
    <section className="landing-section page-width evidence-principle">
      <div><p className="kicker">Evidence, not reassurance</p><h2>A clear boundary between a fact and a conclusion.</h2><p>A vault’s numbers can agree without proving custody, valuation or the backing of its loans.</p><p>Tare keeps this gap visible instead of inventing a confidence score.</p><AppLink href="/docs#reading-a-report" className="text-link">How to read the evidence <ArrowRight size={16} /></AppLink></div>
      <ol className="evidence-legend">
        <li><span className="status-dot" /><div><strong>Observed</strong><p>What a source reported at a specific block.</p></div><StatusBadge tone="neutral">Data</StatusBadge></li>
        <li><span className="status-dot success" /><div><strong>Checked</strong><p>What an eligible comparison established within its scope.</p></div><StatusBadge tone="success">Evidence</StatusBadge></li>
        <li><span className="status-dot inferred" /><div><strong>Inferred</strong><p>A conclusion that depends on stated assumptions.</p></div><StatusBadge tone="info">Qualified</StatusBadge></li>
        <li><span className="status-dot warning" /><div><strong>Not verified</strong><p>What the available evidence cannot establish.</p></div><StatusBadge tone="warning">Unknown</StatusBadge></li>
      </ol>
    </section>
    <section className="landing-section page-width why-section">
      <div><p className="kicker">Why Tare</p><h2>Accounting is a starting point. Not the whole answer.</h2><p>Internally consistent balances do not always prove that assets are held in custody, correctly valued or backed by recoverable loans. Tare separates these questions.</p></div>
      <div className="evidence-comparison">
        <article><Eye size={19} /><h3>Observed data</h3><p>Shares, conversion quotes and supported allocations.</p><span>What the contracts report</span></article>
        <article><ShieldCheck size={19} /><h3>Verified backing</h3><p>Requires qualifying evidence beyond accounting alone.</p><span>Never assumed from a balance</span></article>
      </div>
    </section>
    <section className="landing-section page-width">
      <div className="landing-section-heading"><p className="kicker">Current scope</p><h2>Specific checks. Explicit boundaries.</h2><p>Discovery is not exhaustive. Availability depends on the vault, asset and configured sources.</p></div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Supported networks, scroll horizontally on small screens">
        <table className="network-table"><thead><tr><th>Network</th><th>Supported checks</th><th>Evidence mode</th><th>Status</th></tr></thead>
          <tbody>
            <tr><th>Ethereum</th><td>Morpho V1 exposure, bounded V2 paths and ERC-4626 checks. Eligible Graph and Chainlink comparisons.</td><td>Direct reads + eligible sources</td><td><StatusBadge tone="success">Live</StatusBadge></td></tr>
            <tr><th>Base</th><td>Morpho V1 exposure and general ERC-4626 checks.</td><td>Direct reads</td><td><StatusBadge tone="success">Live</StatusBadge></td></tr>
            <tr><th>Arbitrum</th><td>Morpho V1 exposure and general ERC-4626 checks.</td><td>Direct reads</td><td><StatusBadge tone="success">Live</StatusBadge></td></tr>
            <tr><th>Base Sepolia</th><td>Registered ERC-4626 discovery and allowlisted two-layer custody control.</td><td>Testnet reads</td><td><StatusBadge tone="info">Live testnet</StatusBadge></td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <section className="landing-cta page-width"><div><p className="kicker">Your next check</p><h2>Start with evidence.</h2><p>Inspect a public position or explore a reproducible saved report.</p></div><AppLink href="/explore" className="button primary">Open explorer <ArrowRight size={16} /></AppLink></section>
  </div>;
}

import { ArrowRight, CheckCircle2, CircleHelp, FileCheck2, Layers3, ScanSearch, ShieldCheck } from 'lucide-react';
import { AppLink } from '../components/AppLink';
import { StatusBadge } from '../components/StatusBadge';

export function HomePage() {
  return <>
    <section className="home-hero page-width">
      <div className="hero-copy">
        <p className="kicker">Vault evidence, made clear</p>
        <h1>Know what a vault position actually rests on.</h1>
        <p className="lead">Tare follows a DeFi position through nested vaults, checks the available evidence, and shows what can and cannot be concluded.</p>
        <div className="button-row">
          <AppLink href="/explore" className="button primary">Explore evidence <ArrowRight size={17} /></AppLink>
          <AppLink href="/docs" className="button secondary">Understand Tare</AppLink>
        </div>
        <div className="trust-row" aria-label="Product properties">
          <span><CheckCircle2 size={16} />Read only</span>
          <span><CheckCircle2 size={16} />Explicit uncertainty</span>
          <span><CheckCircle2 size={16} />Reproducible reports</span>
        </div>
      </div>
      <div className="evidence-map" aria-label="Example evidence path">
        <div className="map-heading"><span>Evidence path</span><StatusBadge tone="warning">Incomplete</StatusBadge></div>
        <div className="map-node map-root"><span className="node-icon"><Layers3 size={18} /></span><div><strong>Wallet position</strong><small>Outer vault shares</small></div></div>
        <div className="map-connector"><span /></div>
        <div className="map-node"><span className="node-icon"><ScanSearch size={18} /></span><div><strong>Nested allocations</strong><small>12 markets observed</small></div></div>
        <div className="map-connector"><span /></div>
        <div className="map-node map-warning"><span className="node-icon"><CircleHelp size={18} /></span><div><strong>Backing evidence</strong><small>Independent verification missing</small></div></div>
        <div className="map-foot">Tare keeps this gap visible instead of inventing a confidence score.</div>
      </div>
    </section>

    <section className="section page-width">
      <div className="section-heading"><p className="kicker">What it does</p><h2>From position to evidence report</h2><p>One clear flow for people reviewing a vault, and structured output for software that needs the same answer.</p></div>
      <div className="three-column process-grid">
        <article><span className="step-number">01</span><ScanSearch size={22} /><h3>Trace</h3><p>Follow the position through supported vault layers and market allocations.</p></article>
        <article><span className="step-number">02</span><ShieldCheck size={22} /><h3>Check</h3><p>Compare direct reads, indexed data, deployment identity, and custody where supported.</p></article>
        <article><span className="step-number">03</span><FileCheck2 size={22} /><h3>Explain</h3><p>Return a report with source, block, coverage, findings, and clear limitations.</p></article>
      </div>
    </section>

    <section className="section section-dark">
      <div className="page-width decision-grid">
        <div><p className="kicker kicker-light">Why Tare</p><h2>Complete accounting is not the same as verified backing.</h2></div>
        <div className="decision-copy"><p>A vault can have internally consistent numbers while the evidence needed to verify custody, valuation, or underlying loans is still missing.</p><p>Tare separates what was observed from what was inferred. When the evidence stops, the conclusion stops too.</p><AppLink href="/docs#reading-a-report" className="text-link">Learn how to read a report <ArrowRight size={16} /></AppLink></div>
      </div>
    </section>

    <section className="section page-width supported-section">
      <div className="section-heading"><p className="kicker">Current scope</p><h2>Purposefully bounded</h2></div>
      <div className="scope-table" role="table" aria-label="Supported networks and checks">
        <div className="scope-row scope-head" role="row"><span>Network</span><span>Available checks</span><span>Evidence mode</span></div>
        <div className="scope-row" role="row"><strong>Ethereum</strong><span>V1 and V2 exposure, shares, accounting, WETH custody</span><StatusBadge tone="info">Live and recorded</StatusBadge></div>
        <div className="scope-row" role="row"><strong>Base Sepolia</strong><span>Allowlisted two-layer ERC-4626 custody control</span><StatusBadge tone="success">Live testnet</StatusBadge></div>
      </div>
    </section>

    <section className="closing-panel page-width">
      <div><p className="kicker">Start with evidence</p><h2>Explore a recorded example or run a configured live check.</h2></div>
      <AppLink href="/explore" className="button primary">Open explorer <ArrowRight size={17} /></AppLink>
    </section>
  </>;
}

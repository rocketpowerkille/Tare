import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, CircleHelp, Database, Eye, LockKeyhole, Network } from 'lucide-react';
import { AppLink } from '../components/AppLink';

const sections = [
  ['overview', 'Overview'],
  ['how-it-works', 'How it works'],
  ['reading-a-report', 'Read a report'],
  ['using-the-explorer', 'Use the explorer'],
  ['limits', 'Limits and safety'],
  ['faq', 'Common questions'],
];

export function DocsPage() {
  return <div className="docs-layout page-width">
    <aside className="docs-nav">
      <p>On this page</p>
      {sections.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
    </aside>
    <article className="docs-content">
      <header className="page-intro" id="overview">
        <p className="kicker">Tare guide</p>
        <h1>Understand a vault before trusting the headline number.</h1>
        <p className="lead">This guide explains Tare without assuming you know smart contracts, lending markets, or blockchain infrastructure.</p>
      </header>

      <section className="doc-section">
        <h2>First, what is a vault?</h2>
        <p>A DeFi vault is a smart contract that accepts assets and follows a strategy. You receive shares that represent your portion of the vault. Some vaults place assets into other vaults or lending markets, which means a single balance can hide several layers.</p>
        <div className="plain-example">
          <strong>A simple example</strong>
          <p>You deposit into Vault A. Vault A allocates to Vault B. Vault B supplies assets to several lending markets. To understand your position, you need to follow every supported layer and keep track of where the evidence came from.</p>
        </div>
      </section>

      <section className="doc-section" id="how-it-works">
        <p className="section-label">How it works</p><h2>Tare asks three separate questions</h2>
        <div className="doc-cards">
          <article><Network size={21} /><h3>Where does the position go?</h3><p>Tare follows supported vault relationships and records each allocation path.</p></article>
          <article><Database size={21} /><h3>What was actually observed?</h3><p>It keeps source, block, capture time, and coverage attached to the result.</p></article>
          <article><Eye size={21} /><h3>What does the evidence prove?</h3><p>It distinguishes accounting consistency from custody, valuation, and independent backing verification.</p></article>
        </div>
        <p>Tare performs read-only calls. It does not connect your wallet, move funds, or authorize transactions from the explorer.</p>
      </section>

      <section className="doc-section" id="reading-a-report">
        <p className="section-label">Reading a report</p><h2>Five labels matter most</h2>
        <div className="definition-list">
          <div><strong>Live</strong><p>The report requested current data from configured providers at the time shown.</p></div>
          <div><strong>Recorded</strong><p>The report replayed a saved capture. It is useful for reproducibility but does not describe current state.</p></div>
          <div><strong>Matched</strong><p>The compared observations agreed within the narrow check shown in the report.</p></div>
          <div><strong>Incomplete</strong><p>Required evidence was missing, unavailable, inconsistent, or outside the supported scope.</p></div>
          <div><strong>Unavailable metric</strong><p>Tare did not have enough verified evidence to calculate the metric safely.</p></div>
        </div>
        <div className="callout warning"><AlertTriangle size={21} /><div><strong>Matched does not mean risk free.</strong><p>A matched custody or accounting check only supports the scope named in that report. It does not prove every underlying loan, price, or protocol assumption.</p></div></div>
      </section>

      <section className="doc-section" id="using-the-explorer">
        <p className="section-label">Using the explorer</p><h2>Two ways to begin</h2>
        <ol className="numbered-steps">
          <li><span>1</span><div><strong>Replay a public example</strong><p>Best for learning. It uses a retained capture and makes no network request.</p></div></li>
          <li><span>2</span><div><strong>Run a live check</strong><p>Choose a check, enter the public address fields it needs, and review the result. Hosted live checks require a Tare access token.</p></div></li>
        </ol>
        <AppLink href="/explore" className="button primary">Open the explorer <ArrowRight size={17} /></AppLink>
      </section>

      <section className="doc-section" id="limits">
        <p className="section-label">Limits and safety</p><h2>What Tare does not claim</h2>
        <ul className="check-list muted-list">
          <li><CircleHelp size={18} />It does not provide investment advice or a universal vault score.</li>
          <li><CircleHelp size={18} />It does not turn two public RPC providers into cryptographic proof.</li>
          <li><CircleHelp size={18} />It does not treat recorded evidence as a live verification.</li>
          <li><CircleHelp size={18} />It does not claim broad protocol or network coverage.</li>
        </ul>
        <div className="callout safe"><LockKeyhole size={21} /><div><strong>Your wallet is not required.</strong><p>The explorer accepts public addresses only. Never paste a seed phrase, private key, or wallet signing request into Tare.</p></div></div>
      </section>

      <section className="doc-section" id="faq">
        <p className="section-label">Common questions</p><h2>Quick answers</h2>
        <div className="faq-list">
          <details><summary>Does Tare move money?</summary><p>No. The public explorer and API are read only. A separate bounded testnet execution component exists for controlled Chainlink workflow testing, but it is not exposed through this explorer.</p></details>
          <details><summary>Why can a report be incomplete?</summary><p>A provider may be unavailable, the requested position may be empty, two observations may disagree, or the requested proof may be outside Tare's current scope. Incomplete is a useful result because it prevents unsupported claims.</p></details>
          <details><summary>Can I use Tare without technical knowledge?</summary><p>Yes. Start with a recorded example, then read the source, result, findings, and limitations sections in order.</p></details>
          <details><summary>Is there an SDK?</summary><p>There is no published Tare SDK yet. Developers can use the HTTP API, OpenAPI contract, MCP server, or command line interface.</p></details>
        </div>
      </section>

      <div className="docs-next"><BookOpen size={22} /><div><strong>Building with Tare?</strong><p>See the API, MCP, command line, and client generation guide.</p></div><AppLink href="/developers" className="text-link">Developer guide <ArrowRight size={16} /></AppLink></div>
    </article>
  </div>;
}

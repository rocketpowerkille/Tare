import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, CircleHelp, Database, Eye, LockKeyhole, Network } from '../components/Icons';
import { AppLink } from '../components/AppLink';

const sections = [
  ['overview', 'Overview'],
  ['how-it-works', 'How it works'],
  ['reading-a-report', 'Read a report'],
  ['using-the-explorer', 'Use the explorer'],
  ['access', 'Access'],
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
        <p className="section-label">Reading a report</p><h2>Six labels matter most</h2>
        <div className="definition-list">
          <div><strong>Your position</strong><p>The amount of the underlying asset that the wallet's vault shares converted to at the checked block. It is not a wallet cash balance or a guarantee that the full amount can be redeemed.</p></div>
          <div><strong>Live</strong><p>The report requested current data from configured providers at the time shown.</p></div>
          <div><strong>Recorded</strong><p>The report replayed a saved capture. It is useful for reproducibility but does not describe current state.</p></div>
          <div><strong>Matched</strong><p>The compared observations agreed within the narrow check shown in the report.</p></div>
          <div><strong>Incomplete</strong><p>Required evidence was missing, unavailable, inconsistent, or outside the supported scope.</p></div>
          <div><strong>Unavailable metric</strong><p>Tare did not have enough verified evidence to calculate the metric safely.</p></div>
        </div>
        <div className="callout warning"><AlertTriangle size={21} /><div><strong>Matched does not mean risk free.</strong><p>A matched custody or accounting check only supports the scope named in that report. It does not prove every underlying loan, price, or protocol assumption.</p></div></div>
      </section>

      <section className="doc-section" id="using-the-explorer">
        <p className="section-label">Using the explorer</p><h2>Check a position in three steps</h2>
        <ol className="numbered-steps">
          <li><span>1</span><div><strong>Paste your wallet address</strong><p>Use the public address that holds the vault shares. Never enter a seed phrase or private key.</p></div></li>
          <li><span>2</span><div><strong>Find or paste the vault</strong><p>Tare can search Morpho's index for supported MetaMorpho V1 positions. Choose a result, or paste the vault contract address yourself.</p></div></li>
          <li><span>3</span><div><strong>Check the position</strong><p>Start with Your position to see the share value and allocation path. Then read what the evidence means, what remains unknown, and what you can do next. Technical settings and the full JSON report stay optional.</p></div></li>
        </ol>
        <div className="plain-example"><strong>Just want to learn first?</strong><p>Open a saved example from the explorer. Saved examples explain the report format, but they are not a fresh check of your position.</p></div>
        <AppLink href="/explore" className="button primary">Open the explorer <ArrowRight size={17} /></AppLink>
      </section>

      <section className="doc-section" id="access">
        <p className="section-label">Access</p><h2>Use a code or pay with test USDC</h2>
        <p>Tare is in private beta. You can enter an access code, or create a short-lived Explorer session through the Bazantic sandbox.</p>
        <ol className="numbered-steps">
          <li><span>1</span><div><strong>Open Bazantic Playground</strong><p>Select the Tare gateway and choose the Start sandbox session operation.</p></div></li>
          <li><span>2</span><div><strong>Send an empty JSON object</strong><p>Bazantic quotes and settles the request using Base Sepolia test USDC. No mainnet funds are used.</p></div></li>
          <li><span>3</span><div><strong>Copy the access token</strong><p>Paste the returned token into Tare Explorer. It is kept only in the current browser tab and expires after a short period.</p></div></li>
        </ol>
        <div className="callout safe"><LockKeyhole size={21} /><div><strong>Testnet only.</strong><p>Mainnet payment access is a future stretch goal and is not enabled in this release.</p></div></div>
        <a className="text-link" href="https://bazantic.com/playground" target="_blank" rel="noreferrer">Open Bazantic Playground <ArrowRight size={16} /></a>
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
          <details><summary>Can I use Tare without technical knowledge?</summary><p>Yes. Enter your public wallet address and let Tare find supported vault candidates. Choose one and press Check this position. Start with What this means, What to do next, and What remains unknown. The technical sections are optional.</p></details>
          <details><summary>Can Tare find all of my vaults from my wallet?</summary><p>Tare can find indexed MetaMorpho V1 candidates. It is not a general wallet portfolio scanner, and an empty search does not prove that the wallet has no positions. Every selected candidate is checked with direct blockchain reads before Tare reports it.</p></details>
          <details><summary>What amount does Tare show?</summary><p>For supported vault traces, Your position shows how much of the underlying asset the wallet's vault shares converted to at the checked block. Tare separately shows where the vault allocates assets and whether the available evidence verifies backing. A position amount does not by itself prove liquidity, safety, or redeemability.</p></details>
          <details><summary>Is there an SDK?</summary><p>There is no published Tare SDK yet. Developers can use the HTTP API, OpenAPI contract, MCP server, or command line interface.</p></details>
        </div>
      </section>

      <div className="docs-next"><BookOpen size={22} /><div><strong>Building with Tare?</strong><p>See the API, MCP, command line, and client generation guide.</p></div><AppLink href="/developers" className="text-link">Developer guide <ArrowRight size={16} /></AppLink></div>
    </article>
  </div>;
}

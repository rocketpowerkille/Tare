import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, CircleHelp, Database, Eye, LockKeyhole, Network } from '../components/Icons';
import { AppLink } from '../components/AppLink';

const sections = [
  ['overview', 'Overview'],
  ['how-it-works', 'How it works'],
  ['reading-a-report', 'Read a report'],
  ['using-the-explorer', 'Use the explorer'],
  ['graph-verification', 'Graph verification'],
  ['access', 'Access'],
  ['assistant', 'Ask about a report'],
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
          <div><strong>Live</strong><p>The report acquired provider data during the check. Its selected block may be historical or the latest indexed block, not necessarily the chain head.</p></div>
          <div><strong>Recorded</strong><p>The report replayed a saved capture. It is useful for reproducibility but does not describe current state.</p></div>
          <div><strong>Matched</strong><p>The compared observations agreed within the narrow check shown in the report.</p></div>
          <div><strong>Incomplete</strong><p>Required evidence was missing, unavailable, inconsistent, or outside the supported scope.</p></div>
          <div><strong>Unavailable metric</strong><p>Tare did not have enough verified evidence to calculate the metric safely.</p></div>
        </div>
        <h3>Keep evidence categories separate</h3>
        <p><strong>Observed</strong> means source-reported data. <strong>Derived</strong> means a calculation from observations. <strong>Market-priced</strong> means a reference-price estimate. <strong>Checked</strong> means a scoped comparison. <strong>Inferred</strong> depends on assumptions. <strong>Not verified</strong> means the evidence does not establish the claim, not that the claim is false.</p>
        <div className="callout warning"><AlertTriangle size={21} /><div><strong>Matched does not mean risk free.</strong><p>A matched custody or accounting check only supports the scope named in that report. It does not prove every underlying loan, price, or protocol assumption.</p></div></div>
      </section>

      <section className="doc-section" id="using-the-explorer">
        <p className="section-label">Using the explorer</p><h2>Check a position in three steps</h2>
        <ol className="numbered-steps">
          <li><span>1</span><div><strong>Paste your wallet address</strong><p>Use the public address that holds the vault shares. Never enter a seed phrase or private key.</p></div></li>
          <li><span>2</span><div><strong>Find or paste the vault</strong><p>Tare searches Morpho V1 and V2 positions on Ethereum, Base, and Arbitrum. It also searches the deployment's public ERC-4626 registry, including Base Sepolia entries. Choose a supported result, or paste any ERC-4626 vault contract yourself.</p></div></li>
          <li><span>3</span><div><strong>Run evidence check</strong><p>Tare runs the direct position trace and configured, eligible source checks. The combined report separates The Graph comparison, Chainlink reference valuation and access-session metadata. Session authorization is not vault evidence. Start with the summary, source cards and limitations; technical details and JSON remain available.</p></div></li>
        </ol>
        <div className="plain-example"><strong>Just want to learn first?</strong><p>Open a saved example from the explorer. Saved examples explain the report format, but they are not a fresh check of your position.</p></div>
        <p>Discovery searches supported networks automatically. Selecting a supported candidate fills the network and check type; manual configuration remains under Advanced options. A discovered position can be unsupported for analysis if its adapter or RPC is missing.</p>
        <p>The evidence timeline follows real requests. Position, layer and allocation results arrive together in the primary response, not as a live blockchain event stream. A source is not marked complete merely because time has passed.</p>
        <p>To check several positions, expand <strong>Investigate a wallet across supported vaults</strong>. It discovers up to 10 candidates and analyzes at most 3 supported positions with eligible source checks. This makes new read-only requests and is not a complete wallet inventory.</p>
        <AppLink href="/explore" className="button primary">Open the explorer <ArrowRight size={17} /></AppLink>
      </section>

      <section className="doc-section" id="graph-verification">
        <p className="section-label">Graph verification</p><h2>One check, two Graph products, one blockchain reference</h2>
        <p>When configured, The Graph composition runs alongside supported Ethereum MetaMorpho V1 analysis. It can also run from Advanced options. The Token API and Studio provide distinct observations; Studio accounting coverage is specific to the configured vault, not every discovered vault.</p>
        <ol className="numbered-steps">
          <li><span>1</span><div><strong>Token API reads the position</strong><p>The Graph Token API reports the wallet's current balance of vault-share tokens.</p></div></li>
          <li><span>2</span><div><strong>The subgraph reads the vault</strong><p>Tare's Subgraph Studio deployment supplies the normalized accounting checkpoint for the same supported vault.</p></div></li>
          <li><span>3</span><div><strong>RPC checks both claims</strong><p>Tare reads the share balance and the complete vault accounting set directly at the subgraph block. A newer Token API update, a missing record, or a different value becomes an incomplete or mismatch result.</p></div></li>
        </ol>
        <div className="callout safe"><CheckCircle2 size={21} /><div><strong>Why this matters.</strong><p>The Token API makes the wallet balance easy to retrieve. The subgraph gives Tare a reusable accounting model. The RPC comparison keeps the two Graph products from becoming unverified assumptions.</p></div></div>
      </section>

      <section className="doc-section" id="access">
        <p className="section-label">Access</p><h2>Use a code or pay with test USDC</h2>
        <p>When this deployment requires access, use a configured Tare access code or obtain a short-lived session through the Bazantic sandbox. An accepted session authorizes analysis. It does not verify vault custody or prove payment settlement.</p>
        <ol className="numbered-steps">
          <li><span>1</span><div><strong>Install, sign in and create a grant</strong><p>Run <code>npm i -g @bazantic/cli@latest</code>, then <code>baz login</code>. Fund your Bazantic receiving address with Base Sepolia test USDC and create a bounded testnet grant. Login alone does not authorize spending.</p></div></li>
          <li><span>2</span><div><strong>Call Tare's public gateway</strong><p>Use the session command in the setup guide. It requests a session for 0.001 test USDC with that maximum amount. Payment challenges and successful settlement are different states; inspect the actual response.</p></div></li>
          <li><span>3</span><div><strong>Paste only the access code</strong><p>Use <code>body.accessToken</code> from the CLI response, without quotes. The Git Bash token-only alternative prints it directly in the terminal without a clipboard utility. Run one command option, not both. The session defaults to 15 minutes; the returned expiry is authoritative. Reloading clears the tab's credential.</p></div></li>
        </ol>
        <div className="callout safe"><LockKeyhole size={21} /><div><strong>Testnet only.</strong><p>Mainnet payment access is a future stretch goal and is not enabled in this release.</p></div></div>
        <AppLink className="text-link" href="/developers">See the exact gateway commands <ArrowRight size={16} /></AppLink>
      </section>

      <section className="doc-section" id="assistant">
        <p className="section-label">Bazantic investigation assistant</p><h2>Ask about the evidence already on screen</h2>
        <p>After a report appears, <strong>Ask with Bazantic</strong> can explain your position, evidence gaps, source disagreement or next checks when enabled on the deployment. Choose a question, read the data-transfer notice and explicitly consent. Tare sends classified report facts and your question to the configured pinned-report Recipe, not a new vault analysis.</p>
        <div className="doc-cards">
          <article><BookOpen size={21} /><h3>Copy context</h3><p>Copies deterministic facts for an assistant you choose. This action makes no Bazantic or AI request.</p></article>
          <article><Network size={21} /><h3>Public Recipe</h3><p>Opens Explain DeFi Vault Evidence Clearly on Bazantic. This is a separate workflow; it does not automatically receive the report on screen.</p><a className="text-link" href="https://bazantic.com/recipes/explain-defi-vault-evidence-clearly" target="_blank" rel="noreferrer">Open public Recipe</a></article>
          <article><Database size={21} /><h3>In-page assistant</h3><p>Runs the configured Recipe against temporary pinned context and displays a seven-section cited answer. No payment is authorized; a payment challenge stops execution.</p></article>
        </div>
        <p>Context expires from Tare after 10 minutes and is lost on restart. Bazantic may retain execution data. Do not include credentials. This browser-submitted snapshot is not independent authentication of its sources. Saved reports remain saved evidence.</p>
        <p>Follow fact citations and inspect the exact facts sent. A completed answer passed format, citation-ID and page-retrieval checks, not a factual correctness audit. <code>review-required</code> withholds an invalid answer; <code>unavailable</code> means execution could not complete. Neither changes your original report, and failures are not automatically retried.</p>
        <p><strong>Compare with a previous report</strong> accepts report JSON, not a raw capture. Comparisons require the same network, wallet, vault and operation. Differences are not proof of a transaction, profit or loss. Downloaded reports and captures remain available separately; there is no durable public report-link store.</p>
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
          <details><summary>Can I use Tare without technical knowledge?</summary><p>Enter your public wallet address, find a supported vault candidate and select Run evidence check. Read the summary, evidence path and limitations first. The optional Bazantic assistant can explain the result, but does not add verification.</p></details>
          <details><summary>Why are live checks unavailable?</summary><p>The deployment may lack an RPC or another required provider, even while discovery works. A found candidate can also use an unsupported adapter. Saved examples remain historical; they do not fix missing live coverage.</p></details>
          <details><summary>What does Chainlink price per unit mean?</summary><p>It is the USD reference price for one whole unit of the named underlying asset, not one raw integer unit or necessarily one vault share. Check the asset, source and timestamp. A price does not establish custody or backing.</p></details>
          <details><summary>Does Explorer run the scheduled Chainlink workflow?</summary><p>No. Eligible Explorer price checks are separate from the scheduled CRE policy workflow. The latest retained workflow record is paused with execution disabled; opening this page does not resume it.</p></details>
          <details><summary>Can Tare find all of my vaults from my wallet?</summary><p>Tare automatically finds indexed Morpho V1 and V2 positions on Ethereum, Base, and Arbitrum. Other ERC-4626 protocols have no universal wallet lookup, so automatic discovery is limited to the public registry configured by this deployment. You can still paste any ERC-4626 vault address for a direct check. An empty search does not prove that the wallet has no other positions.</p></details>
          <details><summary>What does Supported now mean?</summary><p>It means this deployment has both a compatible adapter and a configured RPC for that network. Position found, analysis not supported yet means the index saw shares, but Tare will not imply that its current adapters can safely explain the position.</p></details>
          <details><summary>What amount does Tare show?</summary><p>For supported vault traces, Your position shows how much of the underlying asset the wallet's vault shares converted to at the checked block. Tare separately shows where the vault allocates assets and whether the available evidence verifies backing. A position amount does not by itself prove liquidity, safety, or redeemability.</p></details>
          <details><summary>Is there an SDK?</summary><p>There is no published Tare SDK yet. Developers can use the HTTP API, OpenAPI contract, MCP server, or command line interface.</p></details>
        </div>
      </section>

      <div className="docs-next"><BookOpen size={22} /><div><strong>Building with Tare?</strong><p>See the API, MCP, command line, and client generation guide.</p></div><AppLink href="/developers" className="text-link">Developer guide <ArrowRight size={16} /></AppLink></div>
    </article>
  </div>;
}

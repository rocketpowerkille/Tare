import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, CircleHelp, Database, Eye, LockKeyhole, Network } from '../components/Icons';
import { AppLink } from '../components/AppLink';

const sections = [
  ['overview', 'Overview'],
  ['workspaces', 'Choose a workspace'],
  ['coverage', 'Vault and network coverage'],
  ['how-it-works', 'How it works'],
  ['reading-a-report', 'Read a report'],
  ['using-the-explorer', 'Use the explorer'],
  ['graph-verification', 'Graph verification'],
  ['access', 'Access'],
  ['assistant', 'Ask about a report'],
  ['changes', 'Changes and overlap'],
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

      <section className="doc-section" id="workspaces">
        <p className="section-label">Choose a workspace</p><h2>Explorer, Investigate or Examples?</h2>
        <div className="doc-cards">
          <article><h3><AppLink href="/explore">Explorer</AppLink></h3><p>What does this one position rest on? Select one wallet–vault pair for a detailed trace, observed values, eligible source checks and limitations.</p></article>
          <article><h3><AppLink href="/investigate">Investigate</AppLink></h3><p>What do my positions share, or what changed? Check at most 3 supported positions for shared market dependencies, or compare one position at two explicit blocks.</p></article>
          <article><h3><AppLink href="/examples">Examples</AppLink></h3><p>How do I read or reproduce a report? Replay saved examples or upload a compatible capture. This does not acquire fresh blockchain evidence.</p></article>
        </div>
        <p>Explorer and Investigate reuse the same evidence engine. Investigate adds comparisons, not stronger verification: it is neither a complete wallet inventory nor continuous monitoring. Shared markets do not predict losses; changed values do not establish their cause. Bazantic can explain the returned facts after consent, but does not add verification.</p>
        <p>Investigate opens Wallet overview immediately; select Changes over time for comparisons. Switching tool tabs preserves inputs and results. Report sidebar tabs show one section at a time and support arrow keys, Home and End. Navigating to another workspace or refreshing clears reports and inputs, so download anything you want to keep. An accepted access code is restored separately.</p>
        <p>Use the theme button in the header to switch between dark and light. Dark is the default; your preference is remembered when browser storage is available.</p>
      </section>

      <section className="doc-section" id="coverage">
        <p className="section-label">Vault and network coverage</p><h2>What can Tare analyze?</h2>
        <div className="definition-list">
          <div><strong>Morpho V1 · Ethereum, Base, Arbitrum</strong><p>Wallet shares, conversion quotes and supported Morpho market exposure. The deployment needs a working RPC for the selected network.</p></div>
          <div><strong>Morpho V2 · supported Ethereum USDC vaults</strong><p>Bounded nested V2-to-V1 traversal. Finding a V2 position elsewhere does not mean its nested analysis is supported.</p></div>
          <div><strong>Euler EVK / EulerEarn · Ethereum, Base, Arbitrum</strong><p>Enabled discovery finds direct supply candidates; analysis checks ERC-4626 shares and conversion quotes. It does not assess debt, subaccounts, liquidation risk or downstream backing.</p></div>
          <div><strong>Other ERC-4626 vaults</strong><p>Enter a compatible contract address on those three networks or Base Sepolia, or use a configured registry entry. Generic accounting does not trace arbitrary strategies. Yearn discovery is not yet integrated.</p></div>
        </div>
        <p>Discovery considers at most 100 Euler entries; omissions and source failures stay visible. The wallet investigation analyzes at most 3 of its 10 discovery candidates. Source checks have narrower coverage: Graph composition and Chainlink reference valuation are Ethereum-only, and Studio accounting is specific to its configured vault. The two-block live comparison currently supports Ethereum Morpho V1.</p>
      </section>

      <section className="doc-section" id="changes">
        <p className="section-label">Changes and overlap</p><h2>What changed between two blocks?</h2>
        <p>Select “Changes over time” on the <AppLink href="/investigate">Investigate page</AppLink>. Enter an Ethereum Morpho V1 wallet, vault and two increasing blocks, or compare two downloaded reports. Historical RPC and indexed Graph coverage are required for live acquisition; missing history is never replaced with latest data.</p>
        <p>Tare compares share balances, accounting quotes, fees and supported market amounts using exact raw units and market identities. An endpoint difference does not establish its cause, an intervening transaction or profit. This is on-demand analysis, not a scheduled monitor.</p>
        <p>The wallet investigation also shows shared Morpho V1 markets across its bounded results. Different-block amounts are never summed. Nested and unsupported positions remain coverage gaps; collateral and oracle dependencies are not directly owned assets. No overlap found does not prove diversification.</p>
        <p>You can separately consent to a Bazantic explanation of the returned comparisons and limitations. The assistant adds interpretation, not a new blockchain check.</p>
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
          <li><span>2</span><div><strong>Find or paste the vault</strong><p>Tare searches Morpho positions and, when enabled, Euler supply positions on Ethereum, Base and Arbitrum. It also searches the deployment's public ERC-4626 registry, including Base Sepolia entries. Results show which analysis is supported. Choose one, or paste a compatible vault address.</p></div></li>
          <li><span>3</span><div><strong>Run evidence check</strong><p>Tare runs the direct position trace and configured, eligible source checks. The combined report separates The Graph comparison, Chainlink reference valuation and access-session metadata. Session authorization is not vault evidence. Start with the summary, source cards and limitations; technical details and JSON remain available.</p></div></li>
        </ol>
        <div className="plain-example"><strong>Just want to learn first?</strong><p>Open the <AppLink href="/examples">Examples page</AppLink> to replay saved evidence or upload a capture. Saved examples explain the report format, but they are not a fresh check of your position.</p></div>
        <p>Discovery searches supported networks automatically. Selecting a supported candidate fills the network and check type; manual configuration remains under Advanced options. A discovered position can be unsupported for analysis if its adapter or RPC is missing.</p>
        <p>The evidence timeline follows real requests. Position, layer and allocation results arrive together in the primary response, not as a live blockchain event stream. A source is not marked complete merely because time has passed.</p>
        <p>To check several positions, open <AppLink href="/investigate">Investigate</AppLink> and expand <strong>Investigate a wallet across supported vaults</strong>. It discovers up to 10 candidates and analyzes at most 3 supported positions with eligible source checks. This makes new read-only requests and is not a complete wallet inventory.</p>
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
          <li><span>2</span><div><strong>Call Tare's public gateway</strong><p>Use the token-only command in the setup guide in Git Bash or Bash / Zsh. It approves one session request capped at 0.001 test USDC and extracts the access code locally with Node.js. Repeating the command requests another paid session.</p></div></li>
          <li><span>3</span><div><strong>Paste only the access code</strong><p>Copy the single code printed in the terminal, without quotes. Do not paste an error message. No clipboard utility is required. The session defaults to 15 minutes; the returned expiry is authoritative. The accepted credential stays in this tab across refreshes and is revalidated without extending its expiry. Use “Disconnect session” beneath the service status to clear the credential and current workspace before switching keys; this does not revoke the key or grant. The code is authorization, not a settlement receipt or vault evidence.</p></div></li>
        </ol>
        <h3>How many access codes does a grant cover?</h3>
        <p><code>--cap 0.01</code> sets a total spending ceiling. At 0.001 test USDC per session, <code>0.01 / 0.001 = 10</code>: at most 10 session purchases from an unused grant, assuming no other charged calls and an unchanged price. It does not guarantee ten codes or supply test funds. <code>--max-amount 0.001</code> caps one request, not the whole grant.</p>
        <p>This is not a ten-analysis limit. Reuse an unexpired access code for multiple analyses, subject to API quotas and source availability. Repeating the gateway command requests another paid session. If the remaining budget or balance is insufficient, inspect the grant and test USDC balance before retrying; do not automatically increase spending. Session access and Recipe execution remain separate.</p>
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
          <details><summary>Can Tare find all of my vaults from my wallet?</summary><p>No. Discovery combines indexed Morpho positions, enabled Euler supply discovery and configured ERC-4626 vaults. Euler reads at most 100 indexed entries and omits subaccounts, deprecated vaults and unsupported types. Euler analysis checks supply shares and conversion quotes, not borrowing or lending risks. Yearn discovery is not yet integrated. Compatible vaults can still be checked by address. Empty results never prove a wallet has no other positions.</p></details>
          <details><summary>What does Supported now mean?</summary><p>It means this deployment has both a compatible adapter and a configured RPC for that network. Position found, analysis not supported yet means the index saw shares, but Tare will not imply that its current adapters can safely explain the position.</p></details>
          <details><summary>What amount does Tare show?</summary><p>For supported vault traces, Your position shows how much of the underlying asset the wallet's vault shares converted to at the checked block. Tare separately shows where the vault allocates assets and whether the available evidence verifies backing. A position amount does not by itself prove liquidity, safety, or redeemability.</p></details>
          <details><summary>Is there an SDK?</summary><p>There is no published Tare SDK yet. Developers can use the HTTP API, OpenAPI contract, MCP server, or command line interface.</p></details>
        </div>
      </section>

      <div className="docs-next"><BookOpen size={22} /><div><strong>Building with Tare?</strong><p>See the API, MCP, command line, and client generation guide.</p></div><AppLink href="/developers" className="text-link">Developer guide <ArrowRight size={16} /></AppLink></div>
    </article>
  </div>;
}

import { Check, Copy, ExternalLink, Terminal } from '../components/Icons';
import { useState } from 'react';
import { BAZANTIC_GATEWAY_URL, BAZANTIC_SESSION_PATH } from '../lib/bazantic';
import { BazanticAccessGuide } from '../components/BazanticAccessGuide';
import { DeveloperEndpoints } from '../components/DeveloperEndpoints';

const curlExample = `curl https://tare.visk404.dev/api/agent-example \\
  -H "Authorization: Bearer $TARE_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "steakhouse-usdc"
  }'`;

const mcpExample = `{
  "mcpServers": {
    "tare": {
      "command": "node",
      "args": ["/absolute/path/to/tare/dist/apps/mcp/src/main.js"]
    }
  }
}`;

const graphExample = `curl https://tare.visk404.dev/api/analyze \\
  -H "Authorization: Bearer $TARE_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "operation": "verify-graph-composition",
    "owner": "0x9fc3dc011b461664c835f2527fffb1169b3c213e",
    "vault": "0xbeef01735c132ada46aa9aa4c54623caa92a64cb"
  }'`;

export function DevelopersPage() {
  return <div className="developer-page page-width">
    <header className="page-intro compact-intro">
      <p className="kicker">Developer guide</p>
      <h1>Use Tare through HTTP, MCP, or the command line.</h1>
      <p className="lead">The interfaces share evidence calculations and preserve the same evidence boundaries. Their available commands and tools differ.</p>
      <div className="developer-links"><a href="/openapi.json">OpenAPI 3.0 <ExternalLink size={15} /></a><a href="/openapi-mcp-v3.json">Tare gateway contract <ExternalLink size={15} /></a><a href="/openapi-graph.json">Graph gateway contract <ExternalLink size={15} /></a></div>
    </header>

    <section className="developer-section">
      <div className="section-heading"><p className="kicker">HTTP API</p><h2>Start with a reproducible saved report</h2><p>Set TARE_API_TOKEN privately in your shell to a configured Tare code or valid Explorer session. This direct API example performs no payment or fresh blockchain query. Provider URLs and credentials stay on the server.</p></div>
      <CodeBlock code={curlExample} label="Git Bash / macOS / Linux" />
      <p className="developer-note">Run GET /api/status with the same bearer token before choosing a live operation. A single /api/analyze call does not run the browser's whole Graph and Chainlink pipeline. Local setup uses Node 24 or later and pnpm 11.19.0: install dependencies, run pnpm build, then pnpm serve. Default URL: http://127.0.0.1:4318. The server does not load .env automatically.</p>
      <p>Web/API discovery combines Morpho, enabled Euler and configured ERC-4626 vaults. Inspect discoveryProtocols and networks in /api/status. Euler supply analysis uses resolve-erc4626 with the returned chainId; its debt and subaccounts remain outside this check. CLI live discover is Morpho-only.</p>
      <a className="text-link" href="https://github.com/rocketpowerkille/ETHOnline/blob/main/docs/OPERATIONS.md">Local configuration, CLI commands and verification <ExternalLink size={15} /></a>
    </section>

    <section className="developer-section" id="bazantic-sandbox">
      <div className="section-heading"><p className="kicker">Bazantic sandbox</p><h2>Create a short-lived Explorer session</h2><p>These commands use the public Tare gateway. Login, a spend grant, an Explorer session and Recipe execution are separate steps. Session authorization is not vault evidence or a settlement receipt.</p></div>
      <BazanticAccessGuide gatewayUrl={BAZANTIC_GATEWAY_URL} sessionPath={BAZANTIC_SESSION_PATH} />
      <p className="developer-note">The token-only command includes --yes and a 0.001 test USDC per-request maximum. The grant's --cap 0.01 is a separate total budget: at the documented price, at most 10 session purchases if unused and spent only on sessions. A session supports multiple API requests until expiry, subject to quotas; it is not one analysis credit. If tare-demo already exists, use a new grant name and the same name in --account. Returned expiresAt is authoritative; 15 minutes is the default. Mainnet payment access is not supported by this session flow.</p>
    </section>

    <section className="developer-section">
      <div className="section-heading"><p className="kicker">The Graph</p><h2>Compose Token API and Studio accounting</h2><p>This operation compares the wallet's vault-share balance and the subgraph accounting checkpoint with direct Ethereum RPC reads. The Graph Market token remains server-side.</p></div>
      <CodeBlock code={graphExample} label="Git Bash / macOS / Linux" />
      <p className="developer-note">Requires configured Ethereum RPC, Graph Token API access and eligible Studio coverage. Accounting uses its indexed head; source blocks may differ from the position trace. Accounting agreement is not backing. A completed historical subgraph sync still needs separate ledger/RPC acceptance.</p>
    </section>

    <section className="developer-section" id="workspaces">
      <div className="section-heading"><p className="kicker">Web workspaces</p><h2>One evidence engine, different scopes</h2></div>
      <p><a href="/explore">Explorer</a> orchestrates one selected position's analysis and eligible Graph/Chainlink checks. <a href="/investigate">Investigate</a> uses /api/investigation/wallet for bounded multi-position reports and shared-market comparisons, or existing /api/analyze operations for two-block changes. <a href="/examples">Examples</a> uses /api/example and /api/replay for saved evidence. These are distinct web routes, not new evidence methodologies.</p>
      <p>All three share tab-scoped access. “Disconnect session” clears the saved credential and reloads the workspace without revoking the key or grant. Comparing reports does not create synchronized observations, prove backing or explain causation; source blocks, coverage and limitations remain attached.</p>
    </section>

    <DeveloperEndpoints />

    <section className="developer-section">
      <div className="section-heading"><p className="kicker">Chainlink</p><h2>Price the accounting quote, preserve its scope</h2></div>
      <p>POST /api/analyze with operation value-position supports allowlisted native USDC and canonical WETH on chain IDs 1, 8453 and 42161. Supply asset, amountRaw, assetDecimals and the position's blockNumber and blockHash. /api/status lists configured chainlinkAssets. Other assets and Base Sepolia remain unsupported; token symbols never select a feed.</p>
      <p>Configure TARE_RPC_URL, TARE_BASE_MAINNET_RPC_URL and TARE_ARBITRUM_RPC_URL for their respective networks. Base and Arbitrum include same-block sequencer checks and a 3600-second recovery grace period. Stale, invalid or unavailable observations produce no estimate. L2 responses add sequencer provenance; no new payment or Chainlink API key is required to read these contracts through your RPC provider.</p>
      <p>Explorer and wallet investigations reuse this pricing path. Local tare_analyze exposes it through the shared schema; the compact gateway does not advertise a standalone valuation tool. The amount remains caller-supplied accounting, not custody or backing evidence. Euler downstream tracing and additional Graph accounting coverage require separate adapters and acceptance.</p>
    </section>

    <section className="developer-section two-up">
      <div>
        <div className="section-heading"><p className="kicker">MCP</p><h2>Connect an agent locally</h2><p>Build the project first, then point an MCP client at the stdio server.</p></div>
        <CodeBlock code={mcpExample} label="MCP configuration" />
        <p>Local stdio tools: <code>tare_status</code>, <code>tare_analyze</code>, <code>tare_replay</code>, <code>tare_example</code>, <code>tare_compose</code>. Configure providers in the MCP process environment. Its tool names differ from the gateway's compact surface.</p>
      </div>
      <div className="sdk-panel" id="sdk">
        <Terminal size={23} />
        <h2>SDK status</h2>
        <p>There is no published SDK package yet. The API uses standard JSON over HTTP, and the OpenAPI document can generate a typed client in most languages.</p>
        <a href="/openapi.json" className="text-link">Download the OpenAPI contract <ExternalLink size={15} /></a>
      </div>
    </section>

    <section className="developer-section" id="agent-access">
      <div className="section-heading"><p className="kicker">Agent access</p><h2>Gateway tools and Recipes are separate from local MCP</h2></div>
      <p>The Tare gateway exposes <code>tare_status</code>, <code>tare_discover_vaults</code>, <code>tare_analyze_compact</code>, <code>tare_example_compact</code>, <code>tare_start_bazantic_sandbox_session</code>, <code>tare_report_context</code> and <code>tare_compare_indexed_accounting</code>. Bazantic may also supply its own info tool.</p>
      <p>Use the gateway's connected schema, including its requestBody wrapper where present. The small agent contract does not expose value-position. Its discovery vault hint is not accepted by the current runtime: send owner and optional maxPositions only. Similarly, replay does not support value-position even though the shared full OpenAPI list includes it.</p>
      <a className="text-link" href={`${BAZANTIC_GATEWAY_URL}/mcp`}>Tare gateway MCP endpoint <ExternalLink size={15} /></a>
      <p>The separate Graph Studio gateway exposes <code>graph_tare_accounting_head</code>. Forward its unchanged Graph data object to <code>tare_compare_indexed_accounting</code> for a scoped RPC comparison. Caller-supplied Graph bytes remain labeled as such; this is not independent authentication or proof of backing.</p>
    </section>

    <section className="developer-section" id="investigation">
      <div className="section-heading"><p className="kicker">In-page Bazantic assistant</p><h2>Explain a pinned report, not a substituted analysis</h2></div>
      <ol className="numbered-steps">
        <li><span>1</span><div><strong>Check options and create a snapshot</strong><p>Read /api/investigation/options. Submit report and optional previous report to /api/investigation/snapshot. Keep the returned reference private; it expires after 10 minutes.</p></div></li>
        <li><span>2</span><div><strong>Start one consented run</strong><p>POST reference, a UUID requestId, question and consent: true to /api/investigation/run. Poll /api/investigation/run/&#123;id&#125; with the same access identity. Duplicate keys or the same snapshot/question reuse a retained record.</p></div></li>
        <li><span>3</span><div><strong>Inspect the result</strong><p>Complete means all context pages were read and the seven-section answer passed format, citation-ID and sensitive-output checks. It is not a factual correctness guarantee. Review-required withholds the answer; unavailable reports execution failure. Original evidence stays unchanged.</p></div></li>
      </ol>
      <p>The pinned Recipe calls only tare_report_context. It returns JSON sections with title, text and citations, unlike the public plain-language Recipe's prose answer. Tare's runner supplies the reference and required titles in the question. Do not interchange these Recipe definitions.</p>
      <p>Two-block change investigation reuses resolve-v1 and verify-accounting through /api/analyze with explicit blockNumber values. Snapshot comparisons add positionChanges and citeable comparison.scope / comparison.change.N facts. Wallet snapshots include current.overlap.scope / current.overlap.N facts. These derived differences and relationships preserve source blocks and raw units; they do not authenticate uploaded reports or establish causation.</p>
      <p>The additive verify-historical-graph operation uses /api/analyze and /api/replay, or tare_analyze and tare_replay over stdio MCP. It requires owner, the Steakhouse USDC vault and an optional blockNumber. Configure TARE_GRAPH_HISTORICAL_URL and TARE_GRAPH_HISTORICAL_DEPLOYMENT alongside an archive-capable TARE_RPC_URL. It returns separate share/accounting results at one historical block with executable: false. Refresh external gateway schemas before exposing the new operation there; historical reports are not yet accepted by the Recipe explanation flow.</p>
      <p>Execution is disabled by default. Operators set TARE_RECIPE_ENABLED=true and TARE_INVESTIGATION_RECIPE to their published pinned-report handle. The gateway must reach the same API instance and use the configured TARE_BAZANTIC_CLIENT_ID identity. Both the tool specification and its serving routes must be synced.</p>
      <p>Snapshots are browser-submitted claims, not authenticated source proofs. State is process-local, with 10-minute retention, at most 512 facts and 512,000 bytes of context. Use one instance; restarts lose references. Bazantic may retain execution data. No LLM provider SDK, model key or payer is added. Maximum authorized spend is 0 USDC; HTTP 402 stops execution with no automatic retry.</p>
      <p>A run's receipt field is execution metadata, not a payment receipt. Settlement is not confirmed and cost remains null. An Explorer session does not authorize Recipe spending. Copying explanation context and opening the external Recipe remain separate alternatives.</p>
      <a className="text-link" href="https://bazantic.com/recipes/explain-defi-vault-evidence-clearly" target="_blank" rel="noreferrer">Open public plain-language Recipe <ExternalLink size={15} /></a>
    </section>

    <section className="developer-section" id="operations">
      <div className="section-heading"><p className="kicker">Operations and troubleshooting</p><h2>Configuration is not evidence</h2></div>
      <p>Use the custom domain https://tare.visk404.dev, not the former Render subdomain. Set TARE_PUBLIC_ORIGIN to the exact HTTPS origin and update the Tare gateway upstream when moving domains. The Graph gateway upstream stays on Graph Studio. A healthy /healthz response does not verify provider access, payment or Recipe execution.</p>
      <p>401 means invalid, missing or expired access; 403 can indicate an untrusted Host/Origin or the wrong gateway identity; 415 requires application/json; 429 indicates a quota or concurrency limit. Check error.code and error.message. A 200 response can still contain an incomplete report or a review-required assistant result.</p>
      <p>Review-required diagnostics distinguish invalid JSON/schema, wrong section order, unread pages, unknown citations and sensitive output. Do not bypass the validator. A timeout may leave remote execution unresolved, so do not automatically create another run.</p>
    </section>

    <section className="developer-section">
      <div className="section-heading"><p className="kicker">Response rules</p><h2>Build around evidence state, not optimistic assumptions</h2></div>
      <ul className="developer-rules">
        <li><Check size={18} /><span>Compact agent responses add <code>explanationContext</code>: deterministic facts, source provenance and explanation boundaries. No model is called. Full report routes remain unchanged.</span></li>
        <li><Check size={18} /><span>Inspect <code>sourceMode</code> before describing evidence as live.</span></li>
        <li><Check size={18} /><span>Treat <code>incomplete</code> and <code>mismatch</code> as valid analytical results.</span></li>
        <li><Check size={18} /><span>Use decimal strings for raw integer values. Do not coerce them to floating point.</span></li>
        <li><Check size={18} /><span>Read <code>limitations</code>, <code>findings</code>, and metric scope before displaying a verdict.</span></li>
        <li><Check size={18} /><span>Never send provider URLs, private keys, or wallet secrets in request bodies.</span></li>
      </ul>
    </section>
  </div>;
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setError(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { setError(true); }
  }
  return <div className="code-block"><div className="code-toolbar"><span>{label}</span><button type="button" aria-label={`Copy ${label} example`} onClick={() => void copy()}>{copied ? <Check size={15} /> : <Copy size={15} />}<span role="status">{copied ? 'Copied' : 'Copy'}</span></button></div><pre><code>{code}</code></pre>{error && <p role="alert">Clipboard unavailable. Select and copy the example manually.</p>}</div>;
}

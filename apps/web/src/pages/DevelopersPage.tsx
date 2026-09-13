import { Check, Copy, ExternalLink, Terminal } from '../components/Icons';
import { useState } from 'react';
import { bazanticGrantCommand, bazanticSessionCommand } from '../lib/bazantic';

const curlExample = `curl https://tare-api.onrender.com/api/analyze \\
  -H "Authorization: Bearer $TARE_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "operation": "verify-base-custody",
    "owner": "0xF1feA08EbBa92eD342Acc5639dB312C3694Bc391"
  }'`;

const mcpExample = `{
  "mcpServers": {
    "tare": {
      "command": "node",
      "args": ["/absolute/path/to/tare/dist/apps/mcp/src/main.js"]
    }
  }
}`;

const bazanticGrantExample = bazanticGrantCommand();
const bazanticExample = bazanticSessionCommand();

const graphExample = `curl https://tare-api.onrender.com/api/analyze \\
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
      <p className="lead">Every interface uses the same validated service layer and preserves the same evidence boundaries.</p>
      <div className="developer-links"><a href="/openapi.json">OpenAPI 3.0 <ExternalLink size={15} /></a><a href="/openapi-mcp.json">Agent contract <ExternalLink size={15} /></a></div>
    </header>

    <section className="developer-section">
      <div className="section-heading"><p className="kicker">HTTP API</p><h2>Run a live Base Sepolia custody check</h2><p>Hosted requests use a bearer token. Provider URLs and credentials stay on the server.</p></div>
      <CodeBlock code={curlExample} label="cURL" />
    </section>

    <section className="developer-section" id="bazantic-sandbox">
      <div className="section-heading"><p className="kicker">Bazantic sandbox</p><h2>Create a short-lived Explorer session</h2><p>Install <code>@bazantic/cli</code>, sign in, and fund your Bazantic receiving address with Base Sepolia test USDC. Create a bounded testnet grant, then call Tare's public gateway. Read the session token from <code>body.accessToken</code>. Mainnet access is not enabled.</p></div>
      <div className="developer-code-stack">
        <CodeBlock code={bazanticGrantExample} label="1. Create a Base Sepolia grant" />
        <CodeBlock code={bazanticExample} label="2. Call the public Tare gateway" />
      </div>
      <p className="developer-note">Bazantic Playground is a provider test console and only lists gateways owned by the current account. Customers call this public gateway with the CLI or an agent payment source.</p>
    </section>

    <section className="developer-section">
      <div className="section-heading"><p className="kicker">The Graph</p><h2>Compose Token API and Studio accounting</h2><p>This operation compares the wallet's vault-share balance and the subgraph accounting checkpoint with direct Ethereum RPC reads. The Graph Market token remains server-side.</p></div>
      <CodeBlock code={graphExample} label="cURL" />
    </section>

    <section className="developer-section">
      <div className="section-heading"><p className="kicker">Endpoints</p><h2>A small, explicit surface</h2></div>
      <div className="endpoint-table">
        <div className="endpoint-row endpoint-head"><span>Method</span><span>Path</span><span>Purpose</span></div>
        <div className="endpoint-row"><code>GET</code><code>/api/access-options</code><span>List public access methods without exposing secrets.</span></div>
        <div className="endpoint-row"><code>GET</code><code>/api/status</code><span>List capabilities, examples, and limits.</span></div>
        <div className="endpoint-row"><code>POST</code><code>/api/bazantic/session</code><span>Issue a short-lived session after a Bazantic sandbox payment.</span></div>
        <div className="endpoint-row"><code>POST</code><code>/api/discover</code><span>Find Morpho V1 and V2 positions across three mainnets plus configured ERC-4626 registry entries.</span></div>
        <div className="endpoint-row"><code>POST</code><code>/api/analyze</code><span>Acquire fresh read-only evidence.</span></div>
        <div className="endpoint-row"><code>POST</code><code>/api/replay</code><span>Recalculate a compatible saved capture.</span></div>
        <div className="endpoint-row"><code>POST</code><code>/api/example</code><span>Replay a retained public example.</span></div>
        <div className="endpoint-row"><code>POST</code><code>/api/compose</code><span>Join compatible resolution and share evidence.</span></div>
      </div>
    </section>

    <section className="developer-section two-up">
      <div>
        <div className="section-heading"><p className="kicker">MCP</p><h2>Connect an agent locally</h2><p>Build the project first, then point an MCP client at the stdio server.</p></div>
        <CodeBlock code={mcpExample} label="MCP configuration" />
      </div>
      <div className="sdk-panel" id="sdk">
        <Terminal size={23} />
        <h2>SDK status</h2>
        <p>There is no published SDK package yet. The API uses standard JSON over HTTP, and the OpenAPI document can generate a typed client in most languages.</p>
        <a href="/openapi.json" className="text-link">Download the OpenAPI contract <ExternalLink size={15} /></a>
      </div>
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
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return <div className="code-block"><div className="code-toolbar"><span>{label}</span><button type="button" onClick={() => void copy()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy'}</button></div><pre><code>{code}</code></pre></div>;
}

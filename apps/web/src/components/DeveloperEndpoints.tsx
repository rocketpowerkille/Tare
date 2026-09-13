const endpoints = [
  ['GET', '/healthz', 'Process health only, not source or Recipe health.'],
  ['GET', '/api/access-options', 'Public access methods without secrets.'],
  ['GET', '/api/status', 'Configured capabilities, examples and limits.'],
  ['POST', '/api/bazantic/session', 'Gateway-authorized sandbox session; body is {}.'],
  ['POST', '/api/discover', 'Owner and optional maxPositions; candidate discovery is not verification.'],
  ['POST', '/api/analyze', 'One supported operation with its exact required fields.'],
  ['POST', '/api/replay', 'Operation and compatible raw capture; no fresh source query.'],
  ['POST', '/api/example', 'Saved example selected by id.'],
  ['POST', '/api/compose', 'Compatible resolutionCapture, shareCapture and graphResponse.'],
  ['POST', '/api/agent-analyze', 'Compact analysis with deterministic explanationContext.'],
  ['POST', '/api/agent-example', 'Compact saved example, not fresh evidence.'],
  ['POST', '/api/agent-report-context', 'Gateway-only retrieval of an expiring reference and page.'],
  ['POST', '/api/agent-compare-accounting', 'Supplied Graph data and vault compared with pinned RPC.'],
  ['GET', '/api/investigation/options', 'Assistant enablement, Recipe handle and zero-spend policy.'],
  ['POST', '/api/investigation/snapshot', 'Report and optional previous report; bounded temporary context.'],
  ['POST', '/api/investigation/run', 'Reference, UUID requestId, question and consent: true.'],
  ['GET', '/api/investigation/run/{id}', 'Same-identity polling of an existing run.'],
  ['POST', '/api/investigation/wallet', 'Owner; up to 10 candidates and 3 supported analyses.'],
] as const;

export function DeveloperEndpoints() {
  return <section className="developer-section" id="endpoints">
    <div className="section-heading"><p className="kicker">Endpoints</p><h2>Explicit routes and scoped access</h2>
      <p>Hosted API routes require a bearer token except access-options. Session issuance and report-context retrieval additionally require the configured gateway API-key identity. Origin checks still apply to public routes.</p></div>
    <div className="endpoint-table" role="table" aria-label="HTTP endpoints">
      <div className="endpoint-row endpoint-head" role="row"><span role="columnheader">Method</span><span role="columnheader">Path</span><span role="columnheader">Purpose</span></div>
      {endpoints.map(([method, path, purpose]) => <div className="endpoint-row" role="row" key={path}>
        <code role="cell">{method}</code><code role="cell">{path}</code><span role="cell">{purpose}</span>
      </div>)}
    </div>
    <p className="developer-note">JSON requests require application/json. General input is limited to 5 MiB; snapshots to 1 MiB combined. Hosted quotas default to 60 requests per identity per minute. Operation-specific fields are strict: do not send every property listed in a shared OpenAPI schema.</p>
  </section>;
}

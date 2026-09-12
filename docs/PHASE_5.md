# Phase five — interfaces

Tare-side implementation, Bazantic integration and hosted API acceptance are
complete. The Docker
service is live at `https://tare-api.onrender.com`; public health, anonymous
rejection, authenticated status and two-provider Base Sepolia acquisition passed.
The Bazantic gateway exposes the compact Tare tools, and the published Recipe has
completed retained and fresh Base Sepolia runs. The rebuilt browser application
still requires deployment and hosted browser acceptance. Phase four's deadline-safe
hosted accounting acceptance is complete; its separate full-history share-ledger
acceptance remains open.

## Delivered

- [x] Shared service dispatches V1 and nested V2 resolution, share/accounting
  cross-checks and scoped WETH custody verification through existing modules.
- [x] HTTP API with strict request schemas and generated OpenAPI 3.1 inputs.
- [x] Official MCP SDK v2 stdio server: `tare_status`, `tare_analyze`,
  `tare_replay`, `tare_example`, `tare_compose`. Tools return JSON text and structured reports.
- [x] Modular React web application: product overview, guided explorer, beginner
  documentation, developer reference, recorded examples, configured live reads,
  capture import and report/capture downloads.
- [x] Three retained public examples replay without provider configuration.
- [x] Loopback binding, Host/Origin checks, 5 MiB input bound, two concurrent
  operations, source budgets, private configuration and sanitized errors.
- [x] Automated API/MCP parity, partial-result, input-boundary, configured source
  dispatch and failure tests. MCP tests use a real SDK client and child process.
- [x] Browser acceptance: saved report equals deterministic replay; saved capture
  equals the fixture; reimport reproduces the receipt; wrong-operation import
  clears stale results. Recorded examples and responsive layout checked.
- [x] Optional hosted authentication, exact HTTPS origin/Host policy, per-client
  quotas and an authenticated API contract, tested against real local HTTP.
- [x] Recipe composition endpoint/tool recomputes captures and checks the direct
  Graph response, identities, block context, deployment and share accounting.
  Missing sources, GraphQL partial errors and contradictions cannot pass.
- [x] Portable multi-stage Docker image, fail-closed external bind, public health
  endpoint and Render Blueprint. The built image passed a local hosted smoke test.
- [x] Render deployment and authenticated live acceptance. The retained consumed
  Base Sepolia control correctly reports an incomplete zero position.

## Deferred rollout gates

- [ ] Deploy the rebuilt browser bundle and complete hosted desktop/mobile acceptance.
- [ ] Bind a second sponsor service only if pursuing the separate multi-service Recipe prize.

Local verification: `node --run verify` runs 131 tests plus existing demo/replay
checks. The browser application uses React, Lucide icons and Vite while the API
keeps its existing runtime surface. Local
HTTP source fixtures are not live Graph or Bazantic acceptance evidence.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm serve
```

Open `http://127.0.0.1:4318`. Override the port with `TARE_PORT` in your shell.
The server loads no `.env` file automatically. Recorded examples and imports
work immediately. Live options read `TARE_RPC_URL`, `TARE_SECONDARY_RPC_URL`,
`TARE_GRAPH_URL`, `TARE_GRAPH_DEPLOYMENT`, and `GRAPH_API_KEY` from the process
environment. Configuration flags indicate presence, not provider health.
User wallet profiles remain optional and local; no signing key is needed.

The service requires the repository's `apps/web` and `fixtures/live` directories
alongside `dist`; it is not a standalone published npm package. Paths resolve
relative to the compiled module, so launching from another directory works.

## API contract

`GET /openapi.json` describes request bodies. `GET /api/status` returns configured
operations, limits and example IDs. The POST endpoints accept JSON:

| Endpoint | Request | Result |
| --- | --- | --- |
| `/api/example` | `{ "id": "ov-usdc-v2" }` | Replayed report |
| `/api/replay` | `{ "operation": "resolve-v2", "capture": {…} }` | Recalculated report |
| `/api/analyze` | Operation, public addresses, optional decimal-string block | Acquired report |
| `/api/compose` | `resolutionCapture`, `shareCapture`, `graphResponse` | Recomputed, joined evidence |

`operation` is one of `resolve-v1`, `resolve-v2`, `verify-shares`,
`verify-accounting`, `verify-weth`. Supply `owner` and `vault`, except accounting
needs only `vault` and WETH needs only `owner`. Ethereum is fixed. Graph-backed
operations enforce Graph's signed 32-bit block limit; other blocks use uint256.
Provider URLs, arbitrary paths and additional fields are rejected.

```json
{
  "operation": "resolve-v2",
  "owner": "0xba3356e6a4eac76980067dbaa3758e5e5685cfb7",
  "vault": "0x18032c694f8ebfdcc030cb8c54c3701a107c2f72",
  "blockNumber": "25940252"
}
```

HTTP 200 means a report was produced, including `partial`, `incomplete` and
`mismatch` reports. Inspect `status` (V1 uses `kind`), `sourceMode`, `findings`,
`metric` and its scope. Amounts remain decimal strings; never round them through
JavaScript `Number`. Uploaded captures are unsigned and replay cannot establish
freshness or authenticity. A digest identifies content, not a trusted signer.

Errors use `{ "error": { "code": "…", "message": "…" } }`: 400 invalid input,
401 missing/invalid hosted token, 403 rejected origin/host, 404 unknown route, 405 wrong method, 413 input too large,
415 wrong media type, 429 busy/client quota, 500 failed operation, 503 missing configuration.
Responses are not cached. No persistent wallet or report store is added.

Composition accepts raw V1 resolution and share-verification captures plus the
direct GraphQL response envelope (`data`, optional `errors`). It recalculates
both reports, compares the external Graph data with the share capture, and
checks their common position, block, quantities and expected deployment. Its
`recorded-composition` result never claims fresh or authenticated evidence.
Graph error presence survives replay; arbitrary provider error messages do not.

## Hosted access and deployment

Set `TARE_PUBLIC_ORIGIN` to an exact HTTPS origin and `TARE_API_KEYS` to a JSON
object mapping client IDs to distinct random tokens of 32–128 base64url characters.
Both are required together; malformed configuration fails startup. Configure
these through the hosting environment's secret store, not checked-in files.
`TARE_REQUESTS_PER_MINUTE` defaults to 60 per client (range 1–600).
On Render, the trusted platform-provided `RENDER_EXTERNAL_URL` supplies the origin
when `TARE_PUBLIC_ORIGIN` is absent. Set the latter explicitly for a custom domain.

The process binds `127.0.0.1` by default. `TARE_BIND_HOST=0.0.0.0` is accepted only
when hosted authentication is valid, allowing a managed ingress to reach the
container without weakening local defaults. Preserve the public Host header.
The application ignores forwarded-host and forwarded-IP headers; configure
ingress connection/body limits and a response timeout longer than five minutes.

The repository-root `render.yaml` provisions the API/explorer as a Singapore
Docker web service with `/healthz` readiness checks. Render supplies HTTPS and its
external origin. During Blueprint creation, provide `TARE_API_KEYS` and the
Blueprint supplies the public read-only provider settings. Add `GRAPH_API_KEY`
later through Render's secret environment settings only if the Graph endpoint
requires one. Never paste a wallet key, CRE private policy or CRE secret into this
service: the API remains read-only.

Every `/api/*` request requires `Authorization: Bearer <token>` in hosted mode.
The explorer prompts for a token only after a 401 and keeps it in memory, clearing
the input immediately. It never saves it in local storage, URLs or receipts.
Static assets and `/openapi.json` stay public; the hosted contract declares bearer
security and the configured server origin, never keys or provider URLs.

Quotas are fixed 60-second windows, keyed by at most 100 configured client IDs.
They reset on process restart and are not shared across replicas. Use a gateway
quota store before scaling beyond one process. Rejected authenticated requests
also consume quota; authentication happens before body parsing. 429 responses
include `Retry-After: 60`. These deployment controls are tested locally only.

## MCP configuration

Use a client's stdio configuration, adapting its configuration-file convention:

```json
{
  "mcpServers": {
    "tare": {
      "command": "node",
      "args": ["C:/MY_PROJECT/ETHOnline/dist/apps/mcp/src/main.js"]
    }
  }
}
```

Set providers in the child process environment when ready. Use the direct Node
entry point so package-manager banners cannot contaminate protocol stdout.
The server supports the SDK's modern and legacy stdio negotiation. Long live
reads may take up to five minutes; configure the client's tool timeout accordingly.
MCP protocol framing is additionally bounded by the SDK's 10 MiB default.
Tools are read-only. Tool errors use `isError`; valid partial reports remain
successful tool responses with their unresolved findings intact.

## Boundaries

The API can run locally or in authenticated hosted mode. Render provides HTTPS
and hosts the configured service; the repository does not provision certificates
or register third-party integrations by itself. Hosted acceptance must be repeated
after the rebuilt browser bundle is deployed.
MCP is stdio only; remote MCP/OAuth is outside this implementation.
There is no payment gateway, transaction signing, monitoring worker or new
accounting algorithm in this phase. The browser performs no chain calls directly.

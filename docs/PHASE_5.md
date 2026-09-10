# Phase five — interfaces

Local implementation is delivered. Hosted acceptance and Bazantic registration
remain open; the user explicitly deferred all account and deployment setup.
Phase four's hosted Graph acceptance also remains open.

## Delivered

- [x] Shared service dispatches V1 and nested V2 resolution, share/accounting
  cross-checks and scoped WETH custody verification through existing modules.
- [x] HTTP API with strict request schemas and generated OpenAPI 3.1 inputs.
- [x] Official MCP SDK v2 stdio server: `tare_status`, `tare_analyze`,
  `tare_replay`, `tare_example`. Tools return JSON text and structured reports.
- [x] Web explorer: recorded examples, configured live reads, capture import,
  allocation paths, findings, scoped metrics and report/capture downloads.
- [x] Three retained public examples replay without provider configuration.
- [x] Loopback binding, Host/Origin checks, 5 MiB input bound, two concurrent
  operations, source budgets, private configuration and sanitized errors.
- [x] Automated API/MCP parity, partial-result, input-boundary, configured source
  dispatch and failure tests. MCP tests use a real SDK client and child process.
- [x] Browser checks of recorded results and responsive layout. Download buttons
  generate JSON blobs locally; the in-app browser did not expose a download event,
  so a saved-file acceptance check remains unconfirmed in that browser.
- [ ] Hosted API with authentication, per-client quotas and live acceptance.
- [ ] Bazantic registration, second-service binding and end-to-end Recipe run.
  [Recipe draft](BAZANTIC_RECIPE.md) records the intended composition, not an
  invented import format or a claim that Bazantic is already integrated.

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
403 rejected origin/host, 404 unknown route, 405 wrong method, 413 input too large,
415 wrong media type, 429 busy, 500 failed operation, 503 missing configuration.
Responses are not cached. No persistent wallet or report store is added.

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

The API is a local development service, with no authentication or public bind
option. Do not expose it by simply forwarding a port: hosted deployment needs an
explicit trust boundary, authentication, quotas and allowed-origin policy.
MCP is stdio only; remote MCP/OAuth is outside this implementation.
There is no payment gateway, transaction signing, monitoring worker or new
accounting algorithm in this phase. The browser performs no chain calls directly.

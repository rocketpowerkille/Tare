# HTTP and MCP reference

The current public application origin is `https://tare.visk404.dev`. Local serving
defaults to `http://127.0.0.1:4318`. This reference describes repository behavior,
not current provider health. Check `/api/access-options` and authenticated
`/api/status` on the deployment you use.

## Authentication and request rules

Hosted `/api/*` routes require `Authorization: Bearer <access-code>` except
`GET /api/access-options`. A configured Tare API key or an unexpired sandbox
session can authorize ordinary evidence requests. Session issuance and report
context retrieval additionally require the configured Bazantic gateway API-key
identity, not an ordinary Explorer session. A gateway grant is not a Tare bearer
token. `baz login` signs into Bazantic management; it does not create a spend grant
or an Explorer session.

The documented sandbox grant command uses `--cap 0.01` (total spending ceiling),
while the session command uses `--max-amount 0.001` (one-request ceiling). At
0.001 test USDC per session, a fresh, unused grant permits at most ten session
purchases if the price stays unchanged and no other charges consume its budget.
This is not a count of analyses: reuse the bearer session until its expiry,
subject to quotas. A grant does not supply funds or authorize Recipe spending
through the in-page runner. See [session setup](BAZANTIC_INTEGRATION.md#sandbox-payment-and-session-issuance).

JSON POST requests require `Content-Type: application/json`. General input is
limited to 5 MiB; investigation snapshots have a stricter 1 MiB combined limit.
Hosted requests are also subject to origin checks and per-identity quotas (60 per
minute by default). Polling consumes requests. Local unconfigured loopback access
does not require a bearer token. It does not enable otherwise missing providers.

Read-only metadata and web pages still undergo Host/Origin checks. Do not disable
these checks to resolve a domain migration; see the
[operator guide](BAZANTIC_INTEGRATION.md#domain-and-gateway-maintenance).

## Route inventory

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/healthz` | Process health, not provider or Recipe health. |
| GET | `/api/access-options` | Public access configuration, without secrets. |
| GET | `/api/status` | Configured capabilities, examples and limits. |
| POST | `/api/discover` | Candidate discovery: `owner`, optional `maxPositions` (1–100, default 25). |
| POST | `/api/analyze` | One operation from the table below, not the browser's combined pipeline. |
| POST | `/api/example` | Saved example: `id` is `steakhouse-usdc`, `ov-usdc-v2` or `weth-custody`. |
| POST | `/api/replay` | `operation` and compatible `capture`; no new source query. |
| POST | `/api/compose` | Recompute and join `resolutionCapture`, `shareCapture` and direct `graphResponse`. |
| POST | `/api/agent-analyze` | Compact analysis with additive deterministic `explanationContext`. |
| POST | `/api/agent-example` | Compact saved example with `explanationContext`. |
| POST | `/api/bazantic/session` | Empty object `{}`; gateway-authorized session issuance. |
| POST | `/api/agent-report-context` | Gateway-only page retrieval: `reference`, optional `page` (0–63, default 0). |
| POST | `/api/agent-compare-accounting` | `vault` and unchanged Graph `data` object in `graph`; compares supplied data with pinned Ethereum RPC. |
| GET | `/api/investigation/options` | Assistant availability, Recipe handle, zero-spend policy and retention. |
| POST | `/api/investigation/snapshot` | `report`, optional `previous`; stores a bounded browser-submitted projection. |
| POST | `/api/investigation/run` | Start/reuse a run: `reference`, UUID `requestId`, `question` (1–1500 characters), `consent: true`. |
| GET | `/api/investigation/run/{id}` | Poll the same access identity's run; `id` is a UUID. |
| POST | `/api/investigation/wallet` | `owner`; discover up to 10 candidates and analyze at most 3 supported positions. |

Web routes are `/`, `/explore`, `/investigate`, `/examples`, `/docs`, `/developers`.
Discovery adds `source: "multi-protocol"` and scope
`"indexed-morpho-euler-and-configured-erc4626"` when Euler is configured.
`/api/status.discoveryProtocols` lists enabled sources. Candidates retain their
chain and protocol; Euler supply candidates select `resolve-erc4626`, with RPC
configuration checked per chain. The indexed debt field may be null (unknown)
and is not assessed by this supply-only operation. Provider outages, pagination,
metadata gaps and omitted subaccounts appear in `issues`; `complete` refers only
to the bounded discovery coverage, never wallet completeness or backing.
The [official Euler API](https://docs.euler.finance/build/data-querying/euler-v3-api/)
and [metadata reference](https://docs.euler.finance/build/data-querying/perspectives/)
define the source contracts. Tare reads one account page (100 rows) and at most
three chain metadata batches, without requesting a paid or forced refresh.

Explorer checks one selected position; Investigate performs bounded wallet or
two-block comparisons; Examples replays saved evidence and uploaded captures.
All three workspaces share tab-scoped credentials, revalidated on reload.
**Disconnect session** clears this tab's credential and workspace locally;
there is no logout/revocation API route and no grant revocation from this action.
Public JSON contracts are `/openapi.json`, `/openapi-mcp.json`,
`/openapi-mcp-v2.json`, `/openapi-mcp-v3.json` and `/openapi-graph.json`.
The MCP aliases serve the same small Tare gateway specification, not separate
API implementations. The Graph contract describes an external Studio upstream.

## Analysis fields

All rows require `operation`. Addresses are 0x-prefixed 20-byte EVM addresses.
Raw amounts and block numbers are decimal strings, not floating-point numbers.
Do not send fields from another operation: runtime schemas reject extra fields.

| Operation | Required fields beyond operation | Optional fields and scope |
| --- | --- | --- |
| `resolve-v1` | `owner`, `vault` | `chainId` 1/8453/42161 (default 1); `blockNumber`. |
| `resolve-v2` | `owner`, `vault` | `blockNumber`; bounded Ethereum USDC V2-to-V1 adapters only. No `chainId` field. |
| `resolve-erc4626` | `owner`, `vault` | `chainId` 1/8453/42161/84532 (default 1); `blockNumber`. Contract accounting only. |
| `verify-shares` | `owner`, `vault` | `blockNumber`; Ethereum historical share ledger. |
| `verify-accounting` | `vault` | `blockNumber`; configured Ethereum accounting read set. |
| `verify-historical-graph` | `owner`, `vault` | Optional `blockNumber`; Steakhouse USDC Ethereum only. Uses the separately configured historical indexed head when omitted; combines shares and accounting at that block. Requires archive RPC. Historical, non-executable evidence. |
| `verify-graph-composition` | `owner`, `vault` | No additional fields; Ethereum Token API plus eligible Studio comparison. |
| `verify-weth` | `owner` | `blockNumber`; canonical Ethereum WETH wrapper scope only. |
| `verify-base-custody` | `owner` | `blockNumber`; configured Base Sepolia custody control only. |
| `value-position` | `chainId: 1`, `asset`, `amountRaw`, `assetDecimals` | `blockNumber`; eligible Ethereum USDC/WETH reference valuation. Decimals 0–36. |

`verify-shares` and `verify-accounting` accept block heights up to 2147483647.
`value-position` is not a replay operation or an advertised compact gateway tool
operation. The small gateway's shared schema is broader than some runtime
variants: for example, its discovery `vault` hint is not accepted by the current
HTTP discovery schema. Omit it. The full replay schema also lists
`value-position`, but runtime replay does not support it. The tables here follow
[runtime request validation](../packages/service/src/requests.ts); OpenAPI is not
permission to send unsupported combinations.

## Reproducible HTTP example

In Git Bash, macOS or Linux, set `TARE_API_TOKEN` privately in your shell, then:

```sh
curl https://tare.visk404.dev/api/agent-example \
  -H "Authorization: Bearer $TARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"steakhouse-usdc"}'
```

This reads a saved example. It neither pays nor performs a fresh blockchain check.
The direct API returns JSON itself; the Bazantic CLI's `--json` wraps the upstream
response in `body`. Therefore an issued session is `accessToken` in Tare's direct
response but `body.accessToken` in the Bazantic CLI envelope. Ordinary API users
must obtain sessions through the gateway, not call issuance with an Explorer code.

## MCP surfaces

| Surface | Tool names |
| --- | --- |
| Local stdio (`pnpm mcp`, after building) | `tare_status`, `tare_analyze`, `tare_replay`, `tare_example`, `tare_compose`. |
| Tare Bazantic gateway | `tare_status`, `tare_discover_vaults`, `tare_analyze_compact`, `tare_example_compact`, `tare_start_bazantic_sandbox_session`, `tare_report_context`, `tare_compare_indexed_accounting`. |
| Graph Studio gateway | `graph_tare_accounting_head` (head or pinned accounting snapshot query). |

Bazantic can add its own `info` tool. Generated tools can wrap POST arguments in
`requestBody`; use their actual connected schema. Local stdio accepts operation
fields directly. The local server does not expose the new HTTP investigation
routes. No SDK package is published, and Tare's HTTP server is not a hosted `/mcp`
transport: use the Bazantic gateway's `/mcp` or local stdio as appropriate.

## Investigation lifecycle and errors

Two-block investigation reuses `/api/analyze` with explicit `blockNumber` values;
no new HTTP routes or request fields are added. Snapshot comparisons add
`positionChanges` and citeable `comparison.scope` / `comparison.change.N` facts.
Wallet snapshots add `current.overlap.scope` / `current.overlap.N` facts. These
are deterministic calculations over submitted reports, not new verification.
See [bounded change investigation](CHANGE_INVESTIGATION.md).

Create a snapshot, start one consented run, then poll its ID with the same access
identity. The reference is 48 lowercase hex characters and expires after ten
minutes. It is not a public share link. The gateway retrieves eight facts per page.
Only the configured gateway identity can use that retrieval route. Restarting or
scaling to an instance without the snapshot makes it unavailable.

| Run status | Meaning |
| --- | --- |
| `running` | Waiting for the Recipe; polling does not request another explanation. |
| `complete` | Answer format, citation IDs, sensitive-output checks and page retrieval passed. Factual correctness still needs human review. |
| `review-required` | Output was withheld; inspect fixed review reasons and page counts. The evidence report is unchanged. |
| `unavailable` | Execution could not complete, including payment challenges, timeout or inaccessible upstream. No automatic retry. |

Run responses can have HTTP 200 while their analytical/execution status is not
successful. Inspect the body. The `receipt` field is local execution metadata:
`payment: not-requested`, `settlement: not-confirmed`, `cost: null` are not a
transaction receipt or a zero-cost settlement claim.

HTTP errors use `{ "error": { "code": "…", "message": "…" } }`. Common statuses:
400 malformed/schema input; 401 missing/expired/invalid access; 403 wrong
origin or gateway identity; 404 expired/unavailable reference or run; 409 reused
request ID with different input; 413 excessive input; 415 wrong content type;
429 quota/concurrency; 503 missing configuration. Recipe payment rejection can
appear inside an `unavailable` run rather than as an HTTP 402 from Tare.

See [assistant behavior and activation](BAZANTIC_INVESTIGATION.md) and
[evidence interpretation](EVIDENCE_MODEL.md). Never bypass a failed review check
to display an unsupported answer.

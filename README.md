# Tare

## DeFi Evidence, Explained

Tare helps DeFi researchers, protocol reviewers, and AI agents understand what a
supported vault position represents. It traces wallet exposure through supported
vault layers, compares eligible indexed and direct blockchain observations, and
returns reports separating observations, calculations, reference prices, scoped
checks, and unresolved claims. This is a technical MVP, not a universal safety
verifier, proof-of-reserves system, or solvency oracle.

[Open Tare](https://tare.visk404.dev/) |
[Explorer](https://tare.visk404.dev/explore) |
[Investigate](https://tare.visk404.dev/investigate) |
[Examples](https://tare.visk404.dev/examples) |
[Evidence model](docs/EVIDENCE_MODEL.md) |
[Bazantic Recipe](https://bazantic.com/recipes/explain-defi-vault-evidence-clearly)

## Choose a workspace

| Page | Question | Scope |
| --- | --- | --- |
| Explorer (`/explore`) | What does this position rest on? | One selected wallet–vault position, its trace and eligible evidence checks. |
| Investigate (`/investigate`) | What do my positions share, or what changed? | At most three supported positions and shared-market dependencies, or one position compared at two explicit blocks. |
| Examples (`/examples`) | How can I read or reproduce a report? | Saved examples and compatible capture uploads; no fresh source acquisition. |

Explorer and Investigate reuse the same evidence engine. The added value is the
comparison, not stronger verification. Investigation is not a complete wallet
inventory or continuous monitoring; shared dependencies do not predict losses,
and a change does not establish causation. Different-block amounts are not summed
as a synchronized portfolio. See [comparison limits](docs/CHANGE_INVESTIGATION.md).

## Why Tare exists

A token balance does not explain the economic position behind a vault share.
Nested vaults can allocate into lending markets, whose collateral is a dependency
rather than an asset owned directly by the shareholder. Dashboards and APIs can
report correct numbers without explaining those distinctions. Sources can also
disagree or describe different blocks.

Tare assembles a bounded report explaining what was observed, what was calculated,
which comparisons were eligible, and what remains unknown. This matters for people
and for agents that might otherwise read an accounting quote as a backing claim.

A vault accounting quote is not proof of custody, solvency, liquidity,
redeemability, or complete backing.

## What Tare adds beyond a block explorer

Explorers remain useful for inspecting contracts and transactions. Their features
vary, and many already provide APIs and detailed provenance. Tare adds a
position-specific interpretation and comparison layer, not a replacement.

| Capability | Typical explorer workflow | Tare's supported workflow |
| --- | --- | --- |
| Token balances | Inspect balances and contract reads. | Include relevant balances in a position report. |
| Position interpretation | Interpret protocol contracts separately. | Apply supported adapter semantics. |
| Nested tracing | Follow several contracts and transactions. | Traverse supported layers with bounded integer attribution. |
| Indexed versus RPC comparison | Assemble the comparison separately. | Compare eligible observations within a declared read set. |
| Provenance | Inspect block, transaction, and contract details. | Carry source, block, and capture identity into the result. |
| Value classification | Interpret balances, quotes, and prices. | Separate observed, derived, and market-priced values. |
| Unknowns | Investigate gaps manually. | Return explicit findings and limitations. |
| Agent access | Use explorer APIs where offered. | Use compact evidence context through HTTP and MCP. |

Not every report performs every check. Coverage depends on the operation,
configured providers, supported adapter, and available evidence.

Wallet discovery combines Morpho with Euler EVK/EulerEarn supply candidates on
Ethereum, Base and Arbitrum. Euler candidates use the generic ERC-4626 reader for
fresh share/conversion accounting; Euler borrowing, subaccounts, collateral risk
and downstream strategy tracing are not implemented. Yearn discovery is not yet
integrated; compatible vaults can still be checked by address or local registry.
Configure `TARE_RPC_URL`, `TARE_BASE_MAINNET_RPC_URL` and `TARE_ARBITRUM_RPC_URL`
locally for analysis on the corresponding networks. Euler discovery defaults to
its public API; `TARE_EULER_DISCOVERY=false` disables it. No wallet secrets are needed.
The first 100 indexed Euler positions are considered; metadata gaps, omitted
subaccounts and result limits remain explicit. Discovery is not a full inventory.

## A reproducible example

The saved [Steakhouse USDC capture](fixtures/live/steakhouse-usdc.capture.json)
contains an Ethereum position at block **25937756**. It is historical evidence.

| Field | Captured value or interpretation |
| --- | --- |
| Wallet | `0x334f5d28a71432f8fc21c7b2b6f5dbbcd8b32a7b` |
| Vault | `0xbeef01735c132ada46aa9aa4c54623caa92a64cb` |
| Observed shares | `25214434140816810935371051` raw units. This capture does not supply share decimals. |
| Observed contract conversion quote | `28728443339809` USDC raw units, or **28,728,443.339809 USDC** using six decimals. |
| Derived exposure | The resolver attributes the quote across 12 Morpho Blue markets. Five raw units remain unattributed from integer rounding. |
| Price and indexed comparison | This capture alone contains neither a Chainlink price check nor a Graph comparison. |

The conversion quote is a contract observation. Attributing that quote to lending
markets is a calculation. Neither is a direct USDC balance in the wallet, and the
quote must not simply be added to direct holdings without checking overlap. It
does not establish custody, liquidity, solvency, backing, or redeemability.

Reproduce it with `pnpm cli live replay fixtures/live/steakhouse-usdc.capture.json`.
See [capture provenance](fixtures/live/README.md) for the recorded source and scope.

## Evidence model

| Category | Meaning | Example in Tare |
| --- | --- | --- |
| Observed | A source reports a value at a block or timestamp. | RPC share balance or contract conversion quote. |
| Derived | A calculation uses observed values. | Integer-attributed market exposure. |
| Market-priced | An external reference price values an amount. | Eligible Chainlink USD estimate. |
| Checked | A comparison establishes agreement within its scope. | Selected Graph accounting reads match RPC. |
| Inferred | An interpretation depends on stated semantics or assumptions. | A share represents a vault-reported claim. |
| Not verified | Available evidence does not establish a claim. | Recoverability of Morpho loans. |

There is no universal confidence score. A scoped custody-control metric must not
be applied to unrelated vaults. Read the [evidence model](docs/EVIDENCE_MODEL.md).

## Report lifecycle

Live acquisition reads configured providers. Saved evidence retains its original
observation time. Replay recomputes from a capture without making it fresh.
An incomplete result lacks required evidence; a mismatch reports a disagreement;
an unavailable source could not supply a qualifying observation. These are not
interchangeable, and a complete trace is not a complete backing verification.

## Architecture

```text
Wallet or vault input
  -> HTTP API / CLI / stdio MCP
  -> Discovery and supported traversal
  -> Eligible RPC and Graph acquisition/comparison
  -> Chainlink reference valuation, where eligible
  -> Evidence classification and report
  -> Web UI / JSON / compact agent result / configured policy workflow
```

Acquisition, protocol adapters, calculations, verification, and formatting are
separate modules. Replay reuses the comparison logic. The browser runs applicable
operations, not one universal verification pipeline. See
[architecture](docs/ARCHITECTURE.md) and the separate sponsor paths below.

## The Graph integration

The Graph supplies indexed evidence, not a decorative badge. The custom Studio
subgraph records a bounded Steakhouse USDC accounting read set. Unpinned accounting
checks select its indexed head, confirm the hash through RPC, and compare exact
reads. The Token API contributes a separate wallet share-balance observation to
the Ethereum product-composition operation.

Retained acceptance notes report **56 of 56** accounting reads matching at block
`25953771`, and a later two-service run at `25961875`. Zero findings means no
disagreement within those checks, not verified loan backing. These are historical
notes, not a claim of current endpoint health; raw hosted outputs remain a
submission-evidence gap.

The separate creation-block share ledger has no completed historical acceptance
in this repository. The accounting-only deployment does not substitute for it.
See [Graph integration and reproduction](docs/GRAPH_INTEGRATION.md).

## Chainlink integration

Eligible Ethereum amounts use Chainlink reference prices with block-pinned reads
and round, answer, and timestamp checks. A price does not establish custody.

Separately, a CRE Confidential Workflow uses `handlerInTee` to acquire authenticated
Tare evidence and evaluate private policy thresholds. It returns a bounded verdict
and evidence commitment for DON reporting; eligible testnet execution goes through
the Keystone Forwarder to the one-use receiver.

```text
Scheduled CRE trigger -> confidential evidence + policy evaluation
  -> redacted result -> DON report -> Base Sepolia forwarder -> bounded receiver
```

| Private inside the workflow | Public or externally verifiable |
| --- | --- |
| API credentials and secret policy thresholds | Verdict and evidence commitment. |
| Authenticated responses and intermediate calculations | Published execution terms and transaction. |
| Secret-bearing configuration | Public target configuration and recorded post-state. |

Not all configuration is private. The workflow trusts the configured Tare service
for its economic evidence. A retained hosted run redeemed a disposable Base Sepolia
control; the latest retained workflow binding is **paused**, with execution
disabled. Opening Explorer does not trigger that scheduled workflow. See
[the confidential workflow and transaction record](docs/CHAINLINK_CONFIDENTIAL_WORKFLOW.md).

## Bazantic integration

```text
Agent uses a published Bazantic Recipe
  -> Bazantic gateway/MCP tools -> Tare compact evidence
  -> Recipe-guided agent explanation
```

Bazantic provides the gateway, hosted MCP exposure, reusable Recipes, and sandbox
access flow. The current gateway schema defines `tare_status`,
`tare_discover_vaults`, `tare_analyze_compact`, `tare_example_compact`, and
`tare_start_bazantic_sandbox_session`, plus `tare_report_context` and
`tare_compare_indexed_accounting`. These seven Tare operations differ from the
five local stdio tools; Bazantic may also show its own `info` tool.

The published [plain-language Recipe](https://bazantic.com/recipes/explain-defi-vault-evidence-clearly)
uses deterministic explanation context. A separate retained two-service Recipe
uses the Graph Studio gateway and Tare's comparison. An older raw-versus-Recipe
timing note is a single historical pair, not a benchmark or a fully controlled
same-prompt experiment.

Sandbox session issuance authorizes Explorer access for 15 minutes by default.
It is separate from an actual settlement receipt and from vault evidence.
At the documented 0.001 test USDC session price, an unused `--cap 0.01` grant
covers at most **10 session purchases**, assuming no other spending and an
unchanged price. This is a budget ceiling, not prepaid funds or ten analysis
credits: reuse one unexpired code for multiple API requests, subject to quotas.
`--max-amount 0.001` limits one purchase. A new grant does not fund the wallet.
The setup guide prints only the access code using Git Bash/Bash/Zsh and Node.js.
Explorer, Investigate and Examples remember it in this tab across refreshes;
**Disconnect session** clears the credential and current workspace without
revoking the key or grant. Refreshing never extends the session's expiry.
The UI offers three separate explanation paths: copy context to an assistant,
open the public Recipe, or explicitly consent to **Ask with Bazantic** when the
in-page assistant is configured. Only the last path executes a Recipe from Tare.
It stores a bounded report snapshot for ten minutes and checks all-page retrieval,
seven answer sections and fact citations before displaying the answer. This is
structural validation, not a guarantee of factual correctness or new verification.
It never signs or pays and stops on payment challenges. See
[Bazantic integration](docs/BAZANTIC_INTEGRATION.md) and the
[investigation assistant](docs/BAZANTIC_INVESTIGATION.md).

## AI agent use case

An agent can mistake shares for assets, reference pricing for backing, or a saved
capture for a fresh check. Tare returns exact values, provenance, evidence
categories, omission counts, and interpretation boundaries. The external agent
should answer with:

1. A short answer.
2. Directly observed values.
3. Derived values.
4. Evidence sources checked.
5. What those checks support.
6. What remains unknown.
7. Technical provenance.

Tare has no direct LLM provider SDK or model key. The optional in-page assistant
delegates explanation to a Bazantic Recipe; deterministic context generation and
copying do not call a model. The
[Recipe specification](docs/BAZANTIC_PLAIN_LANGUAGE_RECIPE.md) defines the external
agent's interpretation rules. The pinned-report Recipe uses a separate strict
JSON answer contract, not the public plain-language Recipe's prose instructions.

## Example walkthrough

Start with the saved Steakhouse position and its concrete accounting quote. Show
the market path, block, and unknown backing. Then show a separately labeled live
Graph comparison when available, the Bazantic Recipe explanation, and the retained
CRE testnet result. Do not combine different blocks into one apparent observation.
The public integration guides describe each path and its evidence boundaries.

## Limitations

- Morpho V1 traversal covers Ethereum, Base, and Arbitrum when RPC is configured.
  Nested V2 traversal is limited to supported Ethereum USDC V1 adapters.
- Generic ERC-4626 analysis reports contract accounting, not arbitrary downstream
  composition. Discovery is not verification or an exhaustive vault registry.
- Graph composition is Ethereum-only. The custom accounting subgraph covers one
  vault; historical share acceptance and hosted continuous Substreams monitoring
  remain incomplete.
- Missing indexed data, RPC history, provider disagreement, or unavailable prices
  can prevent a check. Different RPC hostnames do not prove operator independence.
- Lending custody, full backing, solvency, liquidity, loan recoverability, and
  redeemability are not established by accounting agreement or a USD estimate.
- Captures are unsigned. Digests identify evidence bytes, not cryptographic proof
  of provider truth. Recorded and replayed results are historical.
- Execution is a separate bounded Base Sepolia experiment. No production audit or
  mainnet execution is claimed. The TEE retains a configured-service trust boundary.
- API and gateway availability depends on hosting and credentials. The retained
  Render binding warns that the free instance can spin down.

## Quick start

Use Node **24 or later** and the repository-pinned **pnpm 11.19.0**. Bun is needed
only for CRE; Docker with Linux containers is needed for Graph Node and container
contract tests. From the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm serve
```

Open [localhost](http://127.0.0.1:4318). Without provider variables, use saved
examples; live checks will be unavailable. `pnpm` below means the pinned version
selected by Corepack. The repository has no `dev` script; rebuild after edits.

Set only the required provider/access variables described in
[.env.example](.env.example). `.env` is ignored and not automatically loaded by the
default server or CLI. To load an intentionally configured local file, run
`node --env-file=.env dist/apps/api/src/main.js`; its configured port may differ.
Never paste credentials into requests, captures, screenshots, or Git.

```sh
pnpm check
pnpm verify
pnpm test:web
pnpm test:web:browser
pnpm cli live replay fixtures/live/steakhouse-usdc.capture.json
pnpm mcp
```

The browser suite requires Playwright, an installed browser, and the running local
server. Graph builds, CRE compilation, and container test prerequisites are in
the [Graph guide](docs/GRAPH_INTEGRATION.md),
[CRE guide](docs/CHAINLINK_CONFIDENTIAL_WORKFLOW.md), and
[CI configuration](.github/workflows/ci.yml).

## Routes and interfaces

| Interface | Entry point |
| --- | --- |
| Web | `/`, `/explore`, `/docs`, `/developers`. |
| Public service metadata | `GET /healthz`, `/api/access-options`, `/openapi.json`, `/openapi-mcp.json`, `/openapi-mcp-v2.json`, `/openapi-mcp-v3.json`, `/openapi-graph.json`. |
| HTTP evidence operations | Protected `GET /api/status`; JSON `POST /api/analyze`, `/api/discover`, `/api/example`, `/api/replay`, `/api/compose`. |
| Compact agent operations | JSON `POST /api/agent-analyze`, `/api/agent-example`. |
| Pinned context and supplied accounting | JSON `POST /api/agent-report-context`, `/api/agent-compare-accounting`. Context retrieval requires the configured gateway identity. |
| Investigation | `GET /api/investigation/options`, `/api/investigation/run/{id}`; `POST /api/investigation/snapshot`, `/api/investigation/run`, `/api/investigation/wallet`. |
| Sandbox authorization | `POST /api/bazantic/session`, subject to configured gateway authorization. |
| CLI and local MCP | `pnpm cli --help` and `pnpm mcp`. |
| Hosted agent gateway | [Tare Bazantic gateway](https://zvnss2njirhqjllnbfsv3sneca.bazgateway.com). |
| Evidence exports | Browser report/capture downloads and bounded CLI exports. No hosted report-permalink store is implemented. |

Request schemas are in [service requests](packages/service/src/requests.ts).
See the [API reference](docs/API_REFERENCE.md) for operation-specific fields and
strict runtime-schema caveats. Hosted authentication does not change evidence
semantics. Temporary investigation references are not public report permalinks.

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web`, `apps/api`, `apps/cli`, `apps/mcp` | Browser, HTTP, command-line, and stdio interfaces. |
| `packages/domain`, `packages/adapters`, `packages/resolver` | Schemas, supported protocol rules, and bounded resolution. |
| `packages/sources`, `packages/verification` | Acquisition and reproducible comparisons. |
| `packages/service`, `packages/receipts` | Operation dispatch and report/agent projections. |
| `packages/policy`, `workflows/cre`, `contracts` | Private policy, CRE execution, and testnet receiver. |
| `graph/subgraph`, `graph/integration` | AssemblyScript mappings and real local indexing tests. |
| `fixtures`, `deployments` | Retained evidence and historical deployment records. |
| `tests`, `scripts`, `docs` | Regression tests, verification tooling, and runbooks. |

These are logical modules under one root package, not separate pnpm workspaces.

## Testing and acceptance

The explorer also provides [bounded change investigation and exposure overlap](docs/CHANGE_INVESTIGATION.md):
two explicit block reads or saved-report comparisons, exact raw differences,
market-identity matching and shared Morpho V1 dependencies. Bazantic can cite the
derived facts after consent. This is not continuous monitoring; live acceptance
of the new flow must be retained separately from fixture tests.

Historical application verification before the separate workspaces and disconnect feature
(2026-09-13, Node 24.13.0) passed 211 core tests, 12 web tests and Chrome
regressions across all four routes at widths from 320px to 1440px. These include
Recipe response parsing, citation/page validation, session setup and terminal
token extraction, documentation links/anchors, and the HTTP/tool inventories.
Test counts describe that run, not a fixed product capability.
An earlier same-day pass recorded 12 CRE tests, both Graph mapping builds and CRE
WASM compilation. Those separate suites, Docker Graph Node and Foundry were not
rerun by this documentation verification. See [CI](.github/workflows/ci.yml) for commands.

Tests exercise malformed input, source
disagreement, incomplete evidence, replay, authentication, exact unit display, and
agent claim boundaries. Browser fixtures are not live-provider acceptance.

Historical CRE manifests retain transaction and post-state evidence. Hosted Graph
and Bazantic successes are also described in dated notes, but their raw output
artifacts still need collecting for submission. No new payment or transaction is
required merely to read this repository.

## Security and responsible use

Read-only analysis requires public addresses, not wallet keys or seed phrases.
Keep provider credentials, bearer tokens, session codes, and deployment keys local.
The API applies input limits, authentication where configured, origin checks, and
quotas. These controls do not constitute a security audit.

Testnet execution requires separate explicit authorization. Reports are research
artifacts with declared limitations, not investment advice or proof of solvency.
A dedicated private security-reporting channel is not verified in this repository.
Do not publish vulnerabilities containing credentials in public issues.

## License and acknowledgements

No repository-wide license file is present in the reviewed revision. Some contract
files carry MIT SPDX headers, but that does not establish a license for the whole
project. The maintainers must choose and add the intended license before claiming
the complete repository is open source.

Tare uses The Graph, Chainlink, Bazantic, Morpho interfaces, and open-source
libraries including React, Vite, TypeScript, Zod, and the MCP SDK. Dependency
licenses remain their own. These integrations do not imply sponsor endorsement.

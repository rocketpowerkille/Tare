# Team handoff and verification record

Documentation review date: 2026-09-13, against application revision
`b28e72c20b52721bcb613428f94714bfbf97c297`. The working tree was clean before this
documentation task. This record separates local tests, historical hosted records,
and evidence still needed. It is not a current uptime or registry-status probe.

## Current implementation

Tare has a read-only Explorer, protected HTTP API, CLI, local stdio MCP, compact
agent responses, and Bazantic gateway schemas. Supported traversal, Graph
comparisons, Chainlink reference pricing, deterministic explanation context,
report downloads, and bounded testnet policy execution are implemented.

The website exposes `/`, `/explore`, `/docs`, and `/developers`. The copy-context
and public Recipe paths are deliberately separate. Reports distinguish source
mode, block, limitations, and authorization without calling an LLM.

## Verification performed in this review

| Check | Result and scope |
| --- | --- |
| `node --run verify` | Passed the application build, 178 Node tests, CLI demonstrations, and saved Ethereum replay. |
| `node --run check` | Passed root and web TypeScript checks. |
| `node --run test:web` | Passed 11 display and agent-handoff tests. |
| `node --run test:web:browser` | Passed Chrome checks on four routes at 1440, 1024, 768, 390, and 320px. |
| `node --run verify:cre` | Passed TypeScript build and 12 Bun tests. |
| `node --run build:subgraph` | Passed full-history mapping code generation and build. |
| `node --run build:subgraph:live` | Passed accounting-only mapping code generation and build. |
| `npm run compile --prefix workflows/cre` | Produced the ignored CRE WASM locally. This is not hosted execution. |
| Graph Node and Foundry execution | Not rerun. No Docker engine was available in this environment. |
| Hosted Graph, CRE, and Bazantic acceptance | Not rerun. No paid request, transaction, deployment, or workflow resume occurred. |

The local runtime was Node 24.13.0 and Bun 1.4.2. Corepack resolved the repository
pin to pnpm 11.19.0; the system `pnpm` command reported 9.15.5. The `node --run`
scripts completed against installed dependencies, with their internal `pnpm`
calls using the system shim. Use `corepack pnpm` for a new installation.
CI specifies Bun 1.3.10. This review did not repeat a clean dependency installation.

Documentation checks covered 13 changed Markdown files, 85 local links, package
script names, table structure, code fences, forbidden typography, and likely secret
patterns. No issues were found. Public deployment IDs were checked against source
configuration and retained manifests. Official sponsor requirements were read
from ETHGlobal. External app and Recipe URLs are retained references: the browsing
tool could not open them, so their availability was not verified here.

Browser checks covered saved examples, fixture-backed pricing and outages,
invalid/expired access, session metadata, honest loading states, downloads,
clipboard actions, keyboard controls, and reduced motion. They confirmed no
automatic Bazantic request from opening or copying the handoff. These are local
regressions, not paid customer or live-provider acceptance.

Browser reproduction requires a local server and an installed Playwright package.
Set `TARE_PLAYWRIGHT_MODULE` to that package if it is not locally resolvable, and
`TARE_BROWSER_CHANNEL=chrome` to use installed Chrome. `TARE_UI_ORIGIN` can select
a different local port. Screenshots from this run are ignored under `tmp/ui-review/`.

## Retained acceptance records

| Area | Retained evidence | Boundary |
| --- | --- | --- |
| Ethereum replay | [Original captures](../fixtures/live/README.md). | Historical provider observations, not fresh reads. |
| Local Graph Node | [Indexing and rollback fixture](../fixtures/integration/graph-node-reorg.json). | Actual local WASM/indexer evidence, not hosted Studio. |
| Hosted Graph accounting | [Phase-four note](PHASE_4.md) records 56/56 at block `25953771`; later notes record indexed-head anchoring. | Raw hosted acceptance capture still needs attaching. |
| Token API plus Studio | Prior 2026-09-12 handoff records matched Token API balance and 56 accounting reads. | Historical prose acceptance, not a new live run. |
| Two-service Bazantic Recipe | [Runbook and acceptance note](BAZANTIC_MULTI_SERVICE.md) records block `25961875`, 56 matched reads, and a warm retry taking 7.94 seconds. | Preserve raw tool outputs and source-block differences. |
| Sandbox access | Prior handoff and maintainer testing report payment followed by short-lived session issuance. | Retain a redacted paid response. Session issuance alone is not settlement proof. |
| Plain-language Recipe | Maintainer publication/testing confirmation and [configured public URL](https://bazantic.com/recipes/explain-defi-vault-evidence-clearly). | No new controlled baseline/guided artifact pair is retained. |
| Older Recipe comparison | [2026-09-12 note](BAZANTIC_COMPARISON.md). | Different input representations and missing settings prevent a strict identical-prompt claim. |
| Local CRE simulator | [Phase-seven procedure and acceptance](PHASE_7.md). | Historical authenticated simulator result, separate from current unit tests. |
| Contract tests | Phase-seven and prior handoff record 23 passing Foundry tests, including fuzz coverage. | Historical, not rerun without Docker. |
| Deterministic test-forwarder exit | [Base Sepolia E2E manifest](../deployments/base-sepolia-e2e.json). | Owner-only test forwarder, not Chainlink DON delivery. |
| Hosted CRE exit | [Hosted manifest](../deployments/cre-hosted-execution.json). | Historical Chainlink-forwarder Base Sepolia execution. |

## Paused workflow and consumed controls

The hosted exit redeemed 100 outer shares for 100 inner shares. Allowance and
permitted shares became zero and the nonce advanced to 2. The following scheduled
run made no EVM write. Both disposable test controls have already been consumed.

The latest retained [stable API binding](../deployments/cre-stable-api-binding.json)
records `PAUSED` and `executionEnabled: false`. It is distinct from the earlier
execution-enabled hosted revision. Do not resume it or create a new position just
to display the historical result. Explorer reference pricing is independent.

Detailed public IDs, the forwarder distinction, privacy boundaries, and
reproduction instructions are in [the Chainlink guide](CHAINLINK_CONFIDENTIAL_WORKFLOW.md).

## Remaining submission work

1. Choose a repository-wide license and confirm the registered ETHGlobal track.
2. Record the [canonical demo](DEMO_SCRIPT.md) and confirm the deployed revision.
3. Collect redacted raw hosted Graph, paid-session, and two-service Recipe outputs.
4. If claiming a controlled plain-language improvement, run the same prompt, model,
   settings, tools, and evidence twice with only Recipe guidance changed.
5. Review [prize eligibility](PRIZE_TRACKS.md). The older Agentify-complete label is
   not supported by the additional non-sponsor service requirement.
6. Check the deployed customer path separately from local browser fixtures and
   operator-credential tests. Account access, availability, and payment are distinct.
7. Preserve visible limitations, blocks, source modes, and exact units in recordings.

Full historical share acceptance, hosted continuous Substreams monitoring, broader
protocol coverage, auditing, and production execution remain outside the accepted
submission scope. A near-complete sync percentage is not a verified historical
ledger and does not establish when indexing will finish.

## Documentation entry points

- [Submission guide](SUBMISSION_GUIDE.md) contains the artifact and recording checklist.
- [Evidence model](EVIDENCE_MODEL.md) defines claim boundaries.
- [Graph integration](GRAPH_INTEGRATION.md) distinguishes current accounting from history.
- [Chainlink workflow](CHAINLINK_CONFIDENTIAL_WORKFLOW.md) separates pricing, privacy, and execution.
- [Bazantic integration](BAZANTIC_INTEGRATION.md) separates direct API, Recipe, and payment paths.
- [Architecture](ARCHITECTURE.md) describes implementation responsibilities.

No application code or acceptance fixture was changed for this documentation work.

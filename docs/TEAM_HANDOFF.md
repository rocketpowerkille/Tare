# Team handoff — current state and next work

Point-in-time status: **2026-09-12 IST**. This document separates implemented code,
retained acceptance evidence and the remaining partner-hosted work. Treat the
deployment manifests and phase documents linked below as the detailed source of
truth.

## Executive status

Tare is a working technical MVP for resolving nested vault exposure, comparing
independent observations and conditionally executing a tightly bounded exit on
Base Sepolia. The core engine, CLI/API/MCP interfaces, modular web application,
monitoring logic, Graph mappings, confidential-policy workflow and receiver are
implemented and tested. Both the deterministic test-forwarder path and a hosted
Chainlink production-forwarder path completed bounded Base Sepolia exits.

The technical MVP is complete for the implemented Chainlink path, and the
authenticated API plus rebuilt modular browser application are hosted on Render.
Hosted Home, Explore, Learn and Developers routes now pass route and browser
acceptance. Tare is also live as
a Bazantic gateway and MCP server, with a published evidence-evaluation Recipe
that completed retained-evidence and fresh-live tests. A controlled
raw-API-versus-Recipe comparison is also complete: the Recipe reached the same
correct Base Sepolia conclusion with **31.34% lower latency** and **17.54% fewer
tokens**, while returning a more consistently structured evidence report. The
project is **not submission-complete**: submission recording remains, hosted
monitoring remains pending, and a dedicated mobile-width visual pass remains. The
historical Graph share ledger cannot finish before the
deadline and is no longer a submission dependency.

## Partner and component status

| Area | Current state | What remains |
| --- | --- | --- |
| Core resolver | Implemented for synthetic schemas and the documented Ethereum MetaMorpho V1 plus V2→V1→Blue scope. Integer accounting, partial evidence and replay are tested. | Broader protocol/network coverage is optional future scope, not part of the verified MVP. |
| The Graph | Custom share/accounting mappings build and pass real local Graph Node rollback tests. The deadline-safe `tare-live-accounting` Studio deployment originally matched all 56 Graph observations to same-block RPC at Ethereum block `25953771`. A fresh acceptance on 2026-09-12 found that RPC-first pinning could outrun the indexer or exceed free-RPC history. Unpinned verification now anchors on the current Graph head, confirms its hash through RPC, and again matches 56/56 with zero findings. | Redeploy Render, then run `pnpm verify:hosted:graph`. Use this bounded current-accounting result for submission. The full-history ledger cannot finish before the deadline and is post-submission only. Do not claim historical share reconstruction. |
| Chainlink CRE | The TypeScript workflow compiles to WASM, reads private secrets, acquires authenticated HTTPS evidence and submits a confidential consensus report. Private-registry revision `0024de…e3bd` completed an EVM write through the production Base Sepolia Keystone Forwarder. Current paused revision `00fe…0a48` points to the permanent Render API with execution disabled. | Preserve both the historical exit record and current safe hosted binding. A security audit and mainnet use are explicitly outside the current claim. |
| Base Sepolia execution | Two-provider allowlisted-bytecode verification matched a 2.000000x control. Five deterministic failure/replay cases reverted. A separate hosted receiver redeemed exactly 100 outer shares for 100 inner shares through Chainlink transaction `0x65549c…b95f9`; allowance and permit shares became zero and nonce advanced to 2. | Both disposable control positions are consumed. Create another only if a new live demo is genuinely required. The contracts use test assets and are not production audited. |
| Bazantic | Gateway `zvnss2njirhqjllnbfsv3sneca` is live against the Render API. The compact contract now exposes wallet discovery, status, analysis and retained-example tools. The published `DeFi Vault Backing Evidence Evaluator` Recipe completed retained and live Base Sepolia runs without payment. In the controlled live comparison it matched the raw baseline's correct result in `19,513 ms` and `6,685` tokens versus `28,419 ms` and `8,107` tokens, and produced a more standardized evidence report. Bazantic has now enabled Base Sepolia sandbox settlement. The repository also publishes a narrow OpenAPI contract for The Graph Studio and an exact two-service Recipe flow. | Redeploy Render, refresh the Tare gateway, enable sandbox mode and complete a paid Base Sepolia acceptance. Then add the second The Graph gateway and bind both services using [the multi-service runbook](BAZANTIC_MULTI_SERVICE.md). These external account actions are required to finish the eligible Bazantic paths. |
| Graph composition | Token API plus Studio accounting composition, same-block RPC checks, CLI/API/MCP/UI exposure and retained replay are implemented. | Add `GRAPH_MARKET_API_TOKEN` to Render and retain a successful `pnpm verify:hosted:graph-products` run. |
| Monitoring | Local TypeScript Substreams consumer, checkpoints, deduplication, reorg rollback and evidence evaluation are implemented. | Hosted Substreams provider credentials and continuous-worker acceptance are still optional follow-up work. |
| Interfaces/UI | CLI, protected HTTP API and stdio MCP server are functional. The modular React application is live on Render with Home, Explore, Learn and Developers routes, guided Base Sepolia analysis, recorded replay, beginner documentation and honest SDK status. Hosted routes, browser accessibility trees, authenticated status and compact-example checks pass. | Complete a dedicated mobile-width visual pass. Render's free instance may cold-start. |

Rust is not currently required. Core services and CRE remain TypeScript, Graph
mappings use AssemblyScript, and the receiver uses Solidity. Rust is allowed only
if a future custom Substreams extraction module is justified; see
[the language strategy](LANGUAGE_STRATEGY.md).

## Verified acceptance evidence

Latest local acceptance in this workspace:

- `pnpm verify`: **133/133** Node tests passed, followed by all required demos and
  the retained Ethereum capture replay.
- CRE workflow suite: **12/12** tests passed in the Bun-enabled environment; the
  official SDK compiled the workflow to `.tare/cre/tare-policy.wasm`.
- Foundry suite: **23/23** Solidity tests passed, including 256 fuzz cases.
- The Graph: local Graph Node/Anvil indexing and rollback passed; hosted live
  accounting matched **56/56** reads with zero mismatches.
- Base Sepolia: live two-provider custody matched; the bounded success transaction
  and rejected caller/payload/replay cases are recorded in the deployment manifests.
- Hosted CRE: trigger, authenticated HTTP, consensus report and Base Sepolia
  `WriteReport` capabilities succeeded. The following post-exit run made no EVM write.
- Bazantic: the hosted gateway generated the original four-tool MCP surface. The
  published Recipe called `/api/status` and `/api/agent-example` successfully;
  its retained report kept the recorded-source and unverified-backing limitations
  and returned `needs_review`. The agent projection stays below 4 KiB for all
  three retained examples while the original full API receipts remain unchanged.
  The current contract adds `tare_discover_vaults`; refresh the gateway after the
  Render deployment to generate the fifth tool. Base Sepolia sandbox settlement
  is now available for a paid-path acceptance.
- Bazantic controlled comparison: raw baseline and published Recipe used the same
  live Base Sepolia custody question, owner, model and enabled Tare tools. Both
  correctly found no currently executable, independently verified position. The
  raw baseline completed in `28,419 ms` with `8,107` tokens; the Recipe completed
  in `19,513 ms` with `6,685` tokens. That is `8,906 ms` / **31.34%** less latency
  and `1,422` / **17.54%** fewer tokens. See
  [the Bazantic comparison record](BAZANTIC_COMPARISON.md).

Useful verification commands:

```sh
pnpm verify
npm run verify --prefix workflows/cre
npm run compile --prefix workflows/cre
docker run --rm --user 0:0 --entrypoint forge -v "${PWD}:/work" -w /work/contracts ghcr.io/foundry-rs/foundry:v1.3.1 test -vv
pnpm cli verify base-custody-replay fixtures/live/base-sepolia-custody.capture.json --json
cre whoami
```

The CRE commands require Bun on `PATH`. Replays are deterministic evidence checks,
not claims that the evidence is fresh. Keep RPC keys, API tokens, deploy keys,
wallet private keys and CRE secret values out of Git and chat.

## Base Sepolia deployment and bounded exit

This is a test-only deployment on chain ID `84532`; it is not Ethereum mainnet and
contains no production assets.

| Item | Value |
| --- | --- |
| Owner/deployer | `0xf1fea08ebba92ed342acc5639db312c3694bc391` |
| Harness | `0x39d408086d22859a3a1c19d8cfae1fbed2cb58ea` |
| Terminal asset | `0x8ee5f47e407006df298f45d0a4dae14d60cbde62` |
| Inner vault | `0x09b7f07f10800064f7db6a262ecff344da0bd867` |
| Outer vault | `0x60407bf755a379d530a5409ac3639ec4bbaa0bbe` |
| Owner-only test forwarder | `0xc819e99b4d2fb2a96bc47c67417f87213f86ad0c` |
| Bounded exit receiver | `0xd1b87d595662f37390c02af906448cd38a100323` |
| Deployment transaction | `0x27672d1ff78f04ba5ac0d7f567c5fe1d98a17cc154b62bfe35852dd62c7d49bc` |
| Approval transaction | `0xd47b3b76f20a4212301ed2e6d11596a229c07b19acb320fc4988135d64b3c0f8` |
| Arm transaction | `0x64ec65c7d7191748ae2969210e9899581716eae207a17f7ca2544b01e63e23ce` |
| Exit transaction | `0x727d95f56314b7756438f05069a27bf84f6216f8c8c771bbe28996ac897dce75` |
| Evidence digest | `0x39f2402818eb7370fbf69a68f69c9820d44f9ed63eb18524dbc1953bb5301e78` |

The exit redeemed 100 outer shares for 100 inner shares. Post-state checks found
zero owner outer shares, zero receiver balances, zero allowance, a consumed permit
and nonce 2. The direct receiver caller, non-owner forwarder caller, malformed
payload, wrong-share payload and exact-calldata replay all reverted.

This first delivery used an **owner-only test forwarder**, not Chainlink's DON. It
remains the deterministic failure/replay fixture. See
[`deployments/base-sepolia-e2e.json`](../deployments/base-sepolia-e2e.json).

The retained Base custody capture was taken before the exit at block `46684889`
(`0x2c85ad9`) from two differently hosted RPC providers. It is valuable replay
evidence, but it is historical after the shares were redeemed. Do not relabel it
as a fresh executable position.

The separate hosted acceptance used a fresh control and Chainlink's production
Base Sepolia Keystone Forwarder:

| Hosted item | Value |
| --- | --- |
| Harness | `0xe4a29c01d197e190503bec2f7953f1044ee7374f` |
| Outer vault | `0x65d8dcf4d0ae830b09a906ab57366fa226026d03` |
| Bounded receiver | `0xec3b0dc653f9150ecde9a6a2c14e9138dfb9e577` |
| Production forwarder | `0xf8344cfd5c43616a4366c34e3eee75af79a74482` |
| CRE workflow ID | `0024de354e9d08c1e57c1cc4308e3ea462c89580de2ddbef2a3c69e8bd53e3bd` |
| CRE exit execution ID | `c0c22aaf520df358ad5358bd5806015fd4335adf790432918d5abdd35654b206` |
| Approval transaction | `0x7c99f67274625dc967fb10982ed3e5b4fff20aa72445a53504f05d4f75985380` |
| Arm transaction | `0x66e916525001fd867708deec3ec9efd3a3348b485fc8d2a0d3449b30d2858e0e` |
| Hosted exit transaction | `0x65549cd7b8c823795ec22ae17f297f8d3d3668ee5278e690ee836ba3d63b95f9` |

That hosted exit redeemed 100 outer shares for 100 inner shares. A second scheduled
run after consumption completed without an EVM write, and the workflow was paused.
See [`deployments/cre-hosted-execution.json`](../deployments/cre-hosted-execution.json)
and [phase seven](PHASE_7.md).

## Ordered next work

### 1. Finish partner submission evidence and hosted monitoring

1. Record a concise Bazantic demo showing the live gateway/MCP surface, the raw
   baseline, the published Recipe run and the measured comparison. Include the
   Bazantic username and keep both result screens available as source evidence.
2. Use [the exact prize matrix](PRIZE_TRACKS.md) before selecting tracks. Tare is
   likely net-new, which makes the completed Continuity-only Bazantic
   comparison ineligible even though it remains strong product evidence.
3. For either Bazantic prize that is not marked Continuity-only, follow
   [the multi-service runbook](BAZANTIC_MULTI_SERVICE.md), bind the direct The Graph
   service, and make the final result depend materially on both services.
4. Deploy the monitor with bounded provider configuration, durable state,
   TLS/auth and explicit live-source labels.
5. Keep the historical Graph share ledger outside the deadline path. Use the
   pinned live-accounting deployment and completed 56/56 comparison, with its
   current-accounting-only limitation stated clearly.

### 2. Complete hosted UI acceptance

The rebuilt browser bundle is deployed to the existing Render service. Home,
Explore, Learn and Developers pass hosted desktop route and accessibility checks,
and authenticated status plus retained-example requests pass. Check mobile widths and run one authenticated
Base Sepolia analysis and one recorded example. Confirm that provenance, block,
deployment identity, completeness, verification status and execution eligibility
remain clear. Recorded captures must never appear live, and an unavailable
collateral multiple must not be replaced by an invented percentage.

### 3. Assemble submission evidence

Link the hosted CRE execution record, Base Sepolia transaction, Graph 56/56
acceptance and deterministic replay/failure cases from one concise demo path.
Capture only public IDs and outputs; keep RPC credentials, API tokens, wallet keys
and private policy values out of the submission.

## Claim boundary

Safe claims today:

- Tare resolves the implemented nested-vault scope and preserves uncertainty.
- The live accounting subgraph passed a 56/56 same-block Graph/RPC comparison.
- The Base verifier matched allowlisted code and two-layer custody across two RPC
  hosts, and a real bounded Base Sepolia exit plus failure cases were accepted.
- The CRE workflow compiles and runs in the authenticated local simulator.
- A private-registry CRE workflow completed authenticated HTTP, confidential report
  consensus and production-forwarder Base Sepolia delivery; it is paused afterward.
- The hosted Tare API is agent-accessible through a live Bazantic gateway and MCP
  server. Its published Recipe completed no-payment retained and fresh-live tests
  without overstating incomplete evidence, and the controlled comparison used
  31.34% less latency and 17.54% fewer tokens than the raw baseline for the same
  correct Base Sepolia conclusion.

Do **not** claim yet:

- production readiness, a security audit or mainnet execution;
- a completed Bazantic paid request or any Bazantic testnet payment path;
- fully indexed historical share acceptance or broad multi-chain coverage;
- Ethereum mainnet execution, independently verified Morpho loan backing, or that
  two public RPC hosts are cryptographic proof of state.

## Detailed references

- [Phase four — Graph indexing and verification](PHASE_4.md)
- [Phase five — API, MCP, explorer and Bazantic boundary](PHASE_5.md)
- [Phase six — monitoring](PHASE_6.md)
- [Phase seven — confidential policy and bounded exit](PHASE_7.md)
- [Architecture](ARCHITECTURE.md)
- [Live capture provenance](../fixtures/live/README.md)

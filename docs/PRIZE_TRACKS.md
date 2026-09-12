# ETHOnline 2026 partner track status

Point-in-time status: **2026-09-12 IST**. The qualification source is the
[official ETHOnline 2026 prize page](https://ethglobal.com/events/ethonline2026/prizes).
This matrix separates a working integration from prize eligibility and submission
evidence.

## Track classification

Tare's first repository commit is dated 2026-09-06, after ETHOnline began on
2026-09-04. Unless the ETHGlobal project was registered differently, Tare appears
net-new. The phrase **Start Fresh** is used explicitly by The Graph for its AI
track's From Scratch pool. Bazantic and Chainlink do not define a general Start
Fresh pool on their prize pages; they mark individual prizes as Continuity-only.

## The Graph

| Prize | Integration status | Qualification status |
| --- | --- | --- |
| Best Use of Composable or Standardized Graph Products | Hosted-verified | `verify-graph-composition` composes two live Graph products in one result. The Graph Token API supplies the wallet's vault-share balance, while Tare's Studio subgraph supplies normalized vault accounting. Hosted acceptance on 2026-09-12 matched the Token API balance and all 56 Studio accounting reads to RPC at the subgraph block with no findings. The standardized `ethereum-common` Substreams monitor adds a separate reorg-safe streaming path. A concise submission video remains. |
| Best AI Tooling or AI Use Case with The Graph, From Scratch | Hosted-verified | The live Studio subgraph is load-bearing evidence for deterministic analysis exposed to agents through Tare's MCP/API and Bazantic surface. Unpinned runs anchor on the current indexed head before confirming and reading that exact hash through RPC. The hosted two-product acceptance matched all 56 accounting reads with zero findings. A two-to-four-minute submission video remains evidence packaging, not integration work. |
| Best AI Tooling or AI Use Case with The Graph, Continuity | Ineligible if Start Fresh | This is the same technical track in the Continuity pool. Do not apply to both pools. |

The full historical share ledger is not required for the completed AI track. Tare
must describe the deployed subgraph as a bounded current-accounting slice and must
not claim historical share reconstruction. The post-deploy live acceptance command
is `pnpm verify:hosted:graph`.

The composable track also avoids the unfinished historical ledger. It uses the
Token API balance endpoint and the deadline-safe current-accounting subgraph. A
Token API observation newer than the subgraph block is rejected as unaligned,
and any Token API/RPC balance difference becomes a mismatch. The required hosted
secret is the JWT labelled **API Token** in The Graph Market, not the API-key ID.

## Chainlink

| Prize | Integration status | Qualification status |
| --- | --- | --- |
| Best Confidential Workflow | Complete | A meaningful private policy and authenticated API response run in the confidential handler. Hosted execution produced a consensus report and delivered a bounded Base Sepolia exit through the production Keystone Forwarder. |
| Best Chainlink-Powered Upgrade | Continuity-only, likely ineligible | The onchain state-change requirement is satisfied technically, but the prize page restricts this prize to Continuity Track participants and Tare appears net-new. |
| Automated Liquidation Protection Challenge | Not pursued | This is a separate challenge on Ethereum Sepolia with its own join contract and scenario. Tare's bounded Base Sepolia vault exit does not automatically qualify. |

## Bazantic

| Prize | Integration status | Qualification status |
| --- | --- | --- |
| Help an Agent Use Your Hackathon Project | Technically complete, likely ineligible | The live gateway, MCP tools, published Recipe and controlled raw-versus-Recipe comparison satisfy the technical requirements. The prize page restricts this prize to Continuity Track participants and Tare appears net-new. |
| Best Recipe that uses ETHGlobal sponsor APIs | Two-service Recipe configured, final acceptance pending | The direct Graph Studio gateway is active and the draft `tare-graph-accounting-assurance` Recipe binds its `graph_tare_accounting_head` tool with Tare's `tare_analyze_compact` tool. Live calls reached both services. The latest test exposed Bazantic's 32 KiB result limit, so the compact accounting response now replaces 56 raw checks with a bounded summary. Redeploy and retain one successful two-service test before claiming completion. |
| Agentify a New API | Two-service Recipe configured, final acceptance pending | Tare is a new API with a live six-tool sandbox gateway. The draft Recipe combines the direct sponsor API with Tare rather than routing the sponsor API through Tare. Final qualification evidence is one successful post-deploy test and the published Recipe. |

Bazantic's listed qualifications do not require a completed paid request. The
operator-credential tests remain valid integration evidence unless Bazantic says
otherwise. Base-mainnet-only settlement should be disclosed because Tare is
testnet-only.

## Sponsor questions

### The Graph

1. Can the live Token API wallet balance plus Tare's live Studio accounting
   subgraph qualify as two Graph products composed in one verification report?
2. Does the 56/56 same-block Studio-to-RPC comparison qualify for the From Scratch
   AI track without the unfinished historical creation-block backfill?

### Bazantic

1. Tare was started during ETHOnline and appears net-new. Please confirm that this makes it ineligible
   for the Continuity-only raw-versus-Recipe prize even though the integration is complete.
2. For the sponsor-API Recipe and Agentify prizes, may The Graph's Studio API be added as the
   second service, with its output passed into Tare for verification?
3. Please confirm that operator-credential Recipe tests qualify because the prize
   requirements do not state that a paid request is required.

### Chainlink

1. Please confirm that the completed private-registry Confidential Workflow and
   production-forwarder Base Sepolia transaction are sufficient evidence for Best
   Confidential Workflow.
2. Please confirm that a net-new project cannot enter Best
   Chainlink-Powered Upgrade.
3. Is the liquidation challenge strictly limited to projects that joined its
   Ethereum Sepolia contract, or can an existing confidential risk-policy workflow
   be adapted before the deadline?

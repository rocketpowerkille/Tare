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
| Best Use of Composable or Standardized Graph Products | Complete in code, hosted acceptance pending | `verify-graph-composition` composes two live Graph products in one result. The Graph Token API supplies the wallet's vault-share balance, while Tare's Studio subgraph supplies normalized vault accounting. RPC checks the share balance and all 56 accounting reads at the subgraph block. The existing standardized `ethereum-common` Substreams monitor adds reorg-safe streaming. Set `GRAPH_MARKET_API_TOKEN`, redeploy, then retain a successful `pnpm verify:hosted:graph-products` run. |
| Best AI Tooling or AI Use Case with The Graph, From Scratch | Complete in code, redeploy required | The live Studio subgraph is load-bearing evidence for deterministic analysis exposed to agents through Tare's MCP/API and Bazantic surface. Unpinned runs now anchor on the subgraph's current indexed head before confirming and reading that exact hash through RPC. A fresh local-to-live acceptance matched all 56 reads with zero findings. Render must be redeployed once more before the hosted API contains this alignment fix. A two-to-four-minute submission video remains evidence packaging, not integration work. |
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
| Best Recipe that uses ETHGlobal sponsor APIs | Repository side complete, Bazantic binding pending | The current Recipe directly calls only Tare. A public OpenAPI contract and exact two-service Recipe flow are now provided for a second direct The Graph Studio gateway. The authenticated Bazantic account must add that gateway, bind both services and complete one test. |
| Agentify a New API | Repository side complete, Bazantic binding pending | Tare is a new API with a working gateway. The qualification text requires the Recipe to use both services. The same direct The Graph plus Tare flow satisfies that architecture once it is configured and tested in Bazantic. |

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

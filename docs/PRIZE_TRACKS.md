# ETHOnline 2026 prize review

Reviewed on 2026-09-13 using the official
[Graph category page](https://ethglobal.com/events/ethonline2026/prizes/the-graph),
[Chainlink category page](https://ethglobal.com/events/ethonline2026/prizes/chainlink),
and [event prize page, including Bazantic](https://ethglobal.com/events/ethonline2026/prizes).
Technical fit is an assessment, not sponsor approval or confirmed eligibility.

## The Graph

| Official category | Assessment | Evidence still needed |
| --- | --- | --- |
| Best Use of Composable or Standardized Graph Products | Strong candidate through Token API plus Studio composition. | Show both live products materially affecting the result; ask the sponsor to confirm this pairing. |
| Best AI Tooling or AI Use Case with The Graph (From Scratch) | Candidate through structured evidence and Recipe-guided interpretation. | Show meaningful agent reasoning using live Graph evidence, not only a saved example. Confirm the registered track. |
| Best AI Tooling or AI Use Case with The Graph (Continuity) | Do not select for a From Scratch project. | Eligibility depends on the actual prior work and registration. |

The official requirements distinguish live provider data from mocks and static
captures. The composable category requires composition or meaningful standardized
schema use, not one isolated subgraph query. See [the integration evidence](GRAPH_INTEGRATION.md).
The unfinished historical share ledger is not a substitute for this demonstration.

## Chainlink

| Official category | Assessment | Evidence still needed |
| --- | --- | --- |
| Best Confidential Workflow | Strong technical fit. | Show private input processing, the confidential handler, and retained successful execution evidence. |
| Best Chainlink-Powered Upgrade | Not recommended without Continuity eligibility. | A testnet state change does not remove the track restriction. |
| Automated Liquidation Protection Challenge | Not pursued. | Tare does not document joining the official Ethereum Sepolia challenge. |

The confidential category accepts meaningful confidential execution with private
input and simulation or deployment evidence. The historical Base Sepolia exit
supports a technical claim, not automatic qualification. See
[the workflow guide](CHAINLINK_CONFIDENTIAL_WORKFLOW.md).

## Bazantic

| Official category | Assessment | Evidence still needed |
| --- | --- | --- |
| Help an Agent Use Your Hackathon Project | Continuity-only; not recommended for From Scratch. | The old timing pair does not establish identical prompt/settings controls. |
| Best Recipe that uses EthGlobal Hackathon Sponsor APIs | Strong candidate through Tare plus the direct Graph gateway. | Record both services materially affecting one completed result, and supply account attribution. |
| Agentify a new API | Eligibility not established. | Confirm a qualifying additional service unavailable on Bazantic and outside sponsor APIs at event start. Adding Graph does not establish this condition. |

The earlier documentation marked Agentify complete based on the Graph gateway.
That was too broad. Ask Bazantic whether Tare itself can satisfy the new-service
condition in the proposed two-service arrangement; do not assume so.
The [integration guide](BAZANTIC_INTEGRATION.md) separates gateway, Recipe,
customer access, and actual settlement evidence.

## Decisions to confirm

1. Confirm From Scratch versus Continuity registration and disclose prior work.
   A first Git commit alone does not prove project origin or eligibility.
2. Ask The Graph to confirm the Token API plus custom Studio product pairing.
3. Ask Bazantic to confirm the additional-service interpretation for Agentify.
4. Preserve a screen recording and raw artifacts for the actual chosen categories.
5. Add a repository-wide license. Public source visibility alone does not establish
   the intended open-source license.

Do not list prize pools as expected winnings or claim sponsor endorsement.

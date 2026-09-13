# What Tare is for

Tare is an evidence-first investigation tool for supported DeFi vault positions.
Its useful output is not a safety score. It is an inspectable account of what a
position represents, which sources agreed, and which questions remain unanswered.
This guide describes the implemented product; it is not a roadmap or a claim of
universal protocol coverage.

## The problem: a balance is not an explanation

A wallet can hold shares rather than the asset named on a dashboard. A vault can
allocate those shares through other vaults into lending markets. Its conversion
quote describes contract accounting, not necessarily withdrawable cash. Two
sources can report different blocks, and a correct reference price says nothing
about who holds the assets.

These distinctions matter to a depositor reviewing a position, a treasury reviewer
looking for shared dependencies, and an agent explaining technical data to a
non-technical user. The failure Tare addresses is an unsupported conclusion from
otherwise plausible numbers: “the balance exists, so the vault is fully backed.”

Tare brings supported protocol interpretation, exact calculations, source
comparisons and limitations into one report. Block explorers and protocol apps
remain useful for contract and transaction inspection; Tare does not replace them
or claim they lack evidence. Its contribution is the bounded investigation and
reproducible reasoning between those observations and a position-level answer.

## Choose the question, then the feature

| Question | Use | Why this is distinct | Boundary |
| --- | --- | --- | --- |
| What does this position represent? | Explorer | Traces one wallet–vault pair and shows eligible source checks beside its amounts. | Only supported paths; a complete trace is not verified backing. |
| Which of my positions share a market? | Investigate → Wallet overview | Compares returned positions to expose dependencies that individual reports cannot show alone. | At most 10 candidates and 3 analyses; overlap currently uses eligible Morpho V1 reports, not a complete portfolio. |
| What changed between these blocks? | Investigate → Changes over time | Calculates exact differences while preserving both endpoints and missing evidence. | Live Ethereum Morpho V1 or compatible saved reports; no continuous monitoring, causal explanation or profit calculation. |
| Did indexed shares and accounting agree at this historical block? | Investigate → Historical verification | Checks an event-derived share ledger and indexed accounting against RPC at the same block. | Steakhouse USDC on Ethereum only; historical, non-executable, not current wallet state. |
| What can you tell me about an untraced strategy? | Accounting only / generic ERC-4626 | Retains usable share and conversion observations without pretending to understand the downstream strategy. | Contract accounting only; no arbitrary adapter, withdrawal or backing analysis. |
| Can you explain the evidence simply? | Ask with Bazantic | Gives an agent bounded facts and checks its response structure, citations and page retrieval before display. | Interpretation, not new verification or a guarantee that prose follows from citations. |
| Can I reproduce this calculation later? | Examples and capture replay | Reuses the same calculations on retained observations without depending on current provider availability. | Unsigned saved evidence, not a fresh query or authentication of the original provider. |

Explorer and Investigate intentionally share an engine. The second workspace adds
cross-position, cross-time and historical questions; it does not make the original
evidence stronger just by moving it to a different screen.

## What each integration contributes

### RPC and supported protocol adapters: meaning at a block

Discovery identifies candidates through Morpho, enabled Euler discovery and a
configured ERC-4626 registry. RPC then reads the selected position. Sources acquire
observations; adapters interpret supported protocol rules; resolvers calculate
attributed exposure using integer arithmetic. Network, contract, block identity,
raw units, missing branches and rounding remain attached.

Morpho V1 supports Ethereum, Base and Arbitrum. Nested traversal covers supported
Ethereum USDC V2-to-V1 adapters. Other discovered V2 positions on those networks
can use an explicitly narrower ERC-4626 accounting check. Euler EVK/EulerEarn
direct supply candidates use that generic reader; debt, subaccounts, liquidation
risk and downstream strategies are not assessed. Compatible ERC-4626 contracts
can also be entered manually. See [coverage and setup](OPERATIONS.md).

### The Graph: indexed observations that affect the verdict

The custom Studio mappings supply a declared vault/market accounting read set.
The historical deployment also reconstructs share balances from Transfer events
starting at vault creation. Tare checks deployment identity, indexing errors,
block identity and exact values against RPC; absent or contradictory evidence
changes the result rather than leaving a decorative “verified” badge.

The separate product-composition operation combines **The Graph Token API and
Subgraph Studio**, with RPC as the comparison reference. Token API contributes a
wallet share-balance observation; Studio contributes eligible vault accounting.
Historical share and accounting mappings are two datasets in Studio, **not two
different Graph products**. Morpho and Euler discovery APIs are not The Graph.

This integration is useful because indexed observations can be retrieved and
compared reproducibly rather than silently trusted. It is still provider-mediated
evidence: matching accounting does not verify borrower repayment or solvency.
See [data flow, alignment and historical acceptance](GRAPH_INTEGRATION.md).

### Chainlink: reference valuation, separately from custody

An allowlist maps exact native-USDC and canonical-WETH addresses to feeds on
Ethereum, Base and Arbitrum. Feed reads are pinned and validated for round, answer,
decimals and age. Base and Arbitrum additionally require sequencer uptime and a
recovery grace period. Missing prices remain missing, not an assumed dollar peg.

This gives a comparable denomination for eligible accounting amounts without
confusing a price with proof that assets exist or can be redeemed. It does not
cover every token or add nested traversal. See [feed coverage](CHAINLINK_COVERAGE.md).

A **separate CRE Confidential Workflow** evaluates private policy and authenticated
Tare evidence inside `handlerInTee`, then can deliver bounded testnet execution
through the DON/forwarder/receiver path. It demonstrates keeping policy thresholds
and credentials out of public results while constraining an action. Its latest
retained binding is paused with execution disabled; it is not a public Explorer
feature or production vault protection. It still trusts Tare's economic evidence.
See [the workflow and retained execution](CHAINLINK_CONFIDENTIAL_WORKFLOW.md).

### Bazantic: reusable agent access and evidence-grounded explanation

The gateway exposes Tare tools over hosted MCP. Recipes describe when to retrieve
evidence, how to interpret categories and how to preserve limitations. The public
plain-language Recipe retrieves Tare evidence; the in-page pinned-report Recipe
explains only a temporary snapshot of the report already displayed.

These are distinct from the copy-context convenience: copying makes no AI request.
For an in-page run, the user consents, Tare stores a ten-minute bounded snapshot,
and the Recipe reads its pages through the gateway. Tare checks seven sections,
known fact IDs and complete page retrieval. Invalid answers are withheld, not used
to rewrite the technical report. Source contents are data, not agent instructions.

The sandbox session is another separate path for authorizing API access. It does
not verify the vault or prove settlement. In-page Recipe runs authorize **zero
spend** and stop on payment challenges. This separation makes agent access useful
without silently turning every explanation into a paid request.
See [gateway and session setup](BAZANTIC_INTEGRATION.md),
[pinned investigation](BAZANTIC_INVESTIGATION.md) and
[public Recipe guidance](BAZANTIC_PLAIN_LANGUAGE_RECIPE.md).

## A useful answer, not an exaggerated promise

For a supported position, a defensible conclusion is:

> The wallet holds vault shares. Tare calculated the supported market exposure
> from the returned contract accounting. Eligible source comparisons agreed at
> their checked blocks. A reference price, if present, values that accounting
> amount. Independent backing, loan recovery and future redemption remain
> unverified.

Change that wording when the report is incomplete, mismatched or recorded.
Never fill gaps with invented USD values, confidence scores, inferred zero
balances or a conclusion that “safe” follows from “complete.” The
[evidence model](EVIDENCE_MODEL.md) is the interpretation contract.

## Demonstrate it honestly

1. Start with the saved Steakhouse USDC example. Inspect its block, shares,
   conversion quote, market attribution and missing backing evidence.
2. For live data, check configured capabilities, select a supported position and
   retain its report/capture. Configuration is not provider health; a random
   wallet may have no discoverable supported positions.
3. Show one distinct investigation question: shared markets, a two-block change,
   or the scoped historical share/accounting comparison. Preserve endpoint blocks.
4. Optionally consent to a Bazantic explanation and follow its citations back to
   the original facts. Keep execution metadata separate from vault evidence.
5. Retain an unavailable or replay case too. Explain the actual coverage gap
   instead of presenting every source as universally supported.

Tests establish software behavior. User-supplied captures establish reproducible
calculations from those bytes. A live provider run establishes only its bounded,
dated observations. None establishes universal safety or continuous availability.
Hosted Substreams monitoring, withdrawal-constraint tracking, arbitrary Euler
nested tracing, broad Graph deployments and a universal backing metric are not
implemented product claims. There is no published Tare SDK or repository-wide
license file in this reviewed revision; do not imply otherwise.

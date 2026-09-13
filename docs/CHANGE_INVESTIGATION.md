# Bounded change investigation and exposure overlap

These features extend the existing explorer and report context. They do not
start a continuous monitor, deploy a subgraph or Substreams service, or authorize
payments. Their implementation and fixture tests are not live-provider acceptance.

## Compare two blocks

In `/investigate`, open **Investigate changes between two blocks**. Supply one
Ethereum Morpho V1 wallet/vault pair and two increasing decimal block numbers.
The browser performs at most four operations through existing `/api/analyze`:

1. `resolve-v1` with owner, vault and the previous `blockNumber`.
2. `verify-accounting` with vault and that same `blockNumber`, if configured.
3. `resolve-v1` with owner, vault and the current `blockNumber`.
4. `verify-accounting` with vault and that same `blockNumber`, if configured.

Normal access, quotas, concurrency and provider configuration still apply.
Historical RPC access and indexed coverage must exist for the requested blocks.
The accounting deployment has a start block; it is not a full historical share
ledger. Missing history remains unavailable. There is no latest-block fallback,
automatic retry, implied daily schedule, or new Chainlink valuation request.
401/402 stops the sequence. Graph disagreement remains explicit; a failed Graph
request does not discard a usable pinned RPC observation.

Alternatively select **Compare two saved reports** and load previous/current
report JSON files under 1 MiB each. This makes no acquisition requests. Original
source modes are retained; uploading a file does not authenticate its contents or
turn its historical observations into fresh checks. Captures must first be replayed
using the existing replay flow, then downloaded as reports.

Comparison requires supported report types (Morpho V1 or generic ERC-4626 for
saved reports), matching chain, owner, vault, protocol, asset and decimals, and
increasing, confirmed block identities. Shares and fees stay in raw units.
Market amounts use exact integer subtraction. Markets match by ID and parameters,
not list order. A missing market or amount is never substituted with zero. A
market appearing only on one side is a returned-set difference, not proof of a
deposit/withdrawal transaction. Incomplete market coverage is shown separately.
Generic ERC-4626 reports have no supported downstream-market coverage here.

The UI retains both endpoints, source status and provenance, changed and unchanged
fields, missing evidence, and downloads for the comparison and original reports.
An unchanged share balance does not imply unchanged exposure. Neither changed nor
unchanged endpoints prove what happened between them, causation, profit or loss.

## Bazantic explanation

The existing pinned-report assistant receives current and previous reports only
after explicit consent. `comparison.positionChanges` is additive to the existing
snapshot comparison. Citeable facts include `comparison.scope` and
`comparison.change.N`. The scope contains endpoint provenance and limitations;
each difference retains its exact before/after value, market identity, units and
status. Existing report facts and the seven-section answer validator remain.

There is no new route, MCP tool, payer or LLM dependency. The existing pinned
Recipe already instructs agents to use the supplied deterministic comparison;
context instructions additionally explain raw differences and overlap limits.
No gateway resync is required for unchanged routes. Publication, live Recipe
execution and semantic answer quality must still be tested separately. Large
paired reports can exceed the existing context limit; do not weaken that limit
or silently truncate facts to force an answer.

## Exposure overlap

On `/investigate`, **Investigate a wallet across supported vaults** shows shared Morpho V1
markets from the same existing, at-most-three-position investigation. This is a
pure calculation over returned reports, not a new provider query. The view shows
each vault's attributed raw amount, asset/decimals, source block and dependencies.

A sum is available only for the same chain, market parameters, asset units and
block hash, with every amount present. Different-block relationships remain
visible without an aggregate. Repeated vault identities are excluded. Nested
parents, unsupported reports and unconfirmed blocks are excluded, avoiding
parent/child double counting. Scope and exclusion counts remain visible.

`current.overlap.N` facts and `current.overlap.scope` let the existing wallet
assistant cite these relationships. Oracle and collateral addresses describe
dependencies, not directly owned assets or predicted losses. Zero amounts remain
zero and do not establish positive exposure. No overlap found is not proof of
diversification or a complete wallet inventory.

## Verification and live acceptance

Pure tests cover integer arithmetic, identity and block rejection, reordered and
missing markets, duplicate vaults, source mismatches, missing amounts, overlap
aggregation boundaries, acquisition cancellation, access/payment stops and
citeable snapshots. Browser fixtures cover input validation, pinned requests,
source states, downloads, uploads, mobile layout and keyboard operation.

Historical local verification of the initial implementation on 2026-09-13 passed `node --run check`,
`node --run verify` (225 core tests, build and CLI demonstrations),
`node --run test:web` (12 tests), and `node --run test:web:browser` using Chrome.
The browser suite covered all four routes at 320, 390, 768, 1024 and 1440px;
new-feature cases used isolated fixtures. Desktop comparison and mobile overlap
screenshots were also reviewed. No live provider or paid Recipe acceptance was
performed, and no deployment or gateway configuration was changed.

For a controlled live demonstration, use a supported position and two blocks
within both archive-RPC and Graph coverage. Retain both downloaded reports and
the comparison, inspect actual Graph deployment and block/hash alignment, then
optionally perform one explicitly consented Bazantic explanation. Retain a
failure or replay case separately. Do not present fixture-generated changes as
live observations, continuous monitoring or proof of Graph prize eligibility.

Continuous Substreams hosting, accounting-monitoring mode, withdrawal-limit
tracking and a custom Rust event module remain outside this implementation.

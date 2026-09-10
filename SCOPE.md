# Current scope

Phases one through three and the local implementations of phases four through six
are delivered within the boundaries below. Hosted acceptance remains open.

Phase two extends the CLI with versioned evidence and offline adapter replay.
It supports canonical ERC-20 identity on one EVM chain per snapshot, multiple
positions for one owner, proportional synthetic holdings, typed relationships,
partial results, cycle/ownership findings and JSON receipts. Version one remains
compatible. An explicit native-wallet RPC balance read exists separately.

Phase three adds public Morpho GraphQL discovery and a live, read-only Ethereum
USDC MetaMorpho V1/Morpho Blue V1 adapter. It resolves a vault's withdrawal-queue
loan receivables, accrues interest/fees, reconciles contract conversion views and
emits block-pinned schema-three captures/receipts with offline replay. The public
example resolved all 12 markets; see [acceptance evidence](docs/PHASE_3.md).

Phase four adds share and underlying accounting indexing, same-block Graph/RPC
comparison, real local indexer rollback tests, nested V2-to-V1-to-Blue resolution,
timestamped USD prices and a scoped WETH custody control. Deployment and live Graph
acceptance are deferred by the user; lending backing remains unverified.

Phase five adds the shared service, API/OpenAPI, Tare MCP, web explorer, hosted
access controls and deterministic two-source composition. Hosted deployment,
Bazantic's required gateway, native Recipe and live acceptance remain deferred.

Phase six implements event-driven V1 monitoring through an existing Substreams
package, with checkpoint/replay/reorg handling and local alerts. Hosted acceptance,
V2 monitoring and periodic refresh remain outside this delivered scope.
Phase seven adds a confidential CRE policy handler, signed verdicts and a guarded
Sepolia Solidity exit receiver. Local SDK/Foundry tests and WASM compilation are
delivered. A verified Sepolia evidence producer, hosted confidential acceptance
and deployed exit acceptance remain open. Current V1 evidence cannot execute.
ENS is outside the agreed plan. Other deferred capabilities include additional
protocol families/chains, broader standardized indexing, independent lending
backing verification and its numerical multiples, cross-chain holdings, general
debt/cycle valuation, native assets inside exposure snapshots, address checksums,
browser wallet connection, user-wallet signing and mainnet transaction execution.

The original allocation recordings are synthetic; `fixtures/live` contains a real
public RPC capture. Live health is measured; offline health/classification remain
input assertions. Complete means complete within the declared adapter scope, not
the owner's entire portfolio or recursively verified collateral. A content digest,
contract-view reconciliation or complete traversal does not establish independent backing.
Rust remains outside this phase; see [language strategy](docs/LANGUAGE_STRATEGY.md).

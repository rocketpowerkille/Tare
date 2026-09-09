# Current scope

Phases two and three are implemented within the boundaries below.

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

Deferred: other live protocol families/assets/chains, The Graph gateway/Subgraph
integration, independent backing verification, pricing/numerical multiples, cross-chain holdings,
general debt/cycle valuation, native assets inside exposure snapshots, ENS/checksums,
browser wallet connection, signing/transactions/deployment, monitoring, API, MCP, web.

The original allocation recordings are synthetic; `fixtures/live` contains a real
public RPC capture. Live health is measured; offline health/classification remain
input assertions. Complete means complete within the declared adapter scope, not
the owner's entire portfolio or recursively verified collateral. A content digest,
contract-view reconciliation or complete traversal does not establish independent backing.
Rust remains outside this phase; see [language strategy](docs/LANGUAGE_STRATEGY.md).

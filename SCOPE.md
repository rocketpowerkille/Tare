# Current scope

Phase two extends the CLI with versioned evidence and offline adapter replay.
It supports canonical ERC-20 identity on one EVM chain per snapshot, multiple
positions for one owner, proportional synthetic holdings, typed relationships,
partial results, cycle/ownership findings and JSON receipts. Version one remains
compatible. An explicit native-wallet RPC balance read exists separately.

Deferred: live vault discovery, Graph clients, production protocol adapters,
independent backing verification, pricing/numerical multiples, cross-chain holdings,
general debt/cycle valuation, native assets inside exposure snapshots, ENS/checksums,
browser wallet connection, signing/transactions/deployment, monitoring, API, MCP, web.

All allocation recordings are synthetic. Health/classification are input assertions.
A content digest or complete traversal does not establish independent backing.
Rust remains outside this phase; see [language strategy](docs/LANGUAGE_STRATEGY.md).

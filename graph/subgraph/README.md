# Tare share ledger and accounting — hosted deployment pending

This AssemblyScript subgraph reconstructs the ERC-20 share ledger of the Ethereum
Steakhouse USDC MetaMorpho V1 vault. A separate end-of-block mapping observes its
underlying accounting. Actual Graph Node indexing and rollback acceptance are
documented in the [integration runbook](../integration/README.md).

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
```

The output is `build/subgraph.yaml` and `build/VaultShares/VaultShares.wasm`.
Generated bindings and build artifacts are ignored. The package has its own pinned
npm lockfile because Graph mappings use AssemblyScript, separate from the root
TypeScript/pnpm application. Neither installation nor build deploys anything.

## Accounting and deployment requirements

- `Transfer(0x0, receiver, amount)` mints shares, including performance-fee shares.
  A transfer to zero burns shares. Other transfers move existing shares. Deposits
  and withdrawals are not also counted, which would duplicate share changes.
- Balances use BigInt. Self-transfers conserve supply and balance. Event IDs use
  transaction hash and log index; duplicate delivery does not apply the change twice.
- Initial identity uses `asset()` and `decimals()` from the vault. A reverted read
  or negative ledger balance stops indexing rather than inventing state.
- **Full transfer history is required.** `startBlock: 0` is deliberately conservative.
  Before deployment it may be narrowed to an independently confirmed deployment
  block, updating `indexedFromBlock` context to match. Never start after existing
  balances have been minted without implementing an explicit audited bootstrap.
- The static address and network are intentionally fixed to the public example.
  Other contracts need reviewed data sources and confirmation that their shares
  are non-rebasing and completely represented by Transfer events. A native token,
  rebasing asset or arbitrary lending position cannot use this ledger unchanged.
- Historical queries are needed for verification, so `indexerHints.prune` is
  `never`. Account for its storage cost when choosing deployment configuration.
- An account has no entity until a transfer touches it. The verifier treats a
  missing entity as unknown, even when it could mean an unused zero-balance account.
- Graph Node owns canonical-chain indexing and rollback. The Docker integration
  test exercises actual rollback; hosted mainnet acceptance is still pending.

## Query contract

`vault` and `accountBalance` are queried with the same `block` argument as `_meta`.
The account entity ID is the normalized `vault-address` + `-` + `owner-address`.
`_meta.block.hash` must match RPC, indexing errors must be absent, and an expected
deployment CID can be enforced by the caller. Total shares and account shares
come from event arithmetic, not from copying the RPC values being compared.

Vault asset/decimals metadata itself uses contract reads during initialization;
matching those fields does not make them independent backing evidence. The
accounting mapping observes `totalAssets`, fee inputs, withdrawal queue, Blue
market parameters/state and positions at every block from 25937756.
`convertToAssets` is owner-dependent and is not indexed. Accounting reads can be
expensive and require archive access. Identity and read failures stop indexing;
stale state is never silently treated as current.

The user deferred deployment configuration. When it is ready, use the compiled
artifact in a reviewed Graph Studio/Graph Node deployment, wait for indexing,
then set `TARE_GRAPH_URL` and optionally `GRAPH_API_KEY` and
`TARE_GRAPH_DEPLOYMENT` for `tare verify shares`. Keep tokens local. See the
[phase-four acceptance checklist](../../docs/PHASE_4.md).

References: [Graph manifests](https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/),
[AssemblyScript mappings](https://thegraph.com/docs/en/subgraphs/developing/creating/graph-ts/api/),
[historical GraphQL queries](https://thegraph.com/docs/en/subgraphs/querying/graphql-api/).

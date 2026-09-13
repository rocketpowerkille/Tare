# Tare share ledger and accounting

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
- **Full transfer history is required.** The share ledger starts at the Steakhouse
  USDC creation block, `18928285`, and `indexedFromBlock` matches it. Morpho's vault
  directory and Etherscan independently report that creation block. Never start
  after existing balances have been minted without implementing an explicit audited
  bootstrap.
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

## Deadline-safe live accounting deployment

`subgraph.live.yaml` is a second, deliberately narrower Studio deployment for
`tare-live-accounting`. It contains only the accounting block handler and starts
near the Ethereum head observed before deployment, so it can provide a current
Graph/RPC accounting comparison without waiting for the complete share-transfer
history. It does not claim to reconstruct historical account balances and does
not replace the full `subgraph.yaml` ledger.

Refresh its `startBlock` immediately before any later deployment. Build it with
`npm run build:live`, then deploy it to the separate Studio project so deploying a
new version does not archive the full-history version. The handler performs the
complete bounded accounting read set on every block from that point forward.

Studio version `0.1.0` is deployed at `tare-live-accounting` with manifest CID
`QmWSiZRvaFzYkohhsM2D9yHD4Nc7ZnZFRWz8pUcwfQi3j2` and development endpoint
`https://api.studio.thegraph.com/query/1760123/tare-live-accounting/0.1.0`.
At Ethereum block `25953771`, `_meta` reported the same CID, the exact block hash
and no indexing errors. Tare compared all 56 indexed accounting reads with an
independent public RPC at that block: 56 matched and zero mismatched. The ignored
local capture is reproducible and is not a substitute for the public endpoint.

Graph Studio version `0.1.0` is deployed at
`tare-steakhouse-usdc-ethereum` with manifest CID
`QmZrGd5mh9V5x57J4ETN9sWVP2P3VMVpRgQ7p5XK9CW1hw`. Full historical share
acceptance is not established in this repository. Current sync progress and its
completion time were not checked in the documentation review. The separate
`tare-live-accounting` endpoint and its historical 56/56 comparison cover bounded current
accounting agreement, not historical share reconstruction. `GRAPH_API_KEY` is
optional when the endpoint does not require one. Keep any key local. See the
[Graph integration guide](../../docs/GRAPH_INTEGRATION.md).

References: [Graph manifests](https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/),
[AssemblyScript mappings](https://thegraph.com/docs/en/subgraphs/developing/creating/graph-ts/api/),
[historical GraphQL queries](https://thegraph.com/docs/en/subgraphs/querying/graphql-api/),
[Morpho's V1 vault directory](https://docs.morpho.org/api/vaults-v1/list-v1-vaults/),
and [the Steakhouse USDC deployment on Etherscan](https://etherscan.io/address/0xbeef01735c132ada46aa9aa4c54623caa92a64cb).

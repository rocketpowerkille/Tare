# Phase four: historical indexing and accounting acceptance

The Ethereum implementation and local Graph Node acceptance tests are delivered.
Graph Studio version `0.1.0` was deployed under
`tare-steakhouse-usdc-ethereum`. Current synchronization was not checked in the
2026-09-13 documentation review. **The full phase-four milestone is not closed:**
a fully indexed mainnet Graph/RPC acceptance capture remains required. Broader
standardized indexing and multiple-network coverage are not implemented.

## Delivered

| Capability | Implementation and evidence |
| --- | --- |
| Share indexing | Transfer-derived supply/balances, including fee mints, burns and rollback |
| Underlying indexing | End-of-block vault accounting, withdrawal queue, market parameters/state and vault positions |
| Graph/RPC verification | Hash-pinned queries, deployment/identity checks, exact read-set comparison and replay |
| Real indexer testing | Graph Node 0.45.0, PostgreSQL, IPFS and Anvil; actual WASM mappings, orphan rollback and replacement burn |
| Three economic layers | Public OV USDC V2 → Steakhouse V1 → 12 Blue markets, through a V1 share-owning adapter |
| V2 accounting | Capped interest, pending performance/management fee shares, fee gates and conversion reconciliation |
| Valuation | Chainlink USDC/USD and ETH/USD rounds, timestamp/age/signed-answer checks and integer rounding |
| Backing policy | Consolidated shared loan claims; lending backing remains unknown; liquidity bounds are not withdrawal promises |
| Real 1x control | Canonical WETH holdings and native ETH custody cross-checked across two public RPC hosts with a common ETH/USD price |

The Graph Node test found a defect that mocks missed: `_meta` can return a null
hash for number-pinned historical queries. Verification now queries Graph by the
RPC block hash and checks both number and hash. `--block-number` still selects
that block through RPC.

## Verification and commands

```sh
node --run verify
node --run build:subgraph
node dist/apps/cli/src/main.js demo phase4
node dist/apps/cli/src/main.js live nested-replay fixtures/live/ov-usdc-v2.capture.json
node dist/apps/cli/src/main.js verify custody-replay fixtures/live/weth-custody.capture.json
```

`demo phase4` labels its 1x/3x arithmetic as synthetic. The separate WETH capture
is a real custody control. All replay commands are offline. See the
[Graph Node runbook](../graph/integration/README.md) and
[public capture provenance](../fixtures/live/README.md). CI includes a Docker
integration job; its remote run has not been observed from this workspace.

```sh
# Configure TARE_RPC_URL. --out saves a capture for the new commands.
pnpm cli live nested --address 0xba3356e6a4eac76980067dbaa3758e5e5685cfb7 --vault 0x18032c694f8ebfdcc030cb8c54c3701a107c2f72 --out nested.json
pnpm cli live nested-replay nested.json --json

# Also configure TARE_SECONDARY_RPC_URL for a distinct provider.
pnpm cli verify custody --address 0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb --out custody.json
pnpm cli verify custody-replay custody.json --json

# After the Tare deployment has indexed the selected mainnet block:
pnpm cli verify shares --address 0x334f5d28a71432f8fc21c7b2b6f5dbbcd8b32a7b --vault 0xbeef01735c132ada46aa9aa4c54623caa92a64cb --block-number 25937756 --out shares.json
pnpm cli verify accounting --vault 0xbeef01735c132ada46aa9aa4c54623caa92a64cb --block-number 25937756 --out accounting.json
pnpm cli verify accounting-replay accounting.json --json
```

Graph commands use `TARE_GRAPH_URL`, `TARE_RPC_URL`, optional `GRAPH_API_KEY`, and
`TARE_GRAPH_DEPLOYMENT` to pin a manifest CID. Flags override environment values;
`.env` is not loaded automatically. Keys stay in headers and out of receipts.

New nested/accounting/custody commands export **captures** with `--out`; replay
recomputes reports/digests rather than trusting saved result fields. Existing
`verify shares --out` still exports its validated report for `verify replay`.
Exports never overwrite. Exit 0 means complete accounting or a matched comparison
within scope; 2 means incomplete/mismatch; 1 means invalid input or I/O failure.
Complete nested accounting can coexist with unavailable valuation if pricing fails.

## Limits

The nested adapter supports Ethereum USDC V2 vaults with V1 adapters, at most 64
adapters and 64 markets per V1, bounded globally by 1,000 RPC requests and five
minutes. Positive unsupported adapters, cycles or accounting contradictions suppress
attribution. Zero-value adapters stay unexpanded. General V2→V2 wrappers and direct
Blue adapters are unsupported. The adapter custodian is not an extra economic
layer, and collateral references never create ownership.

The subgraph observes accounting at every block from 25937756. The share ledger
starts at the vault creation block, 18928285, preserving its full transfer history
without scanning pre-deployment blocks. An archive-capable indexer RPC is needed;
per-block indexing can be expensive. Select the accounting start block deliberately.
The exact comparison covers 8 vault reads plus 4 per market: 56 for the public V1
example. This checks raw agreement, not independent IRM accrual or solvency.

For deadline-safe hosted acceptance, `graph/subgraph/subgraph.live.yaml` isolates
the accounting handler in the separate `tare-live-accounting` Studio project and
starts near the deployment-time Ethereum head. This produces current accounting
evidence quickly while the creation-block share ledger continues its independent
historical backfill. The live-only deployment does not claim historical share
reconstruction.

The retained hosted accounting acceptance note reports Studio version `0.1.0`, deployment
`QmWSiZRvaFzYkohhsM2D9yHD4Nc7ZnZFRWz8pUcwfQi3j2`, at Ethereum block `25953771`.
The public endpoint reported no indexing errors and Tare matched all 56 Graph
observations to block-pinned RPC reads with zero mismatches. This closes the live
accounting gate in that historical run, but not the separate full-history
share-ledger gate. Raw hosted output is not attached to this note. See
[the current Graph guide](GRAPH_INTEGRATION.md) for source and acceptance boundaries.

The WETH metric covers only the canonical wrapper's claim against native ETH
custody, excluding the holder's other liabilities. Distinct hostnames establish
provider diversity, not proven organizational independence or cryptographic state
proofs. Captures are unsigned. WETH's custody rule does not extend to stablecoin
reserves or lending receivables: the Morpho metric remains unavailable even with
observed USD valuation.

## Remaining gates

- [x] Local subgraph build and bounded verification/replay.
- [x] Actual Graph Node indexing/reorg acceptance and retained evidence.
- [x] Indexed underlying accounting and exact comparisons.
- [x] Real three-layer resolution with conserved integer attribution.
- [x] Explicit debt, wrapper, shared-backing and liquidity treatment.
- [x] Timestamped valuation, real WETH 1x control, and partial/mismatch tests.
- [x] Deadline-safe live Studio accounting: 56/56 Graph/RPC reads matched at one
  canonical Ethereum block with the deployment CID pinned.
- [ ] Full-history share reconstruction remains unaccepted. It is not a
  submission dependency; no completion-time prediction is made. Submission
  evidence uses the separate pinned `tare-live-accounting` deployment and its
  completed 56/56 same-block Graph/RPC comparison. Do not present that deployment
  as historical share reconstruction.
- [ ] Broader standardized indexing/multiple-network coverage, if retained as a
  submission milestone. This implementation remains Ethereum-only.

API/MCP/web is documented in phase five, monitoring in phase six, and execution in
phase seven. No mainnet execution is claimed. Anvil transactions are
confined to the localhost integration test.

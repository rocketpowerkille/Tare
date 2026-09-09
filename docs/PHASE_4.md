# Phase four — implementation delivered, hosted acceptance pending

The Ethereum implementation and local Graph Node acceptance tests are delivered.
**The full phase-four milestone is not closed:** the user previously deferred
Graph deployment, and no production Graph endpoint/CID is configured. A fully
indexed mainnet Graph/RPC acceptance capture remains required. Broader standardized
indexing and multiple-network coverage are not implemented.

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
tare live nested --address 0xba3356e6a4eac76980067dbaa3758e5e5685cfb7 --vault 0x18032c694f8ebfdcc030cb8c54c3701a107c2f72 --out nested.json
tare live nested-replay nested.json --json

# Also configure TARE_SECONDARY_RPC_URL for a distinct provider.
tare verify custody --address 0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb --out custody.json
tare verify custody-replay custody.json --json

# After the Tare deployment has indexed the selected mainnet block:
tare verify shares --address 0x334f5d28a71432f8fc21c7b2b6f5dbbcd8b32a7b --vault 0xbeef01735c132ada46aa9aa4c54623caa92a64cb --block-number 25937756 --out shares.json
tare verify accounting --vault 0xbeef01735c132ada46aa9aa4c54623caa92a64cb --block-number 25937756 --out accounting.json
tare verify accounting-replay accounting.json --json
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
starts at zero for full transfer history. An archive-capable indexer RPC is needed;
per-block indexing can be expensive. Select the accounting start block deliberately.
The exact comparison covers 8 vault reads plus 4 per market: 56 for the public V1
example. This checks raw agreement, not independent IRM accrual or solvency.

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
- [ ] Configure production deployment, index full share history, and retain matched
  mainnet share **and** accounting reports at one indexed block.
- [ ] Broader standardized indexing/multiple-network coverage, if retained as a
  submission milestone. This implementation remains Ethereum-only.

API/MCP/web remains phase five, monitoring phase six, optional execution phase
seven. No mainnet transactions are signed or broadcast. Anvil transactions are
confined to the localhost integration test.

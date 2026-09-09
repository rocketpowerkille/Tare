# Architecture

The CLI entry point parses and dispatches commands; wallet, snapshot, demo, live
and verification workflows have separate handlers. Argument utilities are shared,
and live receipt formatting belongs to `packages/receipts`.

Share verification separates `capture.ts` (evidence schemas), `shares.ts` (source
acquisition), `comparison.ts` (pure checks) and `report.ts` (validation and replay).
The existing `shares.ts` exports remain available to callers. Live tests are split
into accounting, source-client and CLI cases, using shared HTTP/process fixtures
under `tests/helpers/`.

Phase two extends this layout with `packages/domain/src/v2.ts`,
`packages/adapters/src/index.ts`, and the version-two resolver/receipt modules.
The schema-one path remains supported independently.

```text
synthetic response recording -> adapter registry -> validated schema 2 snapshot
schema 2 snapshot ---------------------------------------> deterministic resolver
                                                           -> evidence receipt
```

`snapshot normalize` exports the intermediate format. `replay` performs both steps;
`resolve` accepts either normalized schema version. Adapter response validation is
separate from envelope/reference validation. Unsupported adapters and invalid source
response shapes produce opaque nodes; programmer exceptions fail visibly.

Version two adds a global edge budget alongside depth and visit limits. Dependencies
are recorded separately from traversed holdings. Observations, root balances and
holding/debt edges are checked against the common block and declared source health.
See [phase two](PHASE_2.md) and [accounting](ACCOUNTING.md) for exact semantics.

Offline CLI inputs pass through strict schemas before reaching the deterministic resolver.
The local snapshot is normalized evidence for a synthetic model. The resolver has
no filesystem, provider, wallet, or transport dependency.

```text
CLI arguments -> local snapshot reader -> domain validation -> resolver -> receipt
      |                                                    -> text / JSON / file
      +-------> watch-only profile store -> owner/network match
      +-------> explicit EVM RPC URL -> chain check -> block-pinned native balance
```

The native-balance path is separate from exposure resolution. It validates the RPC
chain against the selected watch-only profile and records the observed block number
and hash. It does not feed RPC data into the synthetic snapshot schema.

`domain` defines a versioned snapshot and a discriminated complete/partial receipt.
Partial receipts contain at least one finding; complete receipts contain none.
Verification is fixed to `unverified` for this phase, and the metric type only
permits `unavailable`. This prevents downstream code from presenting a numerical
headline that the offline evidence cannot support.

Snapshots include chain and block context, sources with declared health, a root
owner/position, and uniquely identified vault/token/opaque nodes. Each observation
carries a source and block reference. Duplicate node IDs and allocation targets
are rejected; missing node references remain resolvable as explicit gaps.

The resolver indexes nodes once and traverses each attributed path. It uses the
active ancestor path to detect cycles, so converging paths remain valid. There is
no amount-dependent result cache: the same node can receive different amounts,
and integer floors must be preserved on each path. Independent terminal exposures
are aggregated by node ID. Snapshot authors must assign one canonical ID per asset.

Depth is capped at 128 vault layers. The global visit budget caps path expansion,
including repeated visits to shared nodes. Once exhausted, traversal stops globally
and emits an explicit gap. File size, number of nodes, number of allocations per
node, and numeric input lengths are bounded before traversal. A block mismatch or
unavailable source stops only the affected branch.

## Phase-three live path

```text
public Morpho GraphQL -> indexed owner/vault discovery and metadata
explicit RPC URL -> chain check -> pinned block hash -> static contract calls
                               -> MetaMorpho/Blue accounting -> block confirmation
                               -> schema 3 receipt + raw capture
saved raw capture -> same protocol accounting -> recorded-rpc receipt
```

`apps/cli/src/live.ts` exposes discovery, resolution, public-example selection and
replay. `packages/sources/src/http.ts` bounds streamed response bytes and time;
`evm.ts` enforces RPC identity, request/deadline budgets and block-hash calls;
`morpho.ts` validates paginated public GraphQL discovery. Provider URLs and error
bodies are excluded from captured evidence to avoid retaining endpoint tokens.

`packages/adapters/src/morpho-blue.ts` implements the supported protocol's static
ABI reads, interest, fee and virtual-share rules. `packages/resolver/src/live.ts`
acquires/replays evidence and reconciles allocations against vault contract views.
It distinguishes transport errors, unsupported/malformed evidence, bounded partial
coverage, conversion inconsistencies and reorgs. Concurrent read groups settle
before evidence is frozen. Schema-three receipts live in `domain/src/live.ts` and
do not change either synthetic schema or its accounting model.

GraphQL is discovery-only and unpinned. RPC accounting uses one block hash plus a
final confirmation; it is not an independent source consensus. Successful and
failed contract reads are retained for deterministic replay. Collateral/oracle/IRM
references are risk dependencies, not holdings to multiply into exposure.
Complete live receipts cover vault-to-Blue loan receivables only. Verification and
the metric remain unavailable pending phase four. See [phase three](PHASE_3.md).

## Phase-four share-ledger comparison (local, deployment pending)

```text
vault Transfer events -> AssemblyScript mapping -> Tare share-ledger subgraph
                                                -> historical Graph query --+
fresh Ethereum RPC -> chain check -> same-block contract reads --------------+-> share comparison
                                                                            -> report and replay
```

`graph/subgraph/` maintains supply and account balances from events, with identity
metadata read once when first observed. `sources/src/the-graph.ts` targets this
specific schema. `verification/src/shares.ts` checks Graph metadata, optional
deployment identity and block alignment before comparing asset, decimals, supply
and owner shares. `apps/cli/src/verify.ts` exposes comparison and offline replay.
The receipt schema recomputes its checks from captured evidence during validation.

The subgraph compiles locally; Graph Node indexing and live source acceptance
have not been run. A matched share report is not verified backing and cannot
enable a numerical collateral metric. The remaining phase-four work is recorded
in [its acceptance checklist](PHASE_4.md).

## Future monitoring language boundary

The resolver, provider clients, protocol adapters, verification, API, MCP server,
web application, and monitoring consumer remain TypeScript. Standardized
Subgraph mappings use AssemblyScript and do not require Rust.

Rust may appear only in `graph/substreams/` if Tare must author a custom
Substreams block-extraction module. That module compiles to WebAssembly and emits
validated, versioned change messages to the TypeScript monitoring service. Using
an existing Substreams package does not add a Rust requirement to Tare.

The custom module is gated on successful live Graph-to-resolver-to-RPC
verification and proof that existing packages cannot supply the required events.
See [Language strategy and Rust boundary](LANGUAGE_STRATEGY.md) for the complete
decision and component matrix.

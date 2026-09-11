# Architecture

Phase seven keeps private policy rules and V1 report projection in `packages/policy`.
The isolated `workflows/cre` package owns enclave secret access, API acquisition,
redacted signing and guarded Base Sepolia report submission. Its V1 projection trusts the
configured Tare service and cannot upgrade Ethereum lending backing to verified evidence.
The separate Base producer pins two differently hosted RPCs, checks allowlisted contract
bytecode and reconciles both custody layers at one block before creating eligible evidence.
`contracts` owns the one-use ERC-4626 exit receiver; its ABI has a shared test vector
with the workflow. Deployment-backed Base acceptance and hosted acceptance remain open.
See [phase seven](PHASE_7.md).

Phase-five interfaces add `packages/service` for request validation, provider
configuration, bounded operation dispatch and named example replay. `apps/api`
owns HTTP and the generated OpenAPI contract; `apps/mcp` owns MCP stdio transport;
`apps/web` is the static explorer served by that API. Both transports return the
existing reports without recalculating or relabeling their evidence. Neither
accepts a provider URL, credential or arbitrary filesystem path in a request.
`apps/api/src/access.ts` owns optional hosted authentication, origin validation
and bounded per-client quotas. The server stays behind a loopback reverse proxy.
`packages/service/src/composition.ts` recomputes and joins the resolution, share
capture and direct Graph response; it reuses the existing verifiers. The web
controller owns requests and temporary access tokens, while `report.js` owns
rendering and downloadable evidence. The CLI remains independently usable.
See [phase five](PHASE_5.md).

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

The actual mappings pass a local Graph Node/Anvil indexing and rollback test.
Mainnet Graph deployment remains pending. Share agreement is not backing
verification. Remaining acceptance gates are in [phase four](PHASE_4.md).

The accounting mapping runs separately at end of block. `accounting-reads.ts`
defines the bounded RPC read set; `verification/accounting-capture.ts` validates
captured data and `verification/accounting.ts` acquires/replays exact comparisons.
Graph queries use hashes because number-pinned `_meta` may return null hashes.

`adapters/morpho-v2.ts` reconstructs V2 interest and fee dilution. The bounded
`resolver/nested.ts` expands V1 share-owning adapters through the existing V1/Blue
analysis, preserving per-path rounding. `sources/recorded.ts` supplies validated
offline RPC reads. New CLI handlers export captures for deterministic replay.

`sources/chainlink.ts` handles price rounds and precision. `verification/backing.ts`
consolidates loan claims without treating borrower collateral as owned cash.
`verification/custody.ts` implements the separate canonical WETH/native ETH
control using two RPC witnesses, with separate capture schema and CLI handler.
Generic methodology controls in `metric.ts` cannot authorize live metrics; the
WETH path requires raw block-aligned evidence and reports its narrow scope.

## Monitoring

The phase-six CLI delegates stream decoding to the source module, pure block/undo
transitions to the monitor engine, and capture evaluation to existing resolution
and composition. A dedicated store commits evidence before atomic progress updates.
The worker coordinates reconnection and bounded runs; it does not perform accounting.
See [phase six](PHASE_6.md) for protocol scope, persistence and operational limits.

## Monitoring language boundary

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

# Architecture

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

CLI inputs pass through strict schemas before reaching the deterministic resolver.
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

Future provider and protocol adapters belong behind `sources` and a future
`adapters` module. They must preserve provenance and error semantics before being
allowed to feed a live snapshot schema. Do not extend the current synthetic
provenance enum without implementing its evidence requirements.

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

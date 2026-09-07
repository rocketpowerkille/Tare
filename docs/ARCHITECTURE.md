# Architecture

CLI inputs pass through strict schemas before reaching the deterministic resolver.
The local snapshot is normalized evidence for a synthetic model. The resolver has
no filesystem, provider, wallet, or transport dependency.

```text
CLI arguments -> local snapshot reader -> domain validation -> resolver -> receipt
      |                                                    -> text / JSON / file
      +-------> watch-only profile store -> owner/network match
```

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

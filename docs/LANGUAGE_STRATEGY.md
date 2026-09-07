# Language strategy and Rust boundary

Tare is a TypeScript-first project. The core product does not require Rust.
Rust may be introduced later for one narrowly defined purpose: authoring a
custom Substreams block-extraction module when an existing reusable package
cannot provide the events required by the monitoring phase.

## Component ownership

| Component | Implementation language | Rust requirement |
| --- | --- | --- |
| Wallet and multi-chain EVM RPC integration | TypeScript | None |
| Graph clients and protocol adapters | TypeScript | None |
| Standardized Subgraph | GraphQL/YAML and AssemblyScript mappings | None |
| Resolver, accounting, receipts, and verification | TypeScript | None |
| CLI, API, MCP, web explorer, and Bazantic recipe | TypeScript | None |
| Chainlink CRE workflow | TypeScript | None |
| Substreams consumer, cursor handling, and alerting | TypeScript | None |
| Custom Substreams block-extraction module | Rust compiled to WebAssembly | Required only if authored |

AssemblyScript is a TypeScript-like language used for Subgraph mappings; it is
not Rust. Similarly, consuming outputs from an existing Substreams package does
not require the Tare application to contain Rust. Rust is necessary only when
Tare authors the upstream Substreams module that processes blocks and emits a
normalized stream.

## Decision gate

Do not introduce Rust until all of the following are true:

1. A real wallet or position resolves from live Graph data end to end.
2. Its terminal exposure has been independently reconstructed through
   block-pinned RPC.
3. Suitable existing Substreams packages do not expose the allocation or
   parameter-change events required by monitoring.
4. Monitoring remains within the delivery schedule and materially strengthens
   the submission.

If these conditions are not met, consume an existing Substreams package or use
Subgraph queries/RPC logs for the initial monitor and document the latency
trade-off. If monitoring is cut, the project has no Rust requirement.

## Architectural boundary

If approved, the Rust code belongs only in `graph/substreams/` and compiles to
WebAssembly. Its responsibilities are limited to reading blocks and events,
normalizing supported changes, and emitting versioned messages. The TypeScript
monitor consumes those messages, handles cursors and reorgs, triggers
re-resolution, and emits alerts.

Do not rewrite the resolver, accounting, verification, wallet integration,
clients, API, MCP server, web application, Bazantic integration, or Chainlink
CRE workflow in Rust for speculative performance. Reconsider a core-language
change only if profiling identifies a concrete bottleneck that cannot be met in
TypeScript.

Under the current roadmap, Rust represents at most roughly 5–10% of the planned
engineering scope. It represents 0% if Tare does not need to author a custom
Substreams module.

## References

- [The Graph: AssemblyScript mappings](https://thegraph.com/docs/en/subgraphs/developing/creating/assemblyscript-mappings/)
- [The Graph: Substreams quick start](https://thegraph.com/docs/en/substreams/quick-start/)


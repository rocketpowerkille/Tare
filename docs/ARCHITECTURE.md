# Architecture

Tare separates evidence acquisition, supported protocol calculations, comparison,
and presentation. The same pure calculations are reused for live acquisition and
saved-capture replay. The system has no general solvency or safety oracle.

## Interfaces and shared service

```text
Web UI / HTTP client / CLI / MCP client
  -> operation validation and configured provider selection
  -> acquisition and supported protocol traversal
  -> eligible comparisons and value calculations
  -> full report or compact agent projection
```

| Component | Responsibility |
| --- | --- |
| `apps/web` | React investigation workspace, report views, source details, and downloads. |
| `apps/api` | HTTP routes, generated OpenAPI, hosted authentication, origins, and quotas. |
| `apps/cli` | Input/output coordination, bounded file operations, live commands, and replay. |
| `apps/mcp` | Local stdio MCP transport over shared service operations. |
| `packages/service` | Request schemas, configuration, dispatch, and named examples. |

Provider URLs, credentials, and arbitrary filesystem paths are not accepted as
evidence-operation request parameters. Local HTTP serving defaults to loopback;
external binding requires configured hosted access. The CLI retains separate,
explicit local provider configuration.

## Acquisition and protocol calculations

`packages/sources` acquires public discovery metadata, RPC reads, Graph data, and
eligible Chainlink price rounds. Requests have identity, size, and time bounds.
Morpho's GraphQL API provides discovery; it is not The Graph and discovery does
not verify a position.

`packages/adapters` implements supported protocol rules.
`packages/resolver` traverses positions and attributes amounts using integer
arithmetic. Per-path flooring, unsupported branches, cycles, missing observations,
and budgets remain explicit. Collateral and oracle references are dependencies,
not additional assets owned by the wallet.

V1 lending traversal and bounded Ethereum USDC V2-to-V1 traversal have different
eligibility rules. Generic ERC-4626 reads describe the contract's accounting
without claiming arbitrary downstream composition. The synthetic fixture model
is separate from live protocol accounting.

## Verification and provenance

`packages/verification` separates capture validation, acquisition, and pure
comparisons. Indexed accounting checks validate chain, deployment identity,
block/hash, and the declared read set. Missing observations or source disagreement
cannot be converted into a matched result.

Captures preserve source mode and observation context. Replay recomputes from
saved evidence without claiming a fresh provider query. Digests identify
normalized evidence bytes, not cryptographic proof of provider truth.
[The evidence model](EVIDENCE_MODEL.md) defines classifications and status scope.

## The Graph

`graph/subgraph` contains custom AssemblyScript share-ledger and accounting
mappings. A separate accounting-only manifest avoids requiring full historical
share reconstruction for a current-state comparison. Product composition adds
the Token API wallet-share observation and checks eligible data against RPC.

[The Graph guide](GRAPH_INTEGRATION.md) documents block alignment, deployment
references, failure modes, and historical acceptance limits.
[The local integration harness](../graph/integration/README.md) runs actual Graph
Node mappings and reorg tests.

## Chainlink policy and execution

`packages/policy` owns private-policy evaluation and evidence projection.
`workflows/cre` acquires secrets and authenticated Tare evidence inside
`handlerInTee`, evaluates the policy, and publishes bounded outputs for DON
reporting. Eligible testnet delivery goes through the forwarder to
`contracts/src/BoundedVaultExit.sol`.

The workflow trusts the configured Tare service for economic evidence. It does not
independently prove lending backing. The receiver restricts chain, caller,
workflow identity, owner consent, exact terms, freshness, and nonce. Its testnet
execution is separate from Explorer's read-only price-feed checks.
See [the Chainlink guide](CHAINLINK_CONFIDENTIAL_WORKFLOW.md).

## Agent projection and Bazantic

`packages/receipts` formats full and compact results.
`explanation.ts` builds a deterministic, bounded explanation context with exact
values, provenance, limitations, and omission counts. It does not call a model.

Bazantic exposes gateway tools and Recipe-guided external agent use. The local
stdio tool names and gateway tool names are different surfaces. The browser can
copy explanation context or link to the public Recipe; copying does not execute
a Recipe. Sandbox authorization metadata is distinct from settlement and vault
evidence. See [Bazantic integration](BAZANTIC_INTEGRATION.md).

## Monitoring

The TypeScript monitoring consumer separates stream decoding, block/undo
transitions, persistent checkpoints, reconnection, and evidence evaluation.
Hosted continuous Substreams acceptance remains incomplete. A local rollback
test or saved event stream must not be presented as a running hosted monitor.
No custom Rust extraction module is required by the implemented consumer.

## Code and test boundaries

Schemas belong in `packages/domain`; sources acquire evidence; adapters implement
protocol semantics; resolvers calculate; verifiers compare; receipt code presents.
Interface code coordinates those modules without redefining their accounting.
Original captures and failure cases remain under `fixtures` and `tests`.
[CI configuration](../.github/workflows/ci.yml) lists the separate application,
Graph, CRE, and contract checks.

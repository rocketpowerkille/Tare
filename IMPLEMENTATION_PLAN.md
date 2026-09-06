# Tare — Full Implementation Plan

## 1. Project status

The repository currently contains the project brief in `IDEA.md`. There is no implementation yet and no existing commit history.

Tare will resolve what a crypto portfolio or protocol is economically exposed to after traversing supported ERC-4626 vault and strategy layers. Its primary deliverables are:

- Position discovery for a wallet or supplied vault position.
- Resolution of supported vault allocations into terminal asset exposures.
- An effective collateral multiple with a precise, published methodology.
- Circular holding and dependency detection.
- Explicit source health, coverage, and partial-resolution reporting.
- Independent verification using block-aligned RPC reads.
- Change monitoring through Substreams.
- A reusable MCP interface and natural-language analysis surface.
- A visual exposure explorer and shareable evidence artifacts.

The resolver and its evidence model are the product. Monitoring, sponsor integrations, and automated actions are built only after the resolver works on real live data.

## 2. Product definition

Tare should answer:

1. What does this wallet's vault position ultimately depend on?
2. How much of each supported underlying asset does the position represent?
3. Which apparently separate positions share the same dependencies?
4. Are there circular ownership or dependency paths?
5. Which results have been independently verified?
6. Which branches could not be resolved, and why?
7. Which tracked positions are affected when a dependency or risk parameter changes?

Three relationships must remain distinct throughout the system:

| Relationship | Meaning |
| --- | --- |
| Accounting asset | The token returned by a vault's `asset()` method |
| Actual allocation | Strategies, vault shares, lending positions, or idle assets holding the vault's capital |
| Risk dependency | Collateral, oracle, manager, adapter, and configuration dependencies that can affect the position |

Following `asset()` alone is insufficient. ERC-4626 standardizes a single accounting asset and share conversion interface, but it does not standardize how a vault deploys its capital. The implementation therefore needs a generic ERC-4626 reader plus protocol-specific allocation adapters.

"Fully resolved" must always mean fully resolved according to a documented support policy, at a specific block, using healthy sources.

## 3. Success criteria

The minimum competitive submission should demonstrate:

- Live data consumed from a Graph provider.
- A standardized schema or meaningful composition of two or more Graph products.
- At least one real nested mainnet position resolved through multiple economic layers.
- Actual account-level share ownership and attributed terminal exposure.
- Independent RPC verification at the same block.
- A control case that produces `1.0x` under clearly documented assumptions.
- A degraded case that returns a partial result and suppresses unsupported metrics.
- Cycle detection that terminates safely and presents the cycle as a finding.
- Reusable MCP tools that reason over the normalized data.
- A public repository, reproducible commands, and a two-to-four-minute demo video.

The stretch submission adds:

- Substreams monitoring with correct reorg and cursor handling.
- Blast-radius and resolution-diff tools.
- A Bazantic recipe combining Tare with another qualifying sponsor service.
- A Chainlink CRE Confidential Workflow if access and schedule permit.

## 4. First 48 hours: feasibility and de-risking

The hardest technical unknown is finding a real, sufficiently deep position whose allocations can be reconstructed consistently from live Graph data and independently verified through RPC.

Before writing the production resolver, complete a source and fixture audit.

### 4.1 Audit live data sources

For each candidate source, record:

- Protocol and network.
- Deployment or subgraph ID.
- Graph provider and query URL format.
- Whether an API key is required.
- Schema family and schema version.
- Latest indexed block and chain head.
- Indexing lag.
- Whether account positions are discoverable.
- Whether current share balances are available.
- Whether actual allocation edges are available.
- Whether historical changes are available.
- Query timeout, health status, and observed errors.
- Whether the source qualifies as live Graph data for the sponsor rules.

Initial candidates:

| Source | Known availability | Initial use |
| --- | --- | --- |
| Messari standardized subgraphs | Shared schemas including yield aggregators | Schema foundation and cross-protocol comparison |
| Morpho | Documented subgraphs, public vault discovery, and V2 allocation adapters | Strong first protocol candidate |
| Yearn V3 | ERC-4626 vaults allocating to ERC-4626 strategies | Strong candidate for deep allocation paths |
| Euler | Production subgraphs for position discovery | Candidate for discovery, but current documented deployments omit current position sizes and may not use a qualifying Graph provider |

### 4.2 Find real fixtures

Identify three to five mainnet candidates. A fixture is accepted only after its complete path has been checked onchain.

Candidate Morpho Ethereum vaults discovered during the initial research:

| Candidate | Address |
| --- | --- |
| Keyrock USDC | `0x04422053aDDbc9bB2759b248B574e3FCA76Bc145` |
| Apyx USDC | `0x069662D2588fcaC24B5c209456Db965D151556f0` |
| Hyperithm USDC Apex | `0x093272C07700d3cA5301C3Bf9B3A392624179E2F` |

These addresses are discovery candidates only. Their current funding, nesting depth, holder positions, Graph coverage, and allocation paths must be verified before they become fixtures.

Each accepted fixture manifest should contain:

- Fixture name and purpose.
- Chain ID.
- Root account or position owner.
- Root vault address.
- Share balance.
- Reference block number and hash.
- Expected allocation path.
- Economic layer count.
- Expected terminal assets.
- Data sources used per edge.
- Independent verification method.
- Known limitations.
- Last verification timestamp.

Depth must count economic vault or strategy layers. It should exclude the wallet itself and the terminal asset.

### 4.3 Feasibility exit criteria

The project proceeds with the full architecture when all of these are true:

- One live Graph query returns relevant real vault or account data.
- One candidate has an inspectable nested allocation path.
- The same position can be reconstructed through RPC at a common block.
- At least two protocol or network deployments can map into the proposed shared schema.
- The team can explain exactly what the headline multiple measures for the candidate.

If these conditions are not met, narrow the product to a rigorously verified resolver for the best-supported protocol family.

## 5. Proposed repository architecture

Use a TypeScript monorepo with strict compiler settings and focused packages.

```text
apps/
  api/                    HTTP API and resolution endpoints
  web/                    Interactive exposure explorer
  mcp/                    Reusable MCP server
  monitor/                Substreams consumer and alert evaluation

packages/
  domain/                 Branded identifiers, amounts, evidence, result states
  sources/                GraphQL clients, RPC clients, health checking
  adapters/               Generic ERC-4626 and protocol allocation adapters
  resolver/               Traversal, attribution, cycles, aggregation
  verification/           RPC reconstruction and source reconciliation
  receipts/               Versioned JSON and human-readable artifacts
  config/                 Validated network, source, and deployment registries
  test-fixtures/           Synthetic and block-pinned live fixture manifests

graph/
  subgraphs/              Shared schema, manifests, and mappings
  substreams/             Reusable normalization and change modules

scripts/
  discover-sources.ts
  inspect-fixture.ts
  verify-live-position.ts
  run-demo-cases.ts

docs/
  ACCOUNTING.md
  ARCHITECTURE.md
  DATA_SOURCES.md
  FIXTURES.md
  SUBMISSION.md

FIELD_NOTES.md
SCOPE.md
README.md
```

The resolver must be independent of the UI, model provider, and transport. The same deterministic calculation should power the CLI, API, MCP tools, and dashboard.

The no-database constraint will be honored with:

- Block-keyed in-memory caches for normal queries.
- Versioned generated snapshots for evidence and demo runs.
- Durable cursor and rollback checkpoint files for monitoring.
- IPFS for shareable immutable artifacts when useful.

A production monitor cannot rely on an ephemeral serverless filesystem because cursor and rollback state must survive process restarts.

## 6. Domain and type design

External identifiers should be branded after validation:

```ts
type ChainId = Brand<number, "ChainId">;
type Address = Brand<`0x${string}`, "Address">;
type BlockNumber = Brand<bigint, "BlockNumber">;
type BlockHash = Brand<`0x${string}`, "BlockHash">;
type RawAmount = Brand<bigint, "RawAmount">;
```

All external inputs and responses must be validated with Zod or an equivalent runtime validator. This includes GraphQL responses, RPC responses, environment variables, fixture files, generated snapshots, MCP arguments, and API payloads.

### 6.1 Separate topology completeness from verification

```ts
type Resolution =
  | {
      kind: "complete";
      graph: CompleteExposureGraph;
      coverage: CompleteCoverage;
      verification: VerificationResult;
    }
  | {
      kind: "partial";
      graph: ObservedExposureGraph;
      gaps: readonly [ResolutionGap, ...ResolutionGap[]];
      coverage: PartialCoverage;
    };

type VerificationResult =
  | { kind: "verified"; evidence: IndependentEvidence }
  | { kind: "unverified"; reasons: readonly string[] }
  | { kind: "mismatch"; discrepancies: readonly Discrepancy[] };

type MultipleResult =
  | {
      kind: "available";
      value: DecimalString;
      evidence: MetricEvidence;
    }
  | {
      kind: "unavailable";
      reasons: readonly MetricBlocker[];
    };
```

In the final design, metric functions should accept opaque eligible-input types created only by validated constructors. This prevents arbitrary objects from bypassing completeness and verification checks.

### 6.2 Graph node types

The exposure graph should distinguish at least:

- Account position.
- ERC-4626 vault.
- Protocol strategy.
- Lending position.
- Verified terminal token.
- Unverified terminal token.
- Opaque unsupported asset.
- Unresolved source node.
- Circular reference.

Edges should distinguish:

- Account ownership.
- Accounting conversion.
- Capital allocation.
- Custody.
- Lending supply or debt.
- Collateral dependency.
- Oracle dependency.
- Administrative dependency.

Every observation and edge must carry provenance:

- Chain and block reference.
- Source ID and adapter version.
- Raw source fields or a stable evidence reference.
- Observation timestamp.
- Confidence or verification state.
- Rounding performed during attribution.

## 7. Normalization layer

The normalization schema should cover:

- Networks and tokens.
- Vault identity and ERC-4626 metadata.
- Account share positions.
- Deposits, mints, withdrawals, and redeems.
- Share transfers.
- Vault state observations.
- Allocation edges.
- Risk dependency edges.
- Parameter-change observations.
- Source health observations.

Important rules:

- Index share transfers in addition to deposits and withdrawals because users can acquire positions by receiving shares.
- Never infer current share value from a historic deposit event.
- Use factory discovery where available and a documented registry for exceptions.
- Validate GraphQL partial responses, indexing errors, pagination, schema drift, and timeouts.
- Preserve source disagreements as discrepancies.
- Align observations to a common block per chain.
- Treat cross-chain observations as separate block contexts with explicit timestamps.

The project should describe its schema as a proposed ERC-4626 normalization schema with documented mappings to existing standards. It should not claim that a new project-specific schema is already an established industry standard.

## 8. Source adapters

Define a narrow adapter interface so the resolver does not contain protocol-specific logic.

```ts
interface ExposureAdapter {
  readonly id: string;
  readonly version: string;

  supports(input: AdapterProbe): Promise<SupportDecision>;
  identify(input: AdapterContext): Promise<IdentifiedNode>;
  resolve(input: ResolveNodeInput): Promise<NodeResolution>;
  dependencies(input: DependencyInput): Promise<readonly RiskDependency[]>;
}
```

Initial adapters:

1. Generic ERC-4626 reader
   - `asset()`
   - `totalAssets()`
   - `totalSupply()`
   - `balanceOf()`
   - `convertToAssets()`
   - `previewRedeem()` when appropriate
   - token metadata and interface probing

2. Morpho Vault V1/V2 adapter
   - Vault allocations.
   - V2 adapter discovery.
   - Idle assets.
   - Supported nested vault adapters.
   - Risk identifiers, caps, and roles where relevant.

3. Yearn V3 adapter
   - Strategy registry.
   - Per-strategy debt or allocation.
   - Strategy identity and downstream exposure.

4. Additional adapter selected by source quality
   - Euler Earn is a candidate if qualifying live Graph data and current allocation accounting can be established.

An adapter must return a structured unresolved result when a source is dead, a contract is unsupported, a call reverts, a required field is missing, or the observation cannot be aligned to the requested block.

## 9. Resolution engine

Use a directed graph internally. A tree is only a presentation view; shared downstream nodes and cycles require graph semantics.

### 9.1 Traversal flow

1. Validate the chain, address, requested block, and traversal budgets.
2. Discover supported account positions.
3. Read actual share balances at the reference block.
4. Probe the node and select the responsible adapter.
5. Read accounting conversions and actual allocations.
6. Attribute downstream holdings to the account's ownership fraction.
7. Traverse supported downstream vault or strategy nodes.
8. Detect active-path cycles.
9. Reuse previously resolved shared subgraphs.
10. Aggregate terminal exposure without double-counting ownership.
11. Reconcile evidence and determine completeness.
12. Compute eligible metrics only when their preconditions are satisfied.

### 9.2 Cycle detection

Use two complementary mechanisms:

- An active-path set during traversal to terminate immediately when the current path repeats a node.
- Strongly connected components over the observed graph to group and explain all circular structures.

A node reached from multiple independent parents is a shared dependency, not a cycle.

Cycle output should include:

- The exact ordered path.
- Contracts and protocols involved.
- Edge type for every hop.
- Attributed amounts when known.
- Evidence for every edge.
- Which calculations were withheld because of the cycle.

A circular relationship is a finding, but it is not automatically proof of economic leverage or misconduct.

### 9.3 Precision and rounding

- Use `bigint` for every raw token quantity.
- Preserve each token's decimals.
- Preserve the output and rounding of each onchain conversion.
- Use exact rational ownership fractions where possible.
- Convert to display decimals only at API or UI boundaries.
- Document tolerance rules for source reconciliation.

Cache conversion calls by chain, block, vault, method, and input amount. Caching only a rounded price-per-share can introduce material errors when conversions are nonlinear or perform integer rounding.

### 9.4 Traversal budgets

Support configurable limits for:

- Maximum depth.
- Maximum nodes.
- Maximum edges.
- Per-source timeout.
- Overall request deadline.
- RPC batch size.

Exhausting a budget produces a partial result with a typed reason. It must never produce a confident complete result.

## 10. Leaf policy

A terminal leaf is an asset whose token-level exposure has been identified according to the current support policy and does not have another supported allocation adapter.

Initial policy:

- Major plain ERC-20 assets can be terminal token exposures.
- An ERC-4626 token is traversed when a supported adapter can resolve it.
- LP tokens, liquid staking tokens, bridge receipts, and other wrappers require dedicated adapters.
- An unsupported wrapper becomes an opaque unresolved node, not a verified terminal asset.
- A stablecoin can be a terminal token exposure, but this does not verify the issuer's reserves.
- A lending receivable is not equivalent to idle custody of its accounting asset.

The README and `SCOPE.md` must state this policy precisely.

## 11. Effective collateral multiple

The headline metric needs a published methodology before implementation.

Proposed definition:

```text
Effective collateral multiple =
  aggregate attributed claim value across included economic vault layers
  / independently supported terminal backing value
```

The methodology must define:

- Which economic layers count as claims.
- How account ownership is attributed at each layer.
- How shared nodes are deduplicated.
- How debt and negative exposures are handled.
- Which valuation source and reference block are used.
- How mixed terminal assets are converted to a common unit.
- How incomplete or circular graphs affect eligibility.
- How rounding and reconciliation tolerances work.

Important limitations:

- Multiple layers can increase counted claims without proving economic leverage.
- A detected cycle does not automatically yield a finite multiple.
- A cycle can make ownership equations singular or unsupported.
- Mixed-asset ratios require block-aligned, provenance-carrying prices.
- If complete and reconciled backing cannot be established, the metric is unavailable.

The first release should report circular paths and withhold affected aggregate metrics. Solving sufficiently specified cyclic ownership systems can be a later feature.

## 12. Source health and coverage

Source health is part of every response.

Health checks should use:

- A hard timeout.
- A short cache TTL.
- Latest indexed block.
- Chain head comparison.
- Schema validation.
- Detection of indexing and partial GraphQL errors.
- Last successful query time.

Suggested states:

- `healthy`
- `lagging`
- `degraded`
- `unreachable`
- `schema_mismatch`
- `unsupported_block`

Coverage should describe:

- Discovered positions versus successfully inspected positions.
- Resolved branches versus unresolved branches.
- Verified terminal amount versus unverified terminal amount when a valid denominator exists.
- Source coverage per protocol and network.

Do not manufacture a value-weighted percentage when the value of missing branches is unknown. In that case, report structural coverage and explicitly state that value coverage cannot be computed.

"No supported positions found" must remain distinct from "the account has no positions."

## 13. Independent verification

The verification script should compare Graph-derived results with independently reconstructed RPC data at the same block.

It should print:

- Chain, block number, and block hash.
- Root account and position.
- Graph-derived amount.
- RPC-derived amount.
- Raw units and display units.
- Absolute and relative difference.
- Allowed tolerance and its rationale.
- Evidence calls or stable references.
- Final verification state.

A user's attributed exposure is not normally equal to the entire vault's token balance. Lending strategies can hold value as receivables rather than idle tokens.

Verification therefore depends on the terminal type:

- Custody-only strategy: verify the relevant custody balance and ownership fraction.
- Nested ERC-4626 strategy: verify shares, supply, conversion, and ownership attribution.
- Lending strategy: reconcile supported supply and debt accounting using the protocol's onchain state.
- Mixed strategy: verify each component separately and preserve unresolved components.

Agreement between a subgraph and the vault's own reported value is useful reconciliation, but it is not necessarily proof of external asset backing.

## 14. Testing strategy

### 14.1 Resolver unit tests

- Single-layer control producing exactly `1.0x` under documented assumptions.
- Three-or-more-layer nested path.
- Self-cycle.
- Multi-node cycle.
- Shared descendant without a cycle.
- Depth limit.
- Node limit.
- Per-source timeout.
- Unsupported wrapper.
- Dead source.
- Partial GraphQL response.
- Schema drift.
- Block mismatch.
- Zero total supply.
- Zero account balance.
- Mixed token decimals.
- Rounding at every hop.
- Duplicate events and duplicate edges.
- Source disagreement.
- Metric suppression for incomplete input.
- Metric suppression for unsupported cycle accounting.

### 14.2 Property tests

- Traversal always terminates within its budgets.
- Terminal attribution does not exceed the supported ownership being distributed, within rounding rules.
- Reordering independent branches does not change aggregated exposure.
- Duplicating an identical observation does not double the result.
- A complete result has no unresolved branch.
- A partial result cannot be converted into metric-eligible input.

### 14.3 Integration tests

- Graph query validation against recorded schema-compatible responses.
- Block-pinned RPC reconstruction.
- Adapter selection and fallback behavior.
- Cache invalidation by block and configuration change.
- MCP tool input and output validation.
- Receipt serialization and re-validation.

### 14.4 Live verification

Keep deterministic tests in regular CI. Run live checks in a separate credentialed job so source outages are reported as availability failures rather than silently converted into passing tests.

## 15. Required demo runs

The final repository should provide one command that runs each case and emits a versioned receipt.

| Run | Expected result |
| --- | --- |
| Deep live position | Three or more verified economic layers and supported terminal exposure |
| Control | Exactly `1.0x` under documented assumptions, with no cycle |
| Degraded | Partial result, visible missing coverage, and suppressed aggregate |
| Cycle | Real verified cycle if found; otherwise a clearly labeled testnet or deterministic fixture |

The deep verified case and cycle case should be allowed to use different fixtures. Requiring one real position to be both deeply nested, cyclic, fully resolvable, and eligible for a finite multiple may be infeasible or methodologically unsound.

## 16. Monitoring layer

The monitoring service should build a reverse dependency index from each observed vault, adapter, oracle, and risk parameter to the tracked root positions affected by it.

Flow:

1. Subscribe to supported Substreams outputs.
2. Decode normalized parameter or allocation changes.
3. Save block-scoped changes and cursor atomically.
4. Identify affected root positions using the reverse dependency graph.
5. Invalidate block-specific caches.
6. Re-resolve affected positions at a consistent block.
7. Compare the new receipt with the previous receipt.
8. Emit a provisional or finalized finding according to block finality.

### 16.1 Reorg handling

- Persist the Substreams cursor.
- Persist reversible changes for non-final blocks.
- On `BlockUndoSignal`, rewind to the last valid block.
- Retract provisional alerts created by orphaned blocks.
- Never treat an undo signal as a parameter-change trigger.
- Remove rollback data only after the corresponding block is finalized.
- Deduplicate replays using chain, block hash, transaction hash, log index, and normalized event type.

### 16.2 Monitoring scope

Each protocol adapter must declare the parameters and event families it can monitor. Tare should never imply that it detects all forms of risk changes merely because it consumes a real-time stream.

## 17. MCP and natural-language interface

Initial reusable tools:

- `resolve_position`
- `resolve_account`
- `explain_dependency`
- `compare_positions`
- `get_source_health`
- `export_evidence`
- `verify_resolution`

Monitoring tools added later:

- `track_position`
- `list_tracked_positions`
- `get_resolution_diff`
- `get_recent_findings`
- `simulate_leaf_shock`

The language model may select tools, summarize findings, compare evidence, and explain limitations. All financial amounts, graph traversal, eligibility decisions, and metrics must be produced by deterministic code.

If The Graph's Subgraph MCP is used, document it as a distinct Graph product. Tare's own MCP server is an application interface and does not by itself count as use of The Graph's Subgraph MCP.

## 18. Web explorer

Primary flow:

```text
Enter account or position
  -> discover positions
  -> resolve exposure graph
  -> inspect terminal assets and shared dependencies
  -> inspect source health and verification
  -> export a shareable receipt
```

Main screen:

- Address, network, and block selector.
- Account position summary.
- Layered exposure graph with attributed amounts on edges.
- Terminal exposure summary.
- Effective multiple and methodology link when available.
- Visible incomplete-coverage state when unavailable.
- Source health panel.
- Node detail drawer with addresses, blocks, raw amounts, and evidence.
- Highlighted cycle paths.
- Export actions for JSON and a human-readable artifact.

The UI must never substitute `0`, `1.0x`, or placeholder values for unavailable calculations.

## 19. Creative features backed by resolved data

Build these in priority order after the resolver works:

| Feature | Product value | Verification method |
| --- | --- | --- |
| Resolution receipt | Portable evidence for judges and risk teams | Versioned JSON plus rendered report |
| Position comparison | Reveals shared downstream dependencies | Intersection and difference of resolved graphs |
| Resolution diff | Shows allocation and dependency changes | Compare two block-specific receipts |
| Blast-radius query | Finds indexed positions affected by a dependency | Reverse traversal within the declared indexed universe |
| Depeg scenario | Estimates direct mark-to-market sensitivity | Explicit price shock applied to resolved exposures |
| Cycle report | Presents circular paths as discoveries | Address and evidence list for every edge |

A depeg scenario must state that it is a direct sensitivity calculation. It must not claim to predict liquidation cascades, liquidity effects, or nonlinear market behavior unless those models and inputs are implemented and verified.

## 20. Sponsor strategy

### 20.1 The Graph — essential

Target:

- Best Use of Composable or Standardized Graph Products.
- Best AI Tooling or AI Use Case with The Graph, From Scratch.

Implementation evidence:

- Live queries through a Graph provider.
- A shared normalization schema across more than one deployment.
- Clear explanation of what standardization makes reusable.
- Composition of Subgraphs, Substreams, and optionally Subgraph MCP.
- MCP tools performing meaningful deterministic analysis.
- Public source, reproducible README or SKILL, and demo video.

The Graph pools are each valued at `$5,000`, with the total divided between placements. They should not be described as guaranteed `$5,000` awards for one project.

### 20.2 Bazantic — optional after the API stabilizes

Required work:

- Create the project gateway on Bazantic.
- Expose a stable Tare resolution or blast-radius endpoint.
- Combine it with at least one qualifying sponsor service.
- Create a recipe whose final answer depends meaningfully on both services.
- Record the complete workflow.

Possible recipe:

1. Tare resolves a wallet's verified terminal exposures.
2. A qualifying price or market service supplies current scenario inputs.
3. The recipe ranks positions by direct sensitivity and evidence coverage.

The external service must contribute material data or behavior; it cannot be decorative.

### 20.3 Chainlink CRE — cuttable

Test access during the first 48 hours because Confidential Workflows are documented as private beta.

If accessible, implement:

- A confidential threshold and unwind policy fetched or supplied inside the TEE.
- `handlerInTee` in the TypeScript CRE workflow.
- A complete, fresh, verified Tare result as workflow input.
- Confidential threshold evaluation and bounded action sizing inside the enclave.
- A testnet state change or an accepted CRE simulation, depending on the selected prize.
- Terminal logs and video evidence.

The workflow must refuse action when coverage is partial, evidence is stale, the graph contains unsupported cycles, or the result is otherwise ineligible.

No mainnet write is needed. Mainnet provides the live read data; testnet provides safe action evidence.

## 21. Schedule to the September 16 deadline

| Dates | Deliverable | Exit condition |
| --- | --- | --- |
| Sept 6–7 | Source audit, fixture discovery, accounting specification | One viable live Graph-to-RPC path and selected scope |
| Sept 8–9 | Normalized indexing and first resolver | A real nested position resolves; second deployment is underway |
| Sept 10–11 | Attribution, cycles, partial states, verification | Deep case and negative tests pass |
| Sept 12 | Explorer, receipts, and MCP tools | Complete result is inspectable and exportable |
| Sept 13 | Monitoring | Reorg, restart, and replay tests pass |
| Sept 14 | Bazantic; CRE only if core is stable | Working end-to-end sponsor evidence |
| Sept 15 | Feature freeze, clean-install rehearsal, and video | Reproducible submission package |
| Sept 16 | Final checks and submission buffer | Repository, evidence, video, and instructions ready |

Kill criterion: if a real three-layer position is not resolving by the end of September 11, cut monitoring and automated action. Ship the resolver, verification, minimal explorer, receipts, and reusable tools.

## 22. Continuous documentation

Create and maintain these files from the first implementation day:

### `FIELD_NOTES.md`

For every tooling or network problem, record:

- Date.
- Network and address.
- Tool or endpoint.
- Exact error.
- Expected behavior.
- Actual behavior.
- Working path or workaround.
- Relevant issue or documentation link.

### `SCOPE.md`

Record precise exclusions such as:

- Non-ERC-4626 wrapper types are unresolved unless a dedicated adapter exists.
- Unsupported wrappers are marked as opaque nodes.
- Cross-chain backing is not traversed in the first release.
- Account discovery covers only registered and healthy source deployments.
- Stablecoin token exposure does not verify issuer reserves.
- General cyclic ownership systems are not valued in the first release.
- Mainnet automated execution is outside the hackathon scope.

If a claim is later found to be overstated, strike it through and replace it with the corrected statement rather than erasing the history.

### Additional documentation

- `ACCOUNTING.md`: metric definition, attribution, valuation, and rounding.
- `DATA_SOURCES.md`: live endpoints, schema versions, health, and coverage.
- `FIXTURES.md`: real and synthetic demo fixtures.
- `ARCHITECTURE.md`: component and data-flow diagrams.
- `SUBMISSION.md`: sponsor mapping and demo evidence.

## 23. Commit and release discipline

- Commit each meaningful milestone with a descriptive message.
- Avoid a single final-day commit.
- Keep generated evidence separate from source code.
- Pin dependencies and document required runtime versions.
- Provide `.env.example` without secrets.
- Provide one clean setup command and one command per demo case.
- Test setup from a fresh clone before recording the video.
- Tag the exact submission commit.

Suggested early commits:

1. `docs: define tare scope and accounting questions`
2. `chore: initialize strict typescript workspace`
3. `feat: add validated graph and rpc source clients`
4. `feat: define exposure graph and partial resolution types`
5. `feat: resolve generic erc4626 positions`
6. `feat: add first protocol allocation adapter`
7. `test: cover cycles precision and degraded sources`
8. `feat: verify live position against block-pinned rpc`

## 24. Final submission checklist

### Product

- [ ] Real wallet or position resolves from live data.
- [ ] Actual allocations are distinguished from accounting assets.
- [ ] Terminal exposures include provenance.
- [ ] Partial results remain explicit.
- [ ] Cycle detection terminates and produces evidence.
- [ ] The multiple is only shown when eligible.
- [ ] Source health is visible.

### Verification

- [ ] Deep live fixture passes.
- [ ] `1.0x` control passes.
- [ ] Degraded source case passes.
- [ ] Cycle case passes.
- [ ] Graph and RPC values are printed side by side.
- [ ] Block numbers and hashes are recorded.
- [ ] Negative and property tests pass.

### The Graph

- [ ] Live Graph provider evidence is captured.
- [ ] Standardization or composition is clearly demonstrated.
- [ ] AI tools do more than print queries.
- [ ] README or SKILL explains installation and use.
- [ ] Public repository is available.
- [ ] Two-to-four-minute video is available.

### Optional integrations

- [ ] Substreams reorg and cursor behavior is demonstrated.
- [ ] Bazantic workflow uses both services materially.
- [ ] Chainlink TEE handler processes a real private parameter.
- [ ] CRE simulation or deployment evidence is included.

### Documentation

- [ ] README is complete.
- [ ] `FIELD_NOTES.md` is current.
- [ ] `SCOPE.md` is current.
- [ ] Accounting methodology is published.
- [ ] Source registry and fixture manifests are published.
- [ ] Architecture diagram is included.
- [ ] Demo commands work from a clean clone.

## 25. Key technical decisions

1. Model the system as a provenance-carrying directed graph.
2. Distinguish accounting assets, actual allocations, and risk dependencies.
3. Use protocol adapters for capital allocation details not standardized by ERC-4626.
4. Make partial, complete, verified, and metric-eligible states distinct in the type system.
5. Use block-pinned integer accounting and preserve per-hop rounding.
6. Treat source health and coverage as user-visible output.
7. Report cycles as findings while withholding unsupported aggregate values.
8. Keep all calculations deterministic; use AI only to select tools and explain evidence.
9. Read real mainnet data and restrict any writes to testnet.
10. Protect resolver and verification work before adding sponsor-specific features.

## 26. Research references

- [ERC-4626 specification](https://eips.ethereum.org/EIPS/eip-4626)
- [The Graph standardized subgraphs](https://thegraph.com/docs/en/subgraphs/existing-subgraphs/standard-subgraphs/)
- [ETHOnline 2026 — The Graph prizes](https://ethglobal.com/events/ethonline2026/prizes/the-graph)
- [The Graph Subgraph MCP](https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/introduction/)
- [Messari standardized subgraphs repository](https://github.com/messari/subgraphs)
- [Morpho vault data documentation](https://docs.morpho.org/developers/api/morpho-vaults/)
- [Morpho Vault V2 documentation](https://docs.morpho.org/learn/concepts/vault-v2/)
- [Morpho Vault V2 repository](https://github.com/morpho-org/vault-v2)
- [Yearn V3 vault technical specification](https://github.com/yearn/yearn-vaults-v3/blob/master/TECH_SPEC.md)
- [Yearn tokenized strategy specification](https://github.com/yearn/tokenized-strategy/blob/master/SPECIFICATION.md)
- [Euler subgraph documentation](https://docs.euler.finance/build/data-querying/subgraphs/)
- [Euler vault documentation](https://docs.euler.finance/learn/vaults/)
- [Substreams reliability guarantees](https://docs.substreams.dev/reference-material/core-concepts/reliability-guarantees)
- [Chainlink Confidential Workflows](https://docs.chain.link/cre/guides/workflow/using-confidential-workflows)
- [ETHOnline 2026 — Chainlink prizes](https://ethglobal.com/events/ethonline2026/prizes/chainlink)
- [ETHOnline 2026 — complete prize page](https://ethglobal.com/events/ethonline2026/prizes)

## 27. Immediate next milestone

The first milestone is one real account position with:

- A live Graph-sourced root position.
- An inspectable, multi-layer allocation path.
- Block-pinned share and allocation amounts.
- Supported terminal exposure.
- Independent RPC reconstruction.
- A versioned evidence receipt.
- A clear explanation of which claims the evidence supports.

Once this milestone works, the explorer, comparison tools, monitoring, and sponsor integrations have trustworthy data to build on.

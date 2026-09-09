# Phase two — evidence model and offline adapters

Phase two implements the evidence/accounting and adapter milestones proposed after
the initial CLI review. It adds no live vault integration. The existing opt-in native
wallet-balance command remains separate. Core implementation stays in TypeScript.

## Delivered

- Schema 2 identifies ERC-20 assets by chain and normalized contract address.
  An address has one observation/classification per snapshot.
  Risk targets use contract identities rather than claiming that oracles/managers
  are ERC-20 assets.
- A single owner's portfolio supports multiple root positions. Duplicate roots
  are rejected; separate direct and indirect share holdings can coexist.
- Nodes, positions and relationships reference source, chain, block number/hash,
  timestamp and origin evidence. Missing references reject the input.
- Holding, debt, accounting-asset and risk-dependency relationships are distinct.
  Only holdings contribute quantities. Positive or unobserved debt prevents
  attribution of that vault's gross holdings as owner exposure.
- `ExposureAdapter` normalizes recorded responses before traversal. The supplied
  `fixture-holdings-v1` adapter is a proportional fixture model, not a production
  ERC-4626, Morpho, Yearn or other protocol implementation.
- Unsupported adapters and schema drift become opaque observations with findings.
  Invalid envelope/reference structure rejects input; adapter programming errors
  propagate rather than masquerading as source outages.
- Receipts retain rounding, evidence and dependencies, plus a SHA-256 digest of the
  parsed normalized snapshot. Digests identify inputs; they do not establish truth.
- Complete/partial, unverified and metric-ineligible states remain distinct.
- Depth, visit and edge budgets bound traversal. Cumulative shares attributed
  across all paths cannot exceed a vault's supply. Contradictions clear aggregate
  leaves and produce partial results.
- Version-one commands, snapshots and receipt output remain compatible. Abstract
  legacy fixture IDs are never silently assigned invented contract addresses.

## Commands

```sh
pnpm build
pnpm demo:phase2
pnpm cli replay fixtures/recordings/multi-asset.json --json
pnpm cli snapshot normalize fixtures/recordings/overlap.json --out overlap.json
pnpm cli snapshot validate overlap.json
pnpm cli resolve overlap.json --json --out overlap-receipt.json
pnpm cli replay fixtures/recordings/debt.json --json
```

Debt replay exits 2 for a partial result. `demo phase2` exits 0 when all six cases
match their expected states. `replay` accepts wallet, output, depth, visit and edge
options like version-two `resolve`. `--max-edges` applies only to version two.
Exports refuse overwrite. No wallet configuration is required; `--wallet` checks
owner/chain and does not prove ownership or discover balances.

## Acceptance

`pnpm verify` builds, runs all regression/integration tests, and runs both demo sets.
Phase-two checks cover identities, same-symbol assets, mixed decimals, overlapping
positions, duplicate inputs, ownership contradictions, debt, schema drift, evidence
alignment, all budgets, cycles, conservation, order independence, receipt validation
and CLI replay/export. Source recordings are authored synthetic vectors, not live
captures. RPC tests still use a local mock server.

## Completion and next phase

Phase two's acceptance cases are complete and remain in the regression suite.
[Phase three](PHASE_3.md) adds a separate live protocol path, actual conversion
rules, block-aligned RPC observations and measured health. It preserves the
synthetic schemas instead of relabeling their provenance. Independent backing
verification and valuation are phase-four work; numerical metrics, monitoring,
MCP, API and web remain deferred.

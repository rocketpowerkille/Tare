# Phase four — indexed evidence and verification (in progress)

Phase three is closed against its documented Ethereum USDC MetaMorpho V1 scope.
Its 50-test baseline and 12-market capture replay were rechecked before starting
this work. Phase four has now started; it is **not complete**.

## First increment delivered

1. `graph/subgraph/` contains a Tare-owned share ledger for the public Ethereum
   Steakhouse USDC vault. It reconstructs share supply and account balances from
   ERC-20 Transfer events, including fee mints, burns and ordinary transfers.
   It records event identity and block provenance. This is a small custom schema,
   not a claim to have implemented The Graph's standardized Subgraph products.
2. The subgraph manifest, ABI and AssemblyScript mapping generate types and build
   to WASM successfully with pinned Graph tooling. Dependencies and build output
   are isolated from the TypeScript CLI; Rust is not needed.
3. `packages/sources/src/the-graph.ts` queries Tare's schema at a requested block.
   It retains `_meta` deployment, block number/hash and indexing-error status.
   GraphQL partial-with-errors responses and unexpected schemas are rejected.
   Optional `GRAPH_API_KEY` authentication uses an HTTP header and is excluded
   from receipts and provider error messages.
4. `packages/verification/src/shares.ts` compares Graph and fresh RPC evidence for
   asset identity, share decimals, total share supply and owner share balance.
   Every RPC contract read uses the same canonical block hash, followed by a final
   confirmation. Graph block mismatch, indexing errors, wrong identity, optional
   deployment mismatch, missing entities or malformed evidence prevent agreement.
5. `verify shares` exports the comparison and evidence; `verify replay` recomputes
   it offline. Schema validation recalculates checks and status from captured
   evidence, rejecting a changed digest or fabricated report fields.

Morpho's [current developer documentation](https://docs.morpho.org/developers/)
marks its former Subgraphs deprecated and unsupported. Rather than assume those
deployments remain current, this increment supplies our own narrowly scoped
indexer. The existing Morpho API remains phase-three discovery-only.

The user chose **build and test now, configure deployment later**. Nothing has
been deployed or published. No live Graph/RPC acceptance result is claimed.

## Local verification

```sh
pnpm install --frozen-lockfile
node --run verify
npm ci --prefix graph/subgraph --ignore-scripts --no-audit --no-fund
node --run build:subgraph
```

The root suite has 61 tests, ten synthetic demo cases and the retained real RPC
capture replay. New tests exercise Graph/RPC comparison using a local HTTP server,
exact quantity mismatches, block/deployment/identity checks, missing entities,
reorgs, source errors, credential redaction, exports and replay. Mapping tests
execute the actual handler source with a small Graph host double. The WASM build
is checked separately. These are not Graph Node indexing or hosted deployment
tests, and they do not demonstrate live independent verification.

## Commands after deployment is configured

Use an endpoint implementing **tare-share-ledger-v1**, not Morpho's public API or
an arbitrary existing Subgraph. Set `TARE_GRAPH_URL`, `TARE_RPC_URL` and, where
required, `GRAPH_API_KEY` in your shell. Set `TARE_GRAPH_DEPLOYMENT` to the expected
manifest CID to pin the deployed schema/mapping. `.env` is not automatically read.

```sh
pnpm cli verify shares --address 0x334f5d28a71432f8fc21c7b2b6f5dbbcd8b32a7b --vault 0xbeef01735c132ada46aa9aa4c54623caa92a64cb --block-number 25937756 --out share-check.json
pnpm cli verify replay share-check.json --json
```

Flags `--graph-url`, `--rpc-url` and `--graph-deployment` override the corresponding
environment variables. `--timeout-ms` bounds each request. Without `--block-number`
the RPC chooses latest; a lagging index may then fail the comparison. Explicitly
select an indexed block for acceptance. The supplied endpoint must retain that
historical state; the subgraph manifest disables pruning for this reason.

Exit 0 means four share-ledger fields matched at a confirmed block. Exit 2 means
a numerical mismatch or incomplete evidence. Exit 1 means invalid configuration,
invalid input file or export failure. Output files never overwrite existing files.
An absent indexed account remains unknown; it is not automatically assigned zero.

## Phase-four completion checklist

- [x] Build a local subgraph and a bounded Graph client with block/deployment checks.
- [x] Implement deterministic share-ledger comparison, receipts and replay.
- [ ] Configure deployment, index full history and retain a real Graph/RPC result.
- [ ] Validate indexing/reorg behavior in Graph Node, beyond the local host double.
- [ ] Extend indexed observations and comparisons to protocol allocations and
  underlying accounting; share agreement alone does not cover these quantities.
- [ ] Connect supported live adapters into recursive traversal and resolve a real
  position spanning at least three economic layers. Collateral references must
  not be treated as assets the vault owns merely to add depth.
- [ ] Define independent backing and debt treatment, including lending claims,
  liquidity limitations, unsupported wrappers and shared backing.
- [ ] Add timestamped valuation and metric eligibility, including a supported 1x
  control and explicit mismatch/partial cases. Keep the metric unavailable until
  all required backing and valuation evidence is present.
- [ ] Deliver the broader standardized indexing/multiple-network milestone if
  retained for the submission; this single-vault Ethereum index does not satisfy it.

The new report explicitly says `share-ledger-cross-check-only`. Agreement can
detect implementation/source discrepancies; it does not prove source independence,
deployment authenticity, collateral value, USDC reserves or solvency. The numerical
collateral multiple remains unavailable. API/MCP/Bazantic remain phase five,
monitoring phase six, and optional execution phase seven.

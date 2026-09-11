# Field notes

## 2026-09-11 — hosted Graph deployment preparation

- Reconfirmed that hosted Graph deployment remains the first unfinished external
  acceptance gate; no deployment or credential use was performed.
- The share-ledger manifest previously started at Ethereum genesis. Morpho's V1
  vault directory and Etherscan both identify Steakhouse USDC creation block
  `18928285`, so the manifest and `indexedFromBlock` now begin there while retaining
  complete share-transfer history.
- A historical `eth_getCode` confirmation through the credential-free PublicNode
  endpoint was attempted for blocks `18928284` and `18928285`; the provider rejected
  both archive reads and requested a personal token. This is recorded as a provider
  limitation, not treated as confirmation.
- The local Anvil/Graph Node harness rewrites both mainnet start-block fields to its
  fixture deployment block, preserving isolated rollback acceptance.
- The Docker Graph/Postgres/IPFS/Anvil stack started successfully, but the pinned
  Foundry container twice failed to resolve `binaries.soliditylang.org` while
  fetching the Solidity compiler. The isolated stack and its volumes were removed.
  Subgraph code generation/build passed; the full rollback harness still needs a
  rerun after Docker DNS or the compiler cache is available.

## Phase-three closeout and phase-four indexing increment

- Revalidated the phase-three baseline: 50 tests, ten synthetic demos and the
  real 12-market capture replay pass. No phase-three acceptance gap was found.
- Current Morpho documentation deprecates its old Subgraphs. Added a small
  Tare-owned event-derived share ledger instead of assuming the old index is live.
- The user explicitly chose local build/test and deployment configuration later.
  No Graph Studio deployment, live Graph result or sponsor completion is claimed.
- Graph CLI 0.98.1 and graph-ts 0.38.2 are pinned in an isolated npm package.
  Type generation and the AssemblyScript WASM build pass locally on Windows.
  Root runtime dependencies are unchanged; root tests use existing TypeScript.
- Added Graph block/deployment/error checks, optional header authentication and
  exact same-block share comparison with export/replay. Agreement remains scoped
  to the share ledger and cannot enable backing verification or a numerical metric.
- Validation now includes 61 tests. Mapping logic uses a Graph host double;
  actual Graph Node indexing/rollback and live acceptance remain phase-four work.
  CI now includes the subgraph build on Linux and Windows; remote CI was not run.

## Phase-three public-source implementation

- Phase-two acceptance was revalidated as part of the complete suite. Its 35
  existing tests and ten synthetic demos still pass.
- Added a separate schema-three RPC capture/receipt path and Ethereum USDC
  MetaMorpho V1/Morpho Blue V1 adapter, using the public Morpho GraphQL API for
  discovery. This is not a The Graph sponsor integration.
- The user selected a public example; no personal wallet profile was configured
  or modified and no signing, transaction or deployment was performed.
- Saved the real public capture in `fixtures/live`. At block 25937756, all 12
  allocation markets reconciled to the vault's total assets and the fee-adjusted
  account conversion matched its contract view. Five raw USDC units remained
  unattributed from flooring. This is accounting evidence, not a backing audit.
- Repeated the read through the built CLI at the same block; its local export is
  `receipts/phase3-live-cli.json` (ignored by Git). It reproduced the 12 markets,
  total assets, conversion and rounding, with 73 successful RPC requests.
- Hardened the existing native-balance HTTP path with streamed byte limits and
  sanitized provider errors. Added tests for reorgs, outages, invalid responses,
  capture consistency, budgets, CLI exports and deterministic live replay.
- Failure testing caught and fixed early receipt finalization when a concurrent
  read failed before other reads settled.
- Final validation: strict compilation, **50 tests**, ten synthetic demos and
  real-capture replay pass via `node --run verify`. Public live CLI validation
  also passed. Remote CI was not run; no dependencies were added.

## 2026-09-09 — phase two

- Baseline: 18 tests and all four legacy demos passed before implementation.
- No new dependencies or live endpoints were required.
- Schema 2 lives alongside schema 1; legacy IDs are not migrated into invented
  contract identities.
- The earlier receipts ignore issue was already fixed: `/receipts/` ignores root
  exports while `packages/receipts/` remains tracked.
- Restored scope and field-notes documents referenced by the README.
- New adapter recordings are explicitly synthetic; no real protocol recording was
  available within this phase. None of their addresses or block data are live claims.
- No real wallet profile was created or changed. Tests use temporary public-address
  profiles only.
- Final local validation: strict TypeScript build, 35 tests and all 10 demo cases
  pass. CI uses the same verify script; remote CI was not run in this task.

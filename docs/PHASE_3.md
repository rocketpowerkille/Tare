# Phase three — live discovery and a protocol adapter

Phase three delivers a read-only CLI path for **Ethereum USDC MetaMorpho V1 vaults
allocating to Morpho Blue V1**. Its explicit resolution scope is the vault's loan
receivables in the withdrawal queue. This is one supported production protocol
family, not generic support for every vault, chain or recursively nested asset.

## Delivered and acceptance evidence

- Public Morpho GraphQL position discovery with pagination, identity checks,
  truncation findings and observed source health. Indexed absence is scoped to
  that index; it is never proof that a wallet owns no other positions.
- An Ethereum RPC reader checks chain identity, selects a block and uses
  EIP-1898 block-hash calls with `requireCanonical: true` for every contract read.
  It rechecks the block before finalizing. A changed or unconfirmed block clears
  attributed amounts.
- The adapter reads the vault's share balance, supply, accounting assets,
  performance fee, virtual shares, withdrawal queue and market positions. It
  reconstructs accrued interest and market fee shares, sums allocation assets,
  and checks the account's fee-adjusted conversion against `convertToAssets`.
- Loan receivables carry separate collateral, oracle, interest-rate-model and
  LLTV dependencies. Those references do not create ownership or backing value.
- Version-three receipts retain successful and failed calls, block context,
  measured health, findings, a capture digest, accounting and rounding. Captures
  replay through the same adapter without network access; replay is labeled
  `recorded-rpc`, never a fresh observation.
- Timeouts, response-size limits, a request/deadline budget and a market limit
  bound work. RPC/GraphQL errors and schema drift cannot silently produce a
  complete result. Read batches settle before evidence is finalized.
- CLI discovery, explicit resolution, public-example selection and replay work
  without signing or configuring a personal wallet. Existing watch-only profiles
  can select an owner and must match Ethereum mainnet.

The saved [public capture](../fixtures/live/steakhouse-usdc.capture.json) and
[receipt](../fixtures/live/steakhouse-usdc.receipt.json) cover Steakhouse USDC at
Ethereum block **25937756**. All **12 of 12 markets** resolved. Reconstructed total
assets equal the vault view (`67626448434968` raw USDC); the fee-adjusted account
conversion equals `28728443339809` raw USDC. Five raw units remain unattributed
from allocation rounding. See [capture provenance](../fixtures/live/README.md).

Acceptance is reproducible with `pnpm verify`: strict compilation, the legacy
and phase-two regressions, live-client tests using a local HTTP server, all ten
synthetic demos, and replay of the real capture. Normal CI needs no provider key
or external network. The public source test was also executed separately; live
availability and state are not assumed stable by CI.

## Run

```sh
pnpm build
pnpm demo:phase3
pnpm cli live replay fixtures/live/steakhouse-usdc.capture.json --json
pnpm cli live discover --vault 0xbeef01735c132ada46aa9aa4c54623caa92a64cb --max-positions 5 --json
pnpm cli live example --rpc-url https://ethereum-rpc.publicnode.com
pnpm cli live resolve --address 0x334f5d28a71432f8fc21c7b2b6f5dbbcd8b32a7b --vault 0xbeef01735c132ada46aa9aa4c54623caa92a64cb --rpc-url https://ethereum-rpc.publicnode.com --out live-receipt.json --capture-out live-capture.json
```

The example command chooses a depositor from the public index. `live resolve`
accepts `--wallet metamask` instead of `--address` after configuring that public
profile. `TARE_RPC_URL` replaces `--rpc-url`; `.env` is not automatically loaded.
No MetaMask password, private key, seed phrase or signature is needed.

Optional source flags: `--graphql-url`, `--timeout-ms` (100–60000),
`--block-number` (unsigned decimal), `--max-markets` (1–64), `--max-calls`
(1–1000), and `--deadline-ms` (100–300000). Defaults are 10 seconds per request,
32 markets, 250 RPC requests and a 120-second RPC deadline. Discovery has its own
bounded pagination (`--max-positions`, 1–500); it is not block-aligned. The RPC
deadline does not include the separate example-selection discovery request.
An RPC endpoint must support the selected historical state and EIP-1898 calls.

Exports refuse overwrite and parent directories must exist. Exit codes are 0
for complete scoped resolution, 1 for invalid input/export/discovery failure,
and 2 for a partial receipt or truncated discovery. Selecting five public
holders is intentionally truncated discovery; resolving the chosen position
can still be complete within its separate allocation scope.

## Completion boundary and phase four

Phase-three acceptance was rechecked before moving forward: all 50 existing tests,
the ten synthetic demos and the real 12-market capture replay passed. The phase
is closed within its stated protocol scope. [Phase four](PHASE_4.md) has started
with a local subgraph and share-ledger comparison; deployment is deferred.

Morpho's public **GraphQL API is not The Graph**. Phase three claims no The Graph
gateway, Subgraph, Substreams integration or sponsor-specific milestone. Those
are separate from its delivered scope; phase-four progress is tracked separately.

Reconciliation uses views and storage exposed by the same RPC provider. It
checks the adapter's accounting but does not independently verify that provider,
USDC reserves, collateral quality, redemption liquidity or solvency. A USDC
denomination is not a USD price. Unsupported protocols, MetaMorpho V2, non-USDC
vaults, other chains and recursive collateral/wrapper decomposition remain
outside this adapter. Direct token donations are outside MetaMorpho's queue-based
`totalAssets` accounting. The adapter is intended for conforming MetaMorpho V1
contracts; bytecode/deployment authenticity is not independently attested.

Phase four should add independent block-aligned evidence, explicit cash versus
loan/backing treatment, supported dependency decomposition, valuation and metric
eligibility rules. All current receipts intentionally keep verification pending
and the effective collateral multiple unavailable. Do not equate completion of
this declared scope with completion of a wallet's entire economic exposure graph.

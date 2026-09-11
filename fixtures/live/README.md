# Real public RPC captures

Unlike `fixtures/synthetic` and `fixtures/recordings`, the JSON files in this
directory were acquired from public sources. They are retained observations,
not synthetic vectors or independent attestations.

## Steakhouse USDC V1

- Discovery and vault metadata: <https://api.morpho.org/graphql>
- RPC: <https://ethereum-rpc.publicnode.com>
- Chain: Ethereum mainnet, ID 1
- Vault: `0xbeef01735c132ada46aa9aa4c54623caa92a64cb` (Steakhouse USDC)
- Public example owner: `0x334f5d28a71432f8fc21c7b2b6f5dbbcd8b32a7b`
- Block: `25937756` (`0x18bc75c`)
- Block hash: `0x2ae5e57c83314a354143af0b2e3d7ebed083888131fb8ecbd56152d97f0b1dca`
- Provider-reported block timestamp: `0x6aa0eff7`

`steakhouse-usdc.capture.json` includes the exact successful static call results,
call timestamps, pinned block, confirmation status, metadata, discovery and
acquisition health. Machine acquisition times and the chain timestamp are
different fields and are preserved as observed. They are not independently
validated wall-clock assertions. Endpoint credentials are never retained.

`steakhouse-usdc.receipt.json` is the initial live result. Replaying the capture
produces the same accounting, with `sourceMode: recorded-rpc`. The capture digest
hashes `JSON.stringify(CaptureSchema.parse(input))`; it identifies normalized
evidence, preserves array order and does not attest to its truth.

Expected accounting at this block:

| Quantity | Raw integer |
| --- | --- |
| Account vault shares | 25214434140816810935371051 |
| Vault total supply | 59354478031005592537282559 |
| Vault total assets / sum of 12 market allocations | 67626448434968 |
| Accrued vault fee shares | 30324062525309225262 |
| Account `convertToAssets` quote | 28728443339809 |
| Unattributed quote units from per-market flooring | 5 |

The account quote is 28,728,443.339809 USDC-denominated lending claims. It is
neither a cash withdrawal guarantee nor independently verified collateral value.
Capture health records the 73 RPC requests and one metadata query. The separate
initial index lookup selected three public depositors and is intentionally
incomplete as an index enumeration.

Reproduce without network:

```sh
pnpm build
pnpm cli live replay fixtures/live/steakhouse-usdc.capture.json
```

To refresh, use `live resolve` with the owner and vault above and new output
filenames. Add `--block-number 25937756` to compare the historical state when the
RPC supports it. Never overwrite a retained capture and describe it as original.

Accounting and discovery references:

- [Morpho vault API](https://docs.morpho.org/developers/api/morpho-vaults/)
- [MetaMorpho accounting](https://github.com/morpho-org/metamorpho/blob/main/src/MetaMorpho.sol)
- [Expected market balances](https://github.com/morpho-org/morpho-blue/blob/main/src/libraries/periphery/MorphoBalancesLib.sol)
- [Integer interest math](https://github.com/morpho-org/morpho-blue/blob/main/src/libraries/MathLib.sol)

## OV USDC V2 nested capture

`ov-usdc-v2.capture.json` contains 96 successful block-pinned contract reads from
PublicNode, followed by block confirmation. Morpho's public API selected the
holder; all attribution uses RPC evidence, not unpinned API amounts.

- Root V2: `0x18032c694f8ebfdcc030cb8c54c3701a107c2f72` (OV USDC).
- Holder: `0xba3356e6a4eac76980067dbaa3758e5e5685cfb7`.
- V1 adapter: `0xec8bc344764091a4138abb7b64e5fd95aa6e40c6`.
- Child V1: Steakhouse USDC, the same address as above; 12 Blue markets.
- Block: 25940252, hash `0x99400a4a99db9af525edf7b1c30c8dfa1425ee98e9df8d29708d2ffbf65307f3`.
- Account quote: 17,464,608,156 raw USDC; unattributed rounding: 13 raw units.
- A second adapter has zero reported assets and is explicitly unexpanded.
- Chainlink USDC/USD proxy: `0x8fffffd4afb6115b954bd326cbe7b4ba576818f6`.
- Price: 99,988,513 at eight decimals, updated at 1788940835; block time 1788962159.
- Account quote valuation: 1,746,260,199,646 raw USD at eight decimals, with a
  rounding numerator of 112028 over 1,000,000. This prices a lending claim;
  it does not establish backing, reserves, or withdrawable cash.

```sh
tare live nested-replay fixtures/live/ov-usdc-v2.capture.json --json
```

## WETH native custody control

`weth-custody.capture.json` records two provider witnesses: PublicNode
(`ethereum-rpc.publicnode.com`) and MEV Blocker (`rpc.mevblocker.io`). Hostnames
are hashed into provider IDs; no URLs or query credentials are retained.

- Public example holder: Morpho Blue, `0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb`.
- Token/custodian: canonical WETH, `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2`.
- Block: 25940387, hash `0x68db55a5c26bebf3281cac55001c0bce30a2bf30d0482f840a1b39757e2bb07b`.
- Each provider supplies five contract reads, one native-balance observation,
  chain/block selection and final block confirmation.
- Chainlink ETH/USD proxy: `0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419`.

Replay produces **1.000000x for the WETH wrapper only**. It excludes the public
holder's own liabilities and beneficiaries, including Morpho's lending obligations.
Matching provider data does not prove provider independence or cryptographic state
authenticity. This result cannot be used as the Morpho portfolio's collateral metric.

```sh
tare verify custody-replay fixtures/live/weth-custody.capture.json --json
```

## Base Sepolia two-layer custody control

`base-sepolia-custody.capture.json` records the live pre-exit state of the
test-only two-layer ERC-4626 deployment from two differently hosted Base Sepolia
RPC providers. Provider URLs are represented by hashed IDs.

- Chain: Base Sepolia, ID 84532.
- Owner: `0xf1fea08ebba92ed342acc5639db312c3694bc391`.
- Outer vault: `0x60407bf755a379d530a5409ac3639ec4bbaa0bbe`.
- Inner vault: `0x09b7f07f10800064f7db6a262ecff344da0bd867`.
- Terminal asset: `0x8ee5f47e407006df298f45d0a4dae14d60cbde62`.
- Block: 46684889 (`0x2c85ad9`), hash
  `0x75e52d65d5061bdf0d4fc3780d7e19382036bc738620be1f44ddbd3f7e051877`.
- Each witness includes pinned code, asset links, balances, supplies, conversion
  previews and final block confirmation. Replay returns a recorded 2.000000x
  control and cannot authorize execution.

The bounded exit later consumed the owner's outer shares. This capture is retained
pre-exit evidence, not the current position. See
`deployments/base-sepolia-e2e.json` for the transaction and post-state acceptance.

```sh
pnpm cli verify base-custody-replay fixtures/live/base-sepolia-custody.capture.json --json
```

The Graph Node rollback result belongs in `fixtures/integration/`, clearly labeled
as a local Anvil test. It is not a mainnet Graph acceptance capture.
- [Virtual shares](https://github.com/morpho-org/morpho-blue/blob/main/src/libraries/SharesMathLib.sol)

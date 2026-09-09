# Real public RPC capture

Unlike `fixtures/synthetic` and `fixtures/recordings`, the JSON files in this
directory were acquired from public sources. They are retained observations,
not synthetic vectors or independent attestations.

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
- [Virtual shares](https://github.com/morpho-org/morpho-blue/blob/main/src/libraries/SharesMathLib.sol)

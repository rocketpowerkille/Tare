# Chainlink reference valuation coverage

Tare prices an accounting quote, not the vault's backing. The shared allowlist
uses **chain ID + token address**, never a symbol search. Explorer and the bounded
wallet investigation use the same quote-selection helper. The existing
`value-position` API operation and local `tare_analyze` MCP tool use the same
valuation engine. No new route, LLM dependency, payment or contract deployment is
required. The compact Bazantic gateway schema remains unchanged; it does not
advertise `value-position` as a standalone tool.

## Reviewed mainnet mappings

Addresses and heartbeat metadata were reviewed on 2026-09-13. Amounts use token
decimals; USD answers use eight decimals. Existing Ethereum price behavior is
retained. New L2 maximum ages are the reviewed directory heartbeat values, not a
promise of continuous feed availability.

| Network | Asset address | Feed proxy | Maximum age (seconds) |
| --- | --- | --- | --- |
| Ethereum USDC | `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` | `0x8fffffd4afb6115b954bd326cbe7b4ba576818f6` | 86400 |
| Ethereum WETH | `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2` | `0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419` | 3600 |
| Base USDC | `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` | `0x7e860098f58bbfc8648a4311b374b1d669a2bc6b` | 86400 |
| Base WETH | `0x4200000000000000000000000000000000000006` | `0x71041dddad3595f9ced3dccfbe3d1f4b0a16bb70` | 1200 |
| Arbitrum USDC | `0xaf88d065e77c8cc2239327c5edb3a432268e5831` | `0x50834f3163758fcc1df9973b6e91f0f0f0434ad3` | 255 |
| Arbitrum WETH | `0x82af49447d8a07e3bd95bd0d56f35241523fbab1` | `0x639fe6ab55c921f74e7fac1ee960c0b6293ba612` | 1755 |

WETH uses ETH/USD as a reference; this does not measure wrapper liquidity or
redemption. USDC is not assumed to equal one dollar. The L2 USDC feeds are marked
stablecoin-capped in the directory; their reference values are not executable
market quotes. Bridged USDC.e, other wrappers, unrelated assets and Base Sepolia
are not automatically mapped. Testnet assets must not receive mainnet valuations.

Sources:

- [Chainlink feed directory](https://data.chain.link/feeds)
- [Base directory metadata](https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-base-1.json)
- [Arbitrum directory metadata](https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-arbitrum-1.json)
- [Circle native USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [Base canonical contracts](https://docs.base.org/base-chain/network-information/base-contracts)
- [Arbitrum token bridge registry](https://github.com/OffchainLabs/arbitrum-token-lists)

Base ETH/USD uses the eight-decimal standard secondary proxy listed under
`eth-usd-shared-svr-2`, not the SVR primary or an eighteen-decimal variant.

## Acquisition and failure boundaries

- Use `TARE_RPC_URL`, `TARE_BASE_MAINNET_RPC_URL`, or `TARE_ARBITRUM_RPC_URL`
  according to the chain. `TARE_BASE_RPC_URL` remains Base Sepolia only.
- Explorer/investigation require a confirmed live position block, exact asset
  decimals and a returned conversion amount. Zero is valid; missing is not zero.
- Send the position block number and expected block hash into valuation. All
  feed calls use EIP-1898 block-hash pinning; a hash mismatch or failed final
  canonical-block confirmation rejects the price. The direct API's optional
  `blockHash` can enforce the same identity; omitting it does not establish a
  relationship to another report.
- Validate positive signed answers, eight price decimals, round completeness,
  nonfuture timestamps and maximum age relative to the selected block timestamp.
  An old pinned block gives a historical-at-that-block quote, not today's price.
- On Base and Arbitrum, check the sequencer feed at that same block. Reject down,
  uninitialized or invalid status and the first 3600 seconds after recovery.
  Do not apply a price heartbeat to the sequencer's last status-change timestamp.
  See [Chainlink sequencer guidance](https://docs.chain.link/data-feeds/l2-sequencer-feeds).
- Missing RPC/feed data, stale rounds and unsupported assets produce no estimate;
  never fall back to another chain, an assumed peg, zero or an unlabelled old price.
  Source/round validation failures return HTTP 503 `valuation-unavailable`, with
  sanitized text and no provider credentials. They are not a failed backing check.
- Keep integer multiplication, division and rounding remainder. An API caller's
  supplied amount is not independently authenticated by `value-position`.
- Existing fields remain; L2 results add `sequencer` provenance. `/api/status`
  adds `chainlinkAssets` for configured networks (configuration is not health).
  Reports, source cards and explanation facts retain price and sequencer scope.
- Existing saved captures are not enriched with fresh prices on replay. The
  Ethereum nested resolver retains its existing captured valuation path.

## Live read checks, not whole-vault acceptance

On 2026-09-13, bounded reads through public RPCs successfully returned all four
new L2 feed valuations with sequencer status `up`:

| Network / feed | Checked block | Answer raw (8 decimals) |
| --- | --- | --- |
| Base USDC/USD | 0x30e2a55 | 99985383 |
| Base ETH/USD | 0x30e2a56 | 248800576401 |
| Arbitrum USDC/USD | 0x1e160d4a | 99984688 |
| Arbitrum ETH/USD | 0x1e160d53 | 248865514969 |

These are separate observations at different blocks, not same-block agreement,
current prices, Render acceptance or proof of any wallet's holdings. Retest the
deployed application after deploying this code with its configured providers.

## Euler, The Graph and backing: separate work

Euler EVK and EulerEarn are not interchangeable nested-vault structures. The
current generic ERC-4626 adapter returns supply shares and conversion accounting;
it does not trace EulerEarn strategies, EVK borrower collateral, subaccounts or
loan recoverability. Adding a price does not extend that scope.

[Euler's current subgraph documentation](https://docs.euler.finance/build/data-querying/subgraphs/)
lists Goldsky-hosted `euler-simple` deployments. Those schemas discover active
positions; their internal event-time balance entity is explicitly unsuitable for
current balances. They must not be relabelled as The Graph provider evidence or
used to claim current accounting agreement. Tare's existing Ethereum Graph
composition is preserved; no new Graph deployment was made.

A future Euler extension needs a validated factory/implementation identity,
separate EVK/Earn protocol adapters, bounded child enumeration, same-block
conversion rules, replay captures, cycle/limit handling, and tested source
comparison semantics. Independent backing additionally requires an eligible
custody/liability methodology and sources; loan accounting plus pricing cannot
establish it. Until then these checks remain explicitly unsupported, not verified.

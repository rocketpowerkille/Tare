# Offline accounting policy

The fixture model describes an account holding root vault shares. Each vault owns
explicit balances of downstream tokens or shares, with all balances measured in
that child's raw units. For each actual allocation:

```text
attributed child amount = floor(parent input shares * child balance / parent supply)
rounding numerator     = (parent input shares * child balance) mod parent supply
```

Every operation uses `bigint`; JSON represents amounts as unsigned decimal strings.
The receipt records input, balance, supply, output, and the discarded numerator at
every hop. The denominator of that remainder is the recorded supply. Token decimals
are used only for display, never to combine raw quantities of different assets.

This is a proportional synthetic holdings model. It does not implement ERC-4626
`convertToAssets`, virtual shares, fees, nonlinear redemption, debt, or protocol
strategy accounting. Accounting-asset references are not automatically treated as
actual allocations. Input allocations explicitly mean holdings, not risk dependencies.

Single-layer control: 100,000,000 root shares out of 100,000,000 supply attribute
100,000,000 units of a six-decimal token, or 100 synthetic USDC. The deep fixture
preserves that same amount through three vault layers. The degraded fixture resolves
70 synthetic USDC and leaves the other branch unknown. Cycles are reported and
not valued.

Plain token nodes are terminal, unverified token exposures. LP tokens, liquid staking
receipts, bridged wrappers, and lending claims must be represented as opaque until
supported. Reaching a stablecoin token says nothing about its issuer's reserves.
The fixture's author declares node classifications; no chain probing validates them.

The proposed effective collateral multiple is the sum of attributed claim value
across included economic layers divided by independently supported terminal backing
value. Phase one implements neither independent verification nor common-unit
valuation, so it always emits `metric.kind = unavailable`, including for the
single-layer control. A future verified control should produce 1.0x under a documented
scope. Depth is never substituted for this metric.

Unresolved exposure is never imputed as zero. Known terminal amounts are preserved,
but incomplete branches prevent completeness. Value coverage is `null`; structural
finding counts do not estimate portfolio value coverage.

The watch-only native-balance command is outside this accounting model. It reports
an `eth_getBalance` observation at a pinned block and does not treat wallet-native
currency as a resolved vault exposure, a fiat valuation, or verified backing.

# Accounting policy

The first sections describe the offline synthetic formats. The separate live
MetaMorpho accounting policy follows below; its production conversion rules do
not change the meaning of either synthetic format.

Version one remains the original single-position fixture format. Version two adds
canonical asset identity, multiple positions and typed evidence/relationships; the
underlying proportional allocation equation remains explicitly synthetic.

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

## Version-two relationships and consolidation

A `holding` describes assets actually held by the modeled vault, in the target's
raw units. An `accounting-asset` only defines a denomination reference. A
`risk-dependency` records a dependency without creating ownership. Neither reference
contributes amounts, even if it points to an existing terminal token or ancestor.

Positive `debt` requires protocol accounting that is not implemented here. The
entire debt-bearing vault branch is unresolved rather than presenting gross assets
as net owner exposure. Unknown debt evidence also blocks the branch. Recorded zero
debt does not require a netting calculation. Allocation completeness must be
explicitly declared; an incomplete declaration produces a finding even if all
listed holdings resolve. Missing evidence IDs are invalid input, while unhealthy or
misaligned evidence produces a partial resolution.

One snapshot represents one owner's observed balances on one chain/block. Duplicate
root assets are rejected, not added. A direct share balance and another position's
indirect ownership are distinct quantities: each is attributed once, and the amounts
are aggregated by canonical asset identity, never by symbol. All paths into a vault
are also checked cumulatively against its supply. Contradictory ownership suppresses
all aggregate leaves because selecting only some paths would be arbitrary.

Zero inputs preserve conservative topology checks. An empty vault with positive
supply and explicitly complete empty holdings can be topologically complete with
no leaves; this does not establish solvency or metric eligibility. Zero supply is
an unresolved state, avoiding undefined division.

## Proposed metric contract — not yet executable

For a declared, fully supported graph scope at one block, define:

```text
N = sum of attributed claim values at each included economic vault layer
D = independently supported terminal backing value attributable to those positions
scoped claim multiple = N / D
```

Both values must share a currency, pricing reference and timestamp policy. D must
be positive; duplicated observations or repeated references cannot create new
backing. Independent owner allocations may be summed, with ownership consistency
checked. A supported single-layer custody case with 100 units of claim value and
100 units of backing would yield 1x. A supported three-layer case with 100 at each
layer and the same 100 terminal backing would yield 3x. These are methodology
examples, not measured results from this repository.

This measures layered gross claims within the stated scope; it is not automatically
borrower leverage, liquidation risk, or the entire ecosystem's TVL/TVR. The paper
[Piercing the Veil of TVL: DeFi Reappraised](https://arxiv.org/pdf/2404.11745)
provides related work on consolidated backing and the TVL/TVR multiplier. Tare's
owner-specific scope and inclusion rules must be validated separately.

Offline receipts always block the metric for synthetic evidence, missing independent
verification and missing valuation, plus incomplete resolution where applicable.
Future eligibility requires supported conversion/debt treatment, complete allocation
coverage, common-unit prices, positive verified backing and a defined treatment of
any cycles. A snapshot hash is an input identifier, not a signature or verification.

## Receipt reproducibility

`snapshotDigest` is `sha256:` followed by SHA-256 of UTF-8 `JSON.stringify` applied
to the `SnapshotV2Schema.parse` result. This hashes the normalized input, not original
file bytes. It ignores JSON whitespace and schema-normalized address/hash casing.
It retains array ordering; reordered inputs can have a different digest while their
computed exposures agree. Adapter recording bytes are not independently attested.

## Version-three MetaMorpho / Morpho Blue accounting

The supported live scope is an Ethereum USDC MetaMorpho V1 vault and its Morpho
Blue V1 withdrawal-queue loan receivables at a single RPC block hash. For each
market, the adapter reconstructs expected supply/borrow assets with the protocol's
three-term integer interest expansion and market fee shares. It converts the
vault's market supply shares using Blue's virtual assets (1) and virtual shares
(1,000,000). The sum must equal the vault's `totalAssets()` view when every market
is observed. Direct donated tokens are outside this queue accounting.

Vault performance fees are accrued on positive growth over `lastTotalAssets`.
For the supported six-decimal asset and 12-decimal offset:

```text
feeAssets = floor(max(totalAssets - lastTotalAssets, 0) * fee / 1e18)
feeShares = floor(feeAssets * (totalSupply + 1e12) / (totalAssets - feeAssets + 1))
accountQuote = floor(accountShares * (totalAssets + 1) / (totalSupply + feeShares + 1e12))
marketAttribution = floor(accountQuote * vaultMarketAssets / totalAssets)
```

The account quote must match `convertToAssets(accountShares)`. This is an
accounting conversion, not `previewRedeem`, a liquidity estimate or an executable
withdrawal promise. The adapter uses BigInt arithmetic and rejects unsupported
integer ranges, loan assets, ownership contradictions and malformed ABI results.

Each market is a **loan-denominated receivable**. Its collateral, oracle, IRM and
LLTV identify risk dependencies without attributing collateral ownership. This
phase does not decompose borrower collateral or value expected bad debt. Even
USDC-denominated amounts have no implied fiat price or reserve verification.

The denominator for `attributionRemainder` is the vault's raw `totalAssets`.
`unattributedAssetsRaw` is the account quote minus the sum of supported market
attributions: it includes integer rounding and, in partial receipts, unresolved
allocations. It is never silently distributed to observed markets. A zero-asset,
zero-quote vault with fully observed allocations supports zero attribution;
inconsistent zero states remain partial.

Accounting mismatches suppress market attribution. Source/market gaps preserve
supported amounts only when the known denominator and conversion still reconcile
within observed evidence. A reorg or failed final block confirmation suppresses
all attributed amounts. Complete means fully observed within this declared scope.
Independent verification remains pending and value coverage remains null.

The captured [public example](../fixtures/live/README.md) provides exact integer
acceptance values and links to the protocol's accounting sources. Matching views
from one RPC provider checks our implementation, not the provider's truthfulness.

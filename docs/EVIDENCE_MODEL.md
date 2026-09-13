# Evidence model

Tare reports what a bounded operation establishes. It does not infer economic
safety from successful execution of an API request. The same interpretation rules
apply to the browser, CLI, full JSON, compact agent output, and policy projection.

## Categories and exact values

| Category | Definition | Repository example |
| --- | --- | --- |
| Observed | A source directly reports a value at a declared block or timestamp. | `balanceOf`, `totalSupply`, and the contract's conversion quote. |
| Derived | A calculation applies explicit rules to observations. | Integer-attributed Morpho market exposure and nested paths. |
| Market-priced | A reference price converts an amount into another denomination. | Chainlink USD valuation of an eligible asset amount. |
| Checked | A comparison establishes a bounded relation between observations. | Selected Graph accounting results match RPC at the checked hash. |
| Inferred | Interpretation depends on declared protocol semantics or assumptions. | Shares represent a claim reported by the vault, not direct ownership of every collateral token. |
| Not verified | The evidence cannot establish the proposed claim. | Loan recoverability, full backing, and solvency of a lending position. |

A contract-reported conversion is an observation even though the contract computes
it internally. Tare's attribution or valuation of that quote is a separate
calculation. Do not silently change the report's classification.

Raw integer strings remain authoritative. Human-readable values require returned
decimals; do not assume 18 share decimals from an ERC-4626 label. A market-priced
estimate requires a returned price and its provenance. Missing values are not zero.
The saved Steakhouse quote is `28728443339809` raw units with six asset decimals,
or `28,728,443.339809 USDC`; it is not a direct wallet USDC balance.

## Source modes and time

Live acquisition uses configured providers. A capture stores that observation for
later inspection. Replay validates and recomputes the supported result from saved
inputs. It neither contacts the original provider nor updates the observation time.

Report families use their own source-mode enums, including `live-rpc`,
`recorded-rpc`, and composition-specific modes. Preserve the returned `sourceMode`
instead of assigning a universal label. A saved receipt originally labeled live
describes a historical live run; reading its file today is not a fresh check.

The block number is the source state reference, not report generation time. The
block hash identifies the fork. Chainlink `updatedAt` describes the feed update,
which can precede the checked block. Capture time, source time, and session expiry
are different concepts. Do not invent timestamps when the report omits them.

The browser can combine operations acquired at different blocks. Inspect each
module's provenance. Same-block agreement requires the comparison's own identity
and block checks, not merely similar timestamps or equal numbers on two cards.
Token API last-update metadata is not proof of a historical query snapshot.

## Status is scoped to the report family

| Returned status or label | Interpretation |
| --- | --- |
| `complete` | The operation completed within its declared traversal or calculation scope. |
| `partial` or `incomplete` | Required coverage or evidence is missing; inspect findings. |
| `matched` | The eligible comparison agreed within its declared scope. |
| `mismatch` | Compared evidence disagreed or failed a comparison requirement. |
| `unavailable` | Qualifying evidence or a result could not be obtained. |
| `not-eligible` | This operation or evidence is outside the relevant check's rules. |
| `not-used` or `not-included` | This source is not part of this result. It was not necessarily queried. |
| `verified` | Interpret only the named check's scope, such as reference-price validation. |

These are report and presentation labels, not one shared status enum for every
endpoint. A transport error is not evidence of absent assets. A zero-share
observation is not the same as a provider timeout. An incomplete backing check is
not proof that the asset does not exist.

## Provenance and reproducibility

Full reports retain their operation-specific capture metadata, source mode,
network, block, findings, and limitations. Capture digests identify normalized
evidence, but captures are unsigned. A digest is not a provider signature or a
cryptographic state proof. Reproducibility establishes how Tare obtained its
calculation from those inputs, not that all economic claims are true.

[The explanation helper](../packages/receipts/src/explanation.ts) adds deterministic
`explanationContext` to compact outputs without acquisition, a clock, or a model
call. It preserves categories, exact amount formatting where supported, source
summaries, and unknowns. Its bounded lists expose omission counts. If a list is
truncated, the agent must disclose that and inspect the full report when available.
Unknown report types do not receive invented interpretations.

Payment authorization is separate metadata. An accepted Bazantic session does not
establish settlement unless an actual payment result is available, and neither
establishes anything about the vault. A capture digest is not a payment receipt.

## Reading a report safely

1. Check the operation, network, address, source mode, and observed block.
2. Read observed balances separately from conversions and attributed exposure.
3. Inspect which comparisons ran and which were unavailable or ineligible.
4. Check source-block differences before describing agreement.
5. Read the missing evidence and limitations before forming a conclusion.
6. Preserve unknowns when explaining the result to someone else.

Tare has narrow custody controls for specific wrappers and test deployments. Those
rules do not transfer to Morpho lending receivables. Accounting agreement and
Chainlink pricing do not prove custody, solvency, liquidity, redeemability, hidden
liability absence, or complete backing. A complete trace must not become a safety
score. See [the Recipe rules](BAZANTIC_PLAIN_LANGUAGE_RECIPE.md).

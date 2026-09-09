# Synthetic adapter recordings

These are authored provider-shaped test vectors, not captures from a real service.
Every recording and observation explicitly declares `synthetic-recording`.

Addresses ending in 01–05 represent root vaults A/B, shared vault C, six-decimal USDC
and eighteen-decimal GOV. They are not deployed contract claims. The synthetic owner
ends in 11. Symbols are labels; chain plus address establishes identity.

| Case | Expected result |
| --- | --- |
| multi-asset | 40/100 of A holding 60 C, plus 20/100 of B holding 40 C: 32 C shares resolve to 32 USDC and 0.32 GOV |
| overlap | Adds 10 directly held C shares: 42 USDC and 0.42 GOV |
| debt | C has positive debt: partial, no gross leaf amounts |
| degraded | GOV holding evidence unavailable: partial, retains 32 USDC |
| cycle | C holds A shares: partial with exact cyclic paths |
| schema-drift | C supply is invalid text: opaque invalid-record finding |

The envelope holds owner positions, sources, evidence and adapter records. The
fixture adapter maps `total_supply`, `holdings`, `debts`, `accounting_asset` and
`risk_dependencies` into schema 2. `allocations_complete` is an explicit assertion.
Token classification must be `plain-token` or `unsupported-wrapper`; a stablecoin
symbol alone cannot establish plain-token status. References do not imply ownership.

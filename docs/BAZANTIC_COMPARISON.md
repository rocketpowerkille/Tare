# Historical Bazantic Recipe comparison

Point-in-time result: **2026-09-12 IST**.

This record compares Tare's raw Bazantic gateway tools with the published
`DeFi Vault Backing Evidence Evaluator` Recipe. It is intended to support the
submission recording and preserves the conditions, measured results and claim
boundary without treating a single run as a general benchmark.

## Retained setup and evidence limits

The original note reports the following shared conditions. Raw outputs and the
complete model settings are not retained with it, and the input representations
shown below differ. An identical-prompt controlled comparison is therefore not
verified in this repository. The model identifier is retained as originally
reported, not independently validated against a current provider catalog.

Reported shared conditions were:

- the same Bazantic account and Tare gateway;
- `anthropic/claude-opus-5`;
- the same live Base Sepolia custody question and owner;
- the same available live tools: `tare_status` and `tare_analyze_compact`;
- no `tare_example_compact` access and no retained evidence;
- no payment (Bazantic's operator credential was used for the Recipe tests).

Owner under test:

```text
0xF1feA08EbBa92eD342Acc5639dB312C3694Bc391
```

Raw-baseline prompt:

```text
Check whether owner 0xF1feA08EbBa92eD342Acc5639dB312C3694Bc391 has a currently executable, independently verified Base Sepolia custody position. Use fresh live evidence and do not use retained examples.
```

The guided Recipe received equivalent structured inputs:

```text
operation: verify-base-custody
analysis_mode: live_analysis
owner_address: 0xF1feA08EbBa92eD342Acc5639dB312C3694Bc391
vault_contract_address: omitted
block_number: omitted
```

## Results

| Measure | Raw API baseline | Published Recipe | Difference |
| --- | ---: | ---: | ---: |
| Completion | Complete | Complete | Same |
| Latency | 28,419 ms | 19,513 ms | 8,906 ms lower (**31.34%**) |
| Tokens | 8,107 | 6,685 | 1,422 fewer (**17.54%**) |
| Payment | None | None | Same |

Both runs selected `verify-base-custody`, used fresh live RPC evidence and reached
the same conservative factual conclusion:

- the report was `incomplete`;
- the position was not currently executable;
- independently verified backing was false;
- the relevant findings were `zero-position`, `zero-supply` and
  `redemption-rounds-to-zero`.

The Recipe result was additionally organized into stable sections for source and
analysis mode, operation and schema, owner and chain context, resolution status,
exposure summary, verification findings, evidence limitations, evidence digests,
and final verdict with rationale. The raw baseline reached the correct conclusion
but with less consistent report structure.

## Honest interpretation

This is one historical product-demonstration pair, not a statistically significant
benchmark. The note reports equal conservative conclusions and different measured
latency/token usage. Without identical prompts, complete settings, and raw
artifacts, it does not isolate a causal effect of Recipe guidance. The percentages
are arithmetic differences in the recorded pair, not expected improvements.
These results concern the older evaluator, not the newer plain-language Recipe.

The live result also does **not** prove an executable vault position or independent
loan backing. It correctly reports the absence of sufficient/executable evidence.
No Base-mainnet payment was performed, and no unresolved payment flow is required
to reproduce these operator-credential Recipe tests.

## Recording checklist

Capture a short continuous demo that shows:

1. the gateway's actual enabled tools at recording time;
2. the published `DeFi Vault Backing Evidence Evaluator` Recipe;
3. the raw baseline prompt, model, enabled tools and completed metrics;
4. the equivalent Recipe inputs, model, enabled tools and completed metrics;
5. the matching conservative conclusion and the Recipe's structured sections;
6. the recorded measurements, with the single-pair and input-difference caveats;
7. the Bazantic username required by the submission.

Keep secrets, authorization headers, API tokens and wallet keys out of the
recording. If the Base-mainnet balance or funding panel appears, state that the
demonstrated Recipe tests used the operator credential and made no payment.

For a new controlled run, hold the prompt, model, model settings, API access,
enabled tools, and input evidence constant. Change only Recipe guidance. Retain
both raw answers, tool calls, latency, token usage when available, and factual
review. Follow [the current integration guide](BAZANTIC_INTEGRATION.md).

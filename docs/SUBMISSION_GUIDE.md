# ETHOnline submission guide

## Project summary

Use the project name **Tare** and submission title **Tare: DeFi Evidence, Explained**.
Tare helps researchers and AI agents interpret supported DeFi vault positions by
tracing their allocations, comparing eligible sources, and separating observations,
calculations, prices, checked evidence, and unknown claims. It addresses the gap
between reading a balance and understanding what that balance represents. The
scope is a technical MVP, not universal backing or safety verification.

The application title was not changed in this documentation-only pass. Submission
metadata should use the title above; review any desired browser-title change
separately.

## Canonical demonstration

Follow [the three-minute script](DEMO_SCRIPT.md). Start with the saved Steakhouse
USDC result so a judge sees a concrete quote early. Show its market allocation
path and missing backing evidence. Then label a separate live Graph comparison,
the public Bazantic Recipe, and the retained Chainlink testnet workflow result.
Do not imply that all three sponsor outputs belong to the saved capture's block.

| Integration | What to show | What not to imply |
| --- | --- | --- |
| The Graph | Token API observation, Studio read set, block alignment, and RPC comparison. | Accounting agreement proves recoverable loans. |
| Chainlink | Eligible price provenance, confidential handler, private policy boundary, and historical testnet transaction. | A price proves custody, or the paused workflow is continuously executing. |
| Bazantic | Public Recipe, actual gateway tool calls, and evidence-grounded explanation. | Copying a prompt is a Bazantic execution or an operator test is a paid customer run. |

## Claims supported by the repository

- Tare traces supported vault and lending-market exposure with bounded integer
  attribution and explicit unsupported branches.
- Eligible comparisons preserve chain, source, block, read-set, and deployment
  checks. Historical notes report a 56-read Graph/RPC match.
- The CRE code evaluates private policy inputs in `handlerInTee`. A retained
  hosted manifest records a bounded Base Sepolia exit through Chainlink's forwarder.
- Bazantic gateway schemas expose compact evidence operations. Published Recipe
  use is recorded, with a direct public link for the plain-language Recipe.
- Agent context distinguishes accounting, derived exposure, reference prices,
  comparison scope, authorization, and unknown backing.

Do not claim universal position support, full backing, solvency, guaranteed safety,
complete historical reconstruction, production readiness, or mainnet execution.
Do not infer real payment from session issuance alone. Do not present the older
timing pair as a general benchmark or the current Recipe's controlled evaluation.

## Required screenshots and outputs

1. Capture the Explorer summary, exact amount units, block, and visible limitation.
2. Capture the evidence path and one expanded source detail with coverage visible.
3. Save the actual Graph comparison JSON, capture, deployment CID, and block hash.
4. Save the Bazantic Recipe task, model/settings, tool calls, and final answer.
5. If demonstrating payment, retain a redacted payment result with transaction or
   receipt reference. Hide the issued bearer token and authorization signature.
6. Show the CRE handler and public execution manifest alongside the testnet
   transaction. Include the paused-state and consumed-position note.
7. Preserve an unavailable or mismatched result as a labeled negative case.

Tracked fixtures and manifests are available. Raw hosted Graph acceptance,
redacted Bazantic paid-session output, two-service Recipe output, and a controlled
plain-language comparison remain collection tasks, not newly generated artifacts.

## Recording checklist

- [ ] Record a two-to-four-minute narrative, using the same canonical position
  where possible and explicitly identifying the separate testnet control.
- [ ] Show exact values with units. Do not invent missing share decimals or USD.
- [ ] Label saved, live, and historical hosted evidence at the moment it appears.
- [ ] Show actual Recipe execution, not only the copy-context button.
- [ ] Show one limitation in the main report, not only in JSON.
- [ ] Hide tokens, API headers, private keys, seed phrases, payment signatures,
  secret policy values, and device-authorization links.
- [ ] Include the Bazantic account identifier requested for sponsor attribution,
  after confirming the maintainers' intended public identifier.
- [ ] Check the final recording for accidental credentials and misleading cuts.

## Public repository checklist

- [ ] Choose and add the intended repository-wide license. No such license was
  found in the reviewed revision; individual contract SPDX headers are insufficient.
- [ ] Confirm the public repository and final deployed revision match the demo.
- [ ] Confirm project track and disclose any pre-existing work.
- [ ] Retain lockfiles, source fixtures, public manifests, and commit history.
- [ ] Exclude `.env`, build outputs, generated Graph bindings, WASM, and secrets.
- [ ] Attach the video URL and redacted acceptance artifacts before final submission.
- [ ] Decide how maintainers want security issues reported privately. No dedicated
  channel is verified in this repository.

## Reproducibility checklist

- [ ] Follow the root quick start with Node 24+ and pnpm 11.19.0.
- [ ] Replay the saved Steakhouse capture without live credentials.
- [ ] Check all four routes and download the report and capture.
- [ ] Run the suites listed in [the dated verification record](TEAM_HANDOFF.md).
- [ ] For live evidence, configure providers privately and save the returned source
  mode, block, timestamp, deployment identity, findings, and limitations.
- [ ] Keep local Graph Node results distinct from hosted Studio acceptance.
- [ ] Keep CRE unit tests and WASM compilation distinct from actual TEE simulation
  or hosted execution. Do not resume the consumed control for a recording.

## Sponsor evidence checklist

Use [the official-category review](PRIZE_TRACKS.md) for eligibility, rather than
equating technical fit with qualification.

- [ ] Graph: demonstrate that live Graph data changes the comparison or agent
  conclusion. For composition, show both products rather than only one query.
- [ ] Chainlink: show private-input handling, the returned public boundary, and
  retained successful execution evidence. State the configured-service trust.
- [ ] Bazantic: show both services materially affecting the two-service Recipe.
  Keep the public plain-language Recipe demo distinct from a controlled comparison.
- [ ] Confirm whether the proposed non-sponsor API satisfies Agentify's additional
  service requirement. Existing documentation does not establish that requirement.
- [ ] Confirm the registered project track before claiming any Continuity category.

No submission, gateway change, deployment, transaction, or commit was performed by
this documentation preparation. The remaining decisions belong to the maintainers.

# Phase seven: confidential policy and bounded exit

Local implementation: confidential CRE handler, private policy evaluation, signed
verdicts, Sepolia report submission and an ERC-4626 exit receiver. The official SDK
compiles the workflow to WASM. SDK harness and Foundry tests exercise the isolated
paths; the authenticated CRE CLI simulator now also exercises the live local path.
This remains a simulator run, not a deployed TEE workflow or live transaction.

## Evidence and privacy boundary

`packages/policy/src/decision.ts` evaluates freshness, concentration and verified
multiple thresholds using integer arithmetic. `v1.ts` projects existing Tare V1
resolution and share-verification reports, checking owner/vault identity, matching
block number/hash/timestamp, deployment CID, share checks and allocation totals.
This trusts the configured HTTPS Tare service's reports; it does not independently
authenticate providers or recompute the complete captures inside the enclave.

`workflows/cre/src/workflow.ts` runs through `handlerInTee`. It obtains the policy
and API token using enclave secrets, calls `resolve-v1`, then `verify-accounting` at
the resolution block. Recorded, partial, stale or inconsistent evidence blocks
action. A private concentration threshold changes the review/hold verdict.
V1 lending backing is always unverified and its multiple remains unavailable:
neither extra API fields nor `execution.enabled` can turn V1 into an exit.

Only a verdict and evidence commitment, or public exit terms, cross to the DON for
signing. Raw API responses, private thresholds and tokens are not logged, returned
or included in signed payloads. Errors are sanitized. Verdicts necessarily reveal
the policy outcome; the digest is a commitment, not proof of backing or freshness.

`publish.ts` handles signing/submission; `report.ts` defines the ABI payload.
Submissions require both transaction and receiver success. After an uncertain
submission, inspect the transaction and consumed permit before retrying.

## Solidity receiver

`contracts/src/BoundedVaultExit.sol` is restricted to chain ID 11155111. Each owner
arms an exact share amount, minimum asset return and expiry of at most one day,
then separately approves those vault shares. Cancel or re-arm invalidates older
reports by nonce. Redemption returns assets directly to that owner.

The receiver authenticates the configured forwarder and all three workflow
identifiers. It validates chain, receiver, owner/vault, exact shares, minimum output,
one-use nonce, permit/report expiry, a nonzero evidence digest and a canonical block
hash from the previous 64 blocks. Report expiry is bounded by the permit and ten
minutes. Asset changes, reentrancy, incorrect share consumption and insufficient
actual asset receipts revert atomically.

The forwarder verifies signatures; the receiver does not verify the economic
evidence behind its digest. Owners trust their chosen vault and the pinned workflow.
There is no arbitrary-call executor, mainnet execution or production security audit.

## Local verification

From the repository root, with Node 24, pnpm 11.19.0, Bun 1.3.10 and Docker:

```sh
pnpm install --frozen-lockfile
npm ci --prefix workflows/cre --ignore-scripts --no-audit --no-fund
node --run verify
node --run verify:cre
npm run compile --prefix workflows/cre
docker run --rm --user 0:0 --entrypoint forge -v "${PWD}:/work" -w /work/contracts ghcr.io/foundry-rs/foundry:v1.3.1 test -vv
```

The first WASM compile downloads the SDK's checksum-verified Javy compiler.
Artifacts use the existing ignored `.tare/` and `dist/` directories. CRE tooling
has an isolated package/lockfile because its protobuf and runtime requirements
differ from the Node CLI/API. No runtime dependencies were added to the root.

Acceptance on 2026-09-11: 120 root tests plus existing demos/replay; 7 CRE tests;
12 Solidity tests including 256 fuzz cases; official WASM compilation. The shared
synthetic ABI vector is checked by both languages. SDK tests mock HTTP, secrets,
signing and EVM submission; Foundry tests use a deliberately controllable vault.
An authenticated CRE CLI v1.33.0 simulation called the loopback Tare API, resolved
the live Steakhouse USDC V1 position, reconciled the deployed accounting subgraph
against same-block RPC evidence and produced `hold` with the ordinary private
threshold and `review` with a stricter threshold. Both runs disabled simulator
limits because the stable no-key public RPC exceeded CRE's ten-second HTTP limit.
The ordinary threshold was then repeated successfully under CRE's default
production limits using a user-configured authenticated Ethereum RPC. No transaction
was broadcast. CI repeats the automated checks; a remote CI run has not been
performed for this change.

## Deferred setup and remaining code

Account, wallet, endpoint and deployment configuration is deferred by request.
`config.example.json` contains unusable sample identities and disables execution.
`secrets.yaml` maps names only, without secret values. The private policy secret
is JSON with `maxAgeSeconds`, `maxConcentrationBps` and `maxMultipleBps`; basis
points use 10,000 for 100% or a 1x multiple. The API secret must match the hosted
Tare access token. Keep real values outside tracked configuration and chat.

Before hosted policy acceptance, configure a protected HTTPS Tare API, CRE
deployment access and enclave secrets. Repeat the two private-threshold cases on
the deployed workflow and retain the execution records. Local simulation does not
satisfy this hosted acceptance step.

For end-to-end development without exposing a machine, the CRE configuration may
use `http://127.0.0.1:<port>/api/analyze` or the equivalent `localhost` URL while
the simulator and Tare API run on the same computer. Plain HTTP is rejected for
every non-loopback hostname. This local path exercises live provider acquisition
and confidential policy execution, but it is not evidence of a deployed CRE
workflow or production HTTPS authentication.

Local production-limit acceptance is complete with the configured low-latency
Ethereum RPC. A protected HTTPS Tare deployment and CRE deployment approval remain
required for hosted acceptance; the access request is pending review.

Before live exits, **implement and validate a verified Sepolia evidence producer**.
The current V1 adapter is Ethereum-only and cannot supply eligible exit evidence;
the synthetic test fixture must never replace this missing producer. This is
remaining implementation work, not an account-setting task. Then deploy the
receiver with official forwarder/workflow identities, obtain explicit owner
authorization and verify a bounded testnet redemption and its failure cases.

The production forwarder's metadata is 64 bytes: workflow ID (32), workflow name
(10), workflow owner (20), report ID (2). The simulator's MockForwarder may omit
identity metadata; do not weaken receiver validation to accommodate it. Local
tests explicitly supply fixture identities.

References: [confidential workflow template](https://docs.chain.link/cre-templates/hello-confidential-workflows)
and [receiver integration](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts).

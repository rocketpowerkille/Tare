# Phase seven: confidential policy and bounded exit

Local implementation: confidential CRE handler, private policy evaluation, signed
verdicts, a verified Base Sepolia evidence producer, report submission and an ERC-4626 exit receiver. The official SDK
compiles the workflow to WASM. SDK harness and Foundry tests exercise the isolated
paths; the authenticated CRE CLI simulator now also exercises the live local path.
The bounded receiver and its deterministic control position are now deployed on
Base Sepolia. The CRE workflow remains a simulator build, not a deployed TEE
workflow.

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

The distinct `verify-base-custody` operation uses server-configured Base Sepolia
deployment identities and two RPC endpoints with different hostnames. Both witnesses
must agree on chain ID 84532 and the same confirmed block. Runtime bytecode for the
outer vault, inner vault and terminal asset must match the allowlisted SHA-256 digests;
direct balances, supplies, asset links and redemption previews must reconcile across
both providers. Recorded captures remain non-executable. CRE selects this source only
when `evidenceSource` is `base-sepolia-custody`; callers cannot supply provider URLs or
deployment addresses through the API request.

Only a verdict and evidence commitment, or public exit terms, cross to the DON for
signing. Raw API responses, private thresholds and tokens are not logged, returned
or included in signed payloads. Errors are sanitized. Verdicts necessarily reveal
the policy outcome; the digest is a commitment, not proof of backing or freshness.

`publish.ts` handles signing/submission; `report.ts` defines the ABI payload.
Submissions require both transaction and receiver success. After an uncertain
submission, inspect the transaction and consumed permit before retrying.

## Solidity receiver

`contracts/src/BoundedVaultExit.sol` is restricted to Base Sepolia chain ID 84532. Each owner
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

Acceptance on 2026-09-11: 128 root tests plus existing demos/replay; 10 CRE tests;
16 Solidity tests including 256 fuzz cases; official WASM compilation. The shared
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
required for hosted acceptance; the access request is pending review. Chainlink
staff estimated the review at 24–48 hours and clarified that an end-to-end local
simulation, not a deployed workflow, is the relevant bounty/judging evidence. Hosted
deployment therefore remains a follow-up acceptance gate rather than a submission
blocker. Simulator output must still be labeled as simulation and cannot be described
as DON execution.

The verified Base Sepolia producer is implemented and wired through the CLI,
protected API and confidential workflow. The allowlisted E2E control and actual
bounded receiver were deployed on Base Sepolia in transaction
`0x27672d1ff78f04ba5ac0d7f567c5fe1d98a17cc154b62bfe35852dd62c7d49bc`
at block `46684694`. Read-only acceptance confirmed the expected owner, deployed
bytecode, asset links and the complete 100-unit two-layer custody position. The
deployment identities and bytecode digests are retained under `deployments/`.
The current Ethereum V1 adapter remains non-executable.

Bounded exit acceptance completed on Base Sepolia. The owner approved exactly 100
outer shares, armed a 95-share minimum with nonce 1, and a fresh two-provider
verification produced the same ABI payload used by the CRE workflow. Transaction
`0x727d95f56314b7756438f05069a27bf84f6216f8c8c771bbe28996ac897dce75`
redeemed exactly 100 outer shares for 100 inner shares. Post-transaction reads
confirmed zero owner outer shares, zero receiver balances, zero remaining allowance
and a consumed permit at nonce 2. Direct receiver calls, non-owner forwarding,
malformed payloads, a fresh wrong-share payload and replay of the exact mined
calldata all reverted with their intended custom errors.

The E2E deployment deliberately uses an owner-only test forwarder because hosted
CRE access and a production workflow identity are unavailable. It tests the real
receiver and state transition on Base Sepolia but is not evidence of Chainlink DON
signature delivery. A later production receiver must pin Chainlink's Base Sepolia
Keystone Forwarder and the final hosted workflow identity.

The production forwarder's metadata is 64 bytes: workflow ID (32), workflow name
(10), workflow owner (20), report ID (2). The simulator's MockForwarder may omit
identity metadata; do not weaken receiver validation to accommodate it. Local
tests explicitly supply fixture identities.

References: [confidential workflow template](https://docs.chain.link/cre-templates/hello-confidential-workflows)
and [receiver integration](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts).

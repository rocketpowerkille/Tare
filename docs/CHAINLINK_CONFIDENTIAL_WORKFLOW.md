# Chainlink valuation and Confidential Workflow

Tare uses Chainlink in two separate paths. Explorer can request eligible reference
pricing. A scheduled CRE workflow evaluates evidence and private policy for a
bounded testnet action. Opening Explorer does not run or resume that workflow.

## Reference valuation

[The source adapter](../packages/sources/src/chainlink.ts) reads Ethereum USDC/USD
or ETH/USD feeds at a selected block hash. It validates feed decimals, round IDs,
positive answers, answered-in-round consistency, timestamp ordering, future times,
and maximum age relative to the block. Amount conversion uses integer arithmetic.

An available USD estimate is market-priced, not proof of custody, liquidity,
solvency, or backing. Missing or stale pricing stays unavailable. The saved nested
USDC and WETH captures contain historical pricing; replay does not update it.

## Confidential workflow

```text
Cron trigger
  -> handlerInTee: obtain secrets, fetch authenticated evidence, evaluate policy
  -> bounded verdict and evidence commitment
  -> DON report
  -> eligible Base Sepolia writeReport
  -> Keystone Forwarder -> one-use BoundedVaultExit receiver
```

[The workflow](../workflows/cre/src/workflow.ts) registers `handlerInTee` with the
CRE SDK. Inside that handler it reads private policy and API credentials, acquires
the configured Tare response, and evaluates integer policy rules. The V1 path
combines resolution and accounting evidence at a matching block. Its missing
independent lending backing prevents execution. A separate allowlisted Base
custody producer supplies the bounded testnet control path.

Private thresholds include `maxAgeSeconds`, `maxConcentrationBps`, and
`maxMultipleBps`. Changing a threshold can change the verdict without publishing
the threshold itself. No LLM is part of this policy evaluation.

## Confidentiality and trust boundary

| Private inside the handler | Public or externally verifiable |
| --- | --- |
| Secret API credentials | Final verdict and evidence commitment. |
| Secret policy thresholds | Encoded exit terms when execution is eligible. |
| Authenticated response bodies | Consensus report delivery and transaction hash. |
| Intermediate policy calculations | Recorded receiver post-state. |

Target addresses, scheduling configuration, and exit configuration are not all
secret. The outcome can also reveal information about the policy decision.
[Publishing](../workflows/cre/src/publish.ts) returns bounded results rather than
raw secrets or response bodies, obtains a DON report, and uses the EVM client for
delivery. A successful transaction and receiver status are required for success.

The workflow trusts the configured Tare API's economic evidence. It does not
independently reconstruct all raw provider observations inside the enclave.
TEE execution and DON delivery protect their respective boundaries; they do not
prove that loans are recoverable or that a vault is economically solvent.

## Bounded receiver

[BoundedVaultExit](../contracts/src/BoundedVaultExit.sol) is restricted to chain
`84532`, Base Sepolia. It checks the trusted forwarder and workflow identity,
owner-authorized vault, asset, exact shares, minimum assets, nonce, validity window,
and recent block hash. A permit is one-use, with a maximum one-day lifetime; the
report has a tighter time window and a recent-block constraint. Assets return to
the owner. This is not an arbitrary call executor or a mainnet product.

## Historical hosted execution

The retained [hosted execution manifest](../deployments/cre-hosted-execution.json)
records a 2026-09-11 CRE run and the following public evidence:

| Item | Retained value |
| --- | --- |
| Workflow ID | `0024de354e9d08c1e57c1cc4308e3ea462c89580de2ddbef2a3c69e8bd53e3bd` |
| Execution ID | `c0c22aaf520df358ad5358bd5806015fd4335adf790432918d5abdd35654b206` |
| Base Sepolia block | `46693969` |
| Keystone Forwarder | `0xf8344cfd5c43616a4366c34e3eee75af79a74482` |
| Receiver | `0xec3b0dc653f9150ecde9a6a2c14e9138dfb9e577` |
| Result | Exactly 100 outer shares redeemed for 100 inner asset units, each with 18 decimals. |
| Post-state | Outer shares, allowance, and permitted shares were zero; nonce became 2. |

External transaction reference:
[Base Sepolia hosted exit](https://sepolia.basescan.org/tx/0x65549cd7b8c823795ec22ae17f297f8d3d3668ee5278e690ee836ba3d63b95f9).
This is a historical manifest-backed testnet result, not a fresh execution in this
documentation pass. The following scheduled run made no EVM write after the
control position was consumed.

The earlier [deterministic exit record](../deployments/base-sepolia-e2e.json) uses
an owner-only test forwarder. Do not describe that earlier transaction as DON
delivery. The hosted record above is the separate Chainlink-forwarder experiment.

## Latest retained state

[The stable API binding](../deployments/cre-stable-api-binding.json) records workflow
`00fe0024badc88b0518ca30fa44d6b0911dd338282ae5a75eadc460e4c140a48`
as `PAUSED`, with `executionEnabled: false`. It points to the Render API and
records incomplete evidence for the already-consumed control. Current registry
state was not queried during this documentation review.

The example cron expression `0 */5 * * * *` means every five minutes. It is an
example schedule, not evidence that the paused deployment runs every five minutes
today. Pausing CRE does not disable Explorer's separate price-feed reads.

## Reproduction and test levels

Use the locked dependencies and Bun on `PATH`. CI specifies Bun 1.3.10; the current
local review used Bun 1.4.2. CRE SDK version is pinned to 1.20.1.

```sh
npm ci --prefix workflows/cre --ignore-scripts --no-audit --no-fund
pnpm verify:cre
npm run compile --prefix workflows/cre
pnpm cli verify base-custody-replay fixtures/live/base-sepolia-custody.capture.json --json
```

Compilation produces ignored WASM under `.tare/cre/`; it is not hosted acceptance.
The 12 workflow unit tests use controlled evidence and capability stubs. They test
private-threshold changes, missing/stale/recorded evidence, API failure, malformed
configuration, and unsuccessful delivery. They are not an actual TEE simulation.
The retained authenticated simulator and deployment procedure is in
[phase seven](PHASE_7.md); it requires separately configured local secrets and CRE
access. No simulation with private credentials was rerun for this documentation.

With a running Docker Linux engine, the repository's Foundry command is:

```sh
docker run --rm --user 0:0 --entrypoint forge -v "${PWD}:/work" -w /work/contracts ghcr.io/foundry-rs/foundry:v1.3.1 test -vv
```

Receiver tests cover unauthorized callers, altered payloads, stale evidence,
wrong-share terms, replay, and post-state invariants. The previous 23-test result
is historical; Docker was unavailable for this review. Do not re-arm, deploy, or
resume a workflow merely to reproduce a read-only report.

## Submission boundary

The official [Confidential Workflow category](https://ethglobal.com/events/ethonline2026/prizes/chainlink)
accepts meaningful confidential execution with private input and simulation or
deployment evidence. Tare supplies a concrete handler and retained hosted result.
Sponsor acceptance remains their decision. This is not the separate Ethereum
Sepolia liquidation challenge, a security audit, or production-readiness evidence.

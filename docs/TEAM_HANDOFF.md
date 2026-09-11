# Team handoff — current state and next work

Point-in-time status: **2026-09-11**. This document separates implemented code,
retained acceptance evidence and partner-hosted work that is still pending. Treat
the deployment manifests and phase documents linked below as the detailed source
of truth.

## Executive status

Tare is a working technical MVP for resolving nested vault exposure, comparing
independent observations and conditionally executing a tightly bounded exit on
Base Sepolia. The core engine, CLI/API/MCP interfaces, local web explorer,
monitoring logic, Graph mappings, confidential-policy workflow and receiver are
implemented and tested. One bounded Base Sepolia exit has been executed onchain.

The MVP is **not submission-complete**. Chainlink has not enabled hosted CRE
deployment access, Bazantic has not been connected on its platform, the
historical Graph share ledger has not completed its backfill, and the UI still
needs final product integration and polish.

## Partner and component status

| Area | Current state | What remains |
| --- | --- | --- |
| Core resolver | Implemented for synthetic schemas and the documented Ethereum MetaMorpho V1 plus V2→V1→Blue scope. Integer accounting, partial evidence and replay are tested. | Broader protocol/network coverage is optional future scope, not part of the verified MVP. |
| The Graph | Custom share/accounting mappings build and pass real local Graph Node rollback tests. The deadline-safe `tare-live-accounting` Studio deployment matched all 56 Graph observations to same-block RPC at Ethereum block `25953771`, with zero mismatches. | The original `tare-steakhouse-usdc-ethereum` full-history share ledger was last observed around 73% sync. When it completes, retain one same-block share **and** accounting acceptance report. |
| Chainlink CRE | TypeScript workflow, private policy, redacted report, Base evidence producer and ABI payload are implemented. The official SDK compiles to WASM; local authenticated simulation works. | Deployment access is pending. Hosted execution, enclave secrets, production workflow identity and DON-signed delivery have not been accepted. |
| Base Sepolia execution | Receiver/control harness deployed. Two-provider, allowlisted-bytecode custody verification matched a 2.000000x control. A bounded 100-share exit succeeded, and five failure/replay cases reverted. | The accepted control position is consumed. A hosted CRE test needs a fresh position and a new receiver pinned to the official Chainlink forwarder and final workflow identity. |
| Bazantic | Tare's deterministic composition API/MCP operation is implemented and rejects contradictory evidence. | Account/gateway setup, second-service binding, native Recipe authoring and a hosted run are not done. |
| Monitoring | Local TypeScript Substreams consumer, checkpoints, deduplication, reorg rollback and evidence evaluation are implemented. | Hosted provider credentials, deployment and operational acceptance are pending. |
| Interfaces/UI | CLI, protected HTTP API, stdio MCP server and localhost explorer are functional. | Connect the final hosted endpoints and complete the UI last, with clear live/recorded and verified/unverified labels. |

Rust is not currently required. Core services and CRE remain TypeScript, Graph
mappings use AssemblyScript, and the receiver uses Solidity. Rust is allowed only
if a future custom Substreams extraction module is justified; see
[the language strategy](LANGUAGE_STRATEGY.md).

## Verified acceptance evidence

Latest local acceptance in this workspace:

- `pnpm verify`: **128/128** Node tests passed, followed by all required demos and
  the retained Ethereum capture replay.
- CRE workflow suite: **10/10** tests passed in the Bun-enabled environment; the
  official SDK previously compiled the workflow to `.tare/cre/tare-policy.wasm`.
- Foundry suite: **16/16** Solidity tests passed, including 256 fuzz cases.
- The Graph: local Graph Node/Anvil indexing and rollback passed; hosted live
  accounting matched **56/56** reads with zero mismatches.
- Base Sepolia: live two-provider custody matched; the bounded success transaction
  and rejected caller/payload/replay cases are recorded in the deployment manifest.

Useful verification commands:

```sh
pnpm verify
npm run verify --prefix workflows/cre
npm run compile --prefix workflows/cre
docker run --rm --user 0:0 --entrypoint forge -v "${PWD}:/work" -w /work/contracts ghcr.io/foundry-rs/foundry:v1.3.1 test -vv
pnpm cli verify base-custody-replay fixtures/live/base-sepolia-custody.capture.json --json
cre whoami
```

The CRE commands require Bun on `PATH`. Replays are deterministic evidence checks,
not claims that the evidence is fresh. Keep RPC keys, API tokens, deploy keys,
wallet private keys and CRE secret values out of Git and chat.

## Base Sepolia deployment and bounded exit

This is a test-only deployment on chain ID `84532`; it is not Ethereum mainnet and
contains no production assets.

| Item | Value |
| --- | --- |
| Owner/deployer | `0xf1fea08ebba92ed342acc5639db312c3694bc391` |
| Harness | `0x39d408086d22859a3a1c19d8cfae1fbed2cb58ea` |
| Terminal asset | `0x8ee5f47e407006df298f45d0a4dae14d60cbde62` |
| Inner vault | `0x09b7f07f10800064f7db6a262ecff344da0bd867` |
| Outer vault | `0x60407bf755a379d530a5409ac3639ec4bbaa0bbe` |
| Owner-only test forwarder | `0xc819e99b4d2fb2a96bc47c67417f87213f86ad0c` |
| Bounded exit receiver | `0xd1b87d595662f37390c02af906448cd38a100323` |
| Deployment transaction | `0x27672d1ff78f04ba5ac0d7f567c5fe1d98a17cc154b62bfe35852dd62c7d49bc` |
| Approval transaction | `0xd47b3b76f20a4212301ed2e6d11596a229c07b19acb320fc4988135d64b3c0f8` |
| Arm transaction | `0x64ec65c7d7191748ae2969210e9899581716eae207a17f7ca2544b01e63e23ce` |
| Exit transaction | `0x727d95f56314b7756438f05069a27bf84f6216f8c8c771bbe28996ac897dce75` |
| Evidence digest | `0x39f2402818eb7370fbf69a68f69c9820d44f9ed63eb18524dbc1953bb5301e78` |

The exit redeemed 100 outer shares for 100 inner shares. Post-state checks found
zero owner outer shares, zero receiver balances, zero allowance, a consumed permit
and nonce 2. The direct receiver caller, non-owner forwarder caller, malformed
payload, wrong-share payload and exact-calldata replay all reverted.

The delivery used an **owner-only test forwarder**, not Chainlink's DON. Therefore
the accurate claim is “real Base Sepolia bounded exit accepted,” not “hosted CRE
execution completed.” See [`deployments/base-sepolia-e2e.json`](../deployments/base-sepolia-e2e.json)
and [phase seven](PHASE_7.md).

The retained Base custody capture was taken before the exit at block `46684889`
(`0x2c85ad9`) from two differently hosted RPC providers. It is valuable replay
evidence, but it is historical after the shares were redeemed. Do not relabel it
as a fresh executable position.

## Ordered next work

### 1. Finish hosted Chainlink CRE acceptance

1. Check `cre whoami` until deployment access is enabled. The request has already
   been submitted and acknowledged as queued by Chainlink support.
2. Host the Tare API behind HTTPS with authentication and configure CRE secrets
   outside the repository.
3. Obtain the final hosted workflow ID/name/owner and confirm Chainlink's official
   Base Sepolia Keystone Forwarder from current documentation.
4. Create a fresh test position and deploy a **new** production-path receiver pinned
   to that official forwarder and final workflow identity. Do not reuse the consumed
   control or the owner-only test-forwarder receiver.
5. Deploy the workflow, run `hold` and `review` policy cases, then execute at most
   one newly armed bounded test exit. Retain CRE execution and onchain records.

### 2. Finish hosted monitoring and Bazantic

1. Deploy the API/monitor with bounded provider configuration, durable state,
   TLS/auth and explicit live-source labels.
2. Complete Bazantic account and gateway setup, bind Tare plus the required second
   service, author the native Recipe and retain a hosted successful/failed run.
3. Let the historical Graph share ledger continue independently. Once fully
   indexed, run the same-block share plus accounting comparison and retain it.

### 3. Complete the UI last

Connect the explorer to the chosen hosted API and surface provenance, block,
deployment identity, completeness, verification status and execution eligibility.
Recorded captures must never appear live, and an unavailable collateral multiple
must not be replaced by an invented percentage. Add a simple guided demo path and
run manual browser acceptance before submission.

## Claim boundary

Safe claims today:

- Tare resolves the implemented nested-vault scope and preserves uncertainty.
- The live accounting subgraph passed a 56/56 same-block Graph/RPC comparison.
- The Base verifier matched allowlisted code and two-layer custody across two RPC
  hosts, and a real bounded Base Sepolia exit plus failure cases were accepted.
- The CRE workflow compiles and runs in the authenticated local simulator.

Do **not** claim yet:

- hosted CRE/DON execution, production readiness or a security audit;
- completed Bazantic integration;
- fully indexed historical share acceptance or broad multi-chain coverage;
- Ethereum mainnet execution, independently verified Morpho loan backing, or that
  two public RPC hosts are cryptographic proof of state.

## Detailed references

- [Phase four — Graph indexing and verification](PHASE_4.md)
- [Phase five — API, MCP, explorer and Bazantic boundary](PHASE_5.md)
- [Phase six — monitoring](PHASE_6.md)
- [Phase seven — confidential policy and bounded exit](PHASE_7.md)
- [Architecture](ARCHITECTURE.md)
- [Live capture provenance](../fixtures/live/README.md)


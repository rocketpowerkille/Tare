# The Graph integration

This guide separates implemented code, historical acceptance notes, and current
provider availability. It does not certify the current Studio synchronization
percentage. A maintainer-supplied historical capture was successfully replayed on
2026-09-13; its bounded acceptance is documented below, not generalized to all
history or current provider health.

## Products and their distinct roles

| Product | Role and scope |
| --- | --- |
| Tare's Studio accounting subgraph | Captures the declared Steakhouse USDC vault and market read set on Ethereum. |
| The Graph Token API | Supplies a wallet's indexed vault-share token balance for product composition. The configured provider defaults to `https://api.pinax.network`. |
| Historical Studio share ledger | Transfer-derived balances and supply from the vault's creation block. A supplied historical share/accounting capture at block `25941070` replayed as matched; full synchronization is not established. |
| Standardized Substreams consumer | Local TypeScript monitoring, checkpoint, deduplication, and rollback code. Hosted continuous-provider acceptance is not complete. |

Morpho's GraphQL discovery API is not The Graph. A successful discovery call does
not demonstrate either Studio accounting or Token API verification.
The share-ledger and accounting mappings are datasets in Studio, not two distinct
Graph products. The two-product composition is **Token API + Subgraph Studio**;
RPC is the comparison reference. See [why these roles matter](PRODUCT_GUIDE.md#the-graph-indexed-observations-that-affect-the-verdict).

## Data flow and block alignment

```text
Studio indexed head -> expected deployment and indexing checks
  -> RPC confirms block hash -> exact accounting reads -> comparison
Token API wallet balance ---------------------------> composition result
```

For unpinned accounting requests, Tare anchors to the indexed head rather than
assuming the indexer has reached RPC's latest block. It confirms that block through
RPC and compares the declared read set at the hash. Explicitly pinned requests
still need provider history and indexed coverage. Share-ledger verification has a
separate RPC-first acquisition path; it must not be described as automatically
using the latest accounting head.

The accounting set contains eight vault reads plus four per market. The retained
12-market case therefore compares 56 values. Verification checks chain, block
number/hash, expected deployment, read identity, duplicates, missing results, and
raw return data. It rejects indexing errors rather than treating partial GraphQL
data as complete agreement.

`verify-graph-composition` combines the Token API balance with eligible Studio
accounting and RPC. Token amount and decimals must agree with the selected RPC
balance. A last-update block newer than the comparison block is unaligned. An
older update is not proof that the Token API offers a historical snapshot.
Source blocks and coverage remain explicit.

## Historical verification without waiting for sync

`verify-historical-graph` queries both the share ledger and accounting from the
historical deployment. It does not use the recent accounting-only deployment for
older blocks. Leave `blockNumber` absent to select the historical indexed head,
or pin an explicit covered block. Both comparisons must agree on the block number,
hash, timestamp, position and pinned deployment. The share ledger must declare
indexing from creation block `18928285`; combined accounting coverage starts at
`25937756`. Indexing errors and missing history produce incomplete evidence.

The API, stdio MCP, CLI and **Investigate → Historical verification** support this
operation. It runs on demand, so normal Explorer checks do not wait for the extra
historical RPC calls. The result shows block time, separate share/accounting
statuses, and non-executable historical scope. Its creation-block coverage is for
this vault through the checked block, not all vaults or the latest chain state.
Replay recomputes the comparisons and preserves a recorded source label. The
historical report is not yet an input to the in-page Recipe explanation flow.

Configure the following in the server environment alongside existing Graph settings:

```text
TARE_GRAPH_HISTORICAL_URL=https://api.studio.thegraph.com/query/1760123/tare-steakhouse-usdc-ethereum/0.1.0
TARE_GRAPH_HISTORICAL_DEPLOYMENT=QmZrGd5mh9V5x57J4ETN9sWVP2P3VMVpRgQ7p5XK9CW1hw
```

`TARE_RPC_URL` must support archive `eth_call` using a canonical block hash.
`GRAPH_API_KEY` remains optional if the configured Graph endpoint requires it.
Never place keyed provider URLs in Git or command examples. The CLI requires
these variables in its process environment; it does not load `.env` automatically.

```sh
pnpm cli verify historical --address <public-wallet> --out historical.capture.json
pnpm cli verify historical-replay historical.capture.json --json
```

Canonical API input: `{"operation":"verify-historical-graph","owner":"<public-wallet>","vault":"0xbeef01735c132ada46aa9aa4c54623caa92a64cb"}`.
Other vaults are rejected. Explicit blocks beyond indexed coverage are not
replaced with latest. Configure both historical environment variables and restart
the server to enable the capability. Hosted API deployment/configuration remains
an operator step; updating code does not change the running server.

The initial public-RPC attempt on 2026-09-13 reached a historical block but
`eth_call` reported pruned state. A later maintainer-supplied hosted capture
replayed successfully as described below. Your deployment still needs archive
access for the chosen block; a successful saved replay does not test that access.

## Historical acceptance record

On 2026-09-13 the maintainer supplied a downloaded hosted report and capture.
Local `verify historical-replay` recomputed the capture and reproduced its
comparison results and digest. Apart from the recorded source mode and added
unsigned-recording limitation, the replay reproduced the original report.
No fresh provider query was made as part of this artifact review.

| Field | Supplied capture / replay result |
| --- | --- |
| Wallet | `0x334f5d28a71432f8fc21c7b2b6f5dbbcd8b32a7b` |
| Vault | `0xbeef01735c132ada46aa9aa4c54623caa92a64cb` |
| Ethereum block | `25941070` |
| Block time | `2026-09-09T16:40:23.000Z` |
| Block hash | `0xfe2786ae9a9a55c81305479f04fcd02bc22fd707e642bc9005ee313c6e567a13` |
| Expected deployment | `QmZrGd5mh9V5x57J4ETN9sWVP2P3VMVpRgQ7p5XK9CW1hw` |
| Capture digest | `sha256:15aef76a7edd8bae70792cc836e714fba548a1e06a68a14e7e9371b822751756` |
| Shares | 4 matched comparisons: asset, share decimals, total shares, owner shares. |
| Accounting | 56 matched comparisons; no findings in the combined report. |
| Coverage | Share ledger starts at `18928285`; accounting at `25937756`; checked through `25941070`. |
| Evidence scope | `currentStateVerified: false`, `executable: false`, backing metric unavailable. |

The source files were supplied outside the repository and are **not bundled**.
The digest identifies their normalized evidence; it is not a provider signature.
To reproduce this exact record, obtain that capture from the maintainer and run
`pnpm cli verify historical-replay <capture-path> --json`. To acquire new evidence,
use the historical command above with the displayed wallet and, optionally,
`--block-number 25941070`.
The website's Historical block field or API `blockNumber` can pin `25941070`.
Leaving it blank selects the historical index's head, which can now differ.

This demonstrates a bounded historical ledger/accounting comparison from supplied
bytes. It does not certify full indexing, all accounts, current ownership, source
independence, loan recovery or solvency. Local HTTP fixtures remain a separate
software test, not this hosted artifact.

## Deployment identifiers

These public identifiers are retained references, not an uptime claim.

| Deployment | Identifier |
| --- | --- |
| Accounting-only version | `tare-live-accounting/0.1.0` |
| Accounting CID | `QmWSiZRvaFzYkohhsM2D9yHD4Nc7ZnZFRWz8pUcwfQi3j2` |
| Historical version | `tare-steakhouse-usdc-ethereum/0.1.0` |
| Historical CID | `QmZrGd5mh9V5x57J4ETN9sWVP2P3VMVpRgQ7p5XK9CW1hw` |
| Vault | `0xbeef01735c132ada46aa9aa4c54623caa92a64cb` |

External query references:
[accounting endpoint](https://api.studio.thegraph.com/query/1760123/tare-live-accounting/0.1.0)
and [historical endpoint](https://api.studio.thegraph.com/query/1760123/tare-steakhouse-usdc-ethereum/0.1.0).
These are GraphQL POST endpoints, not ordinary report pages.

The [full manifest](../graph/subgraph/subgraph.yaml) starts share transfers at
creation block `18928285` and accounting at `25937756`. The separate
[live manifest](../graph/subgraph/subgraph.live.yaml) starts accounting at
`25953741`, near its deployment-time head. It does not contain the complete
creation-block ledger.

## Retained acceptance and missing artifacts

| Evidence | What it supports |
| --- | --- |
| [Subgraph acceptance note](../graph/subgraph/README.md) | Reports 56/56 matches, no indexing errors, and zero mismatches at block `25953771` with the accounting CID pinned. |
| Two-service Recipe test, reported on 2026-09-12 | Reported a healthy Graph head at `25961875` and a 56-read matched Tare result. Raw output is not included in this repository. |
| [Historical supplied capture](#historical-acceptance-record), reviewed 2026-09-13 | Local replay reproduced four share and 56 accounting matches at `25941070`; files remain outside the repository. |
| [Local Graph Node record](../fixtures/integration/graph-node-reorg.json) | Retains actual local indexing and reorg rollback evidence, not mainnet acceptance. |

The hosted notes are historical prose records. Raw hosted Graph/Token API responses
and captures are not attached to those notes in this revision. Collect them for
the demo; the notes alone do not establish repeatable live acceptance.
Zero findings means the tested observations agreed. It does not independently
recompute every economic assumption, prove loan recoverability, or prove backing.

## Reproduction

Root dependencies must be installed and the TypeScript application built. For
mapping builds, install the separate locked Graph dependencies:

```sh
npm ci --prefix graph/subgraph --ignore-scripts --no-audit --no-fund
pnpm build:subgraph
pnpm build:subgraph:live
```

For live accounting, privately configure `TARE_RPC_URL`, `TARE_GRAPH_URL`, and
`TARE_GRAPH_DEPLOYMENT`; use `GRAPH_API_KEY` only if the provider requires it.
The CLI does not load `.env` automatically. Export paths must not already exist.

```sh
pnpm cli verify accounting --vault 0xbeef01735c132ada46aa9aa4c54623caa92a64cb --out accounting.json
pnpm cli verify accounting-replay accounting.json --json
```

For the hosted composition checks, configure the access variables expected by
[the verifier](../scripts/verify-hosted.mjs) and the deployment's
`GRAPH_MARKET_API_TOKEN`. Do not put credentials in command arguments or artifacts.

```sh
pnpm verify:hosted:graph
pnpm verify:hosted:graph-products
```

Those commands query real providers and require working access. For actual local mapping
execution, `pnpm test:graph` requires Docker Linux containers; follow the
[Graph Node runbook](../graph/integration/README.md). Local results are not hosted
Graph product acceptance.

## Why Graph changes the result

The additive two-service agent path accepts an unchanged Graph `data` snapshot
through `/api/agent-compare-accounting` (`tare_compare_indexed_accounting`). It
checks the pinned deployment and read set against independently acquired RPC.
Its source mode, `agent-supplied-graph-live-rpc`, explicitly preserves the fact
that forwarded Graph bytes are caller-supplied, not authenticated by their labels.
This is separate from Tare acquiring Graph evidence itself. See the
[investigation guide](BAZANTIC_INVESTIGATION.md#two-service-graph-path) for the
head-then-snapshot query and tool binding. No schema refresh or Recipe publication
deploys a subgraph or completes historical backfilling.

The verifier consumes Graph observations as comparison inputs. Altered amounts,
wrong deployment IDs, missing reads, block disagreement, or provider errors change
the report's findings or availability. The result cannot claim Graph agreement
when that source is absent. See
[accounting verification](../packages/verification/src/accounting.ts) and
[product composition](../packages/verification/src/graph-composition.ts).

Composition currently targets Ethereum. Other Ethereum vaults can receive a Token
API comparison without the Steakhouse-specific accounting coverage. Broad
multi-protocol indexing, complete historical coverage, and a hosted Substreams
monitor are not product claims. If historical syncing finishes, it still needs
deployment, block, indexing-error, ledger, and RPC acceptance checks before its
coverage can be claimed. Sync percentage alone is insufficient.

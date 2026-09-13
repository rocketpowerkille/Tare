# The Graph integration

This guide separates implemented code, historical acceptance notes, and current
provider availability. It does not certify the current Studio synchronization
percentage. Full historical share-ledger acceptance remains incomplete in the
repository reviewed on 2026-09-13.

## Products and their distinct roles

| Product | Role and scope |
| --- | --- |
| Tare's Studio accounting subgraph | Captures the declared Steakhouse USDC vault and market read set on Ethereum. |
| The Graph Token API | Supplies a wallet's indexed vault-share token balance for product composition. The configured provider defaults to `https://api.pinax.network`. |
| Historical Studio share ledger | Transfer-derived balances and supply from the vault's creation block. Hosted historical acceptance is pending. |
| Standardized Substreams consumer | Local TypeScript monitoring, checkpoint, deduplication, and rollback code. Hosted continuous-provider acceptance is not complete. |

Morpho's GraphQL discovery API is not The Graph. A successful discovery call does
not demonstrate either Studio accounting or Token API verification.

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

## Deployment references

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
| [Phase-four note](PHASE_4.md) | Reports 56/56 matches, no indexing errors, and zero mismatches at block `25953771` with the accounting CID pinned. |
| [Two-service Recipe note](BAZANTIC_MULTI_SERVICE.md) | Reports a healthy Graph head at `25961875` and a 56-read matched Tare result. |
| [Local Graph Node record](../fixtures/integration/graph-node-reorg.json) | Retains actual local indexing and reorg rollback evidence, not mainnet acceptance. |

The hosted notes are historical prose records. Raw hosted Graph/Token API responses
and captures are not attached to those notes in this revision. Collect them for
the demo instead of claiming this documentation review repeated live acceptance.
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

Those commands query real providers and require working access. They were
source-checked, not rerun during the documentation pass. For actual local mapping
execution, `pnpm test:graph` requires Docker Linux containers; follow the
[Graph Node runbook](../graph/integration/README.md). Local results are not hosted
Graph product acceptance. No deployment is required for documentation review.

## Why Graph changes the result

The verifier consumes Graph observations as comparison inputs. Altered amounts,
wrong deployment IDs, missing reads, block disagreement, or provider errors change
the report's findings or availability. The result cannot claim Graph agreement
when that source is absent. See
[accounting verification](../packages/verification/src/accounting.ts) and
[product composition](../packages/verification/src/graph-composition.ts).

Composition currently targets Ethereum. Other Ethereum vaults can receive a Token
API comparison without the Steakhouse-specific accounting coverage. Broad
multi-protocol indexing, full historical acceptance, and a hosted Substreams
monitor are not submission claims. If historical syncing finishes, it still needs
deployment, block, indexing-error, ledger, and RPC acceptance checks before its
coverage can be claimed. Sync percentage alone is insufficient.

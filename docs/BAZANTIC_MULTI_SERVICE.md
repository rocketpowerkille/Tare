# Bazantic multi-service Recipe

This is the remaining Bazantic platform configuration for the two Bazantic prizes
that are not marked Continuity-only. It uses two direct services:

1. Tare, through the existing live gateway.
2. The Graph Studio, through a second gateway generated from
   `https://tare-api.onrender.com/openapi-graph.json`.

The second specification names The Graph Studio as its upstream server. It exposes
one bounded operation, `graph_tare_accounting_head`, which returns the live indexed
block, deployment CID and indexing-error flag. It does not proxy the request through
Tare.

## Bazantic account actions

1. Add a gateway named `Tare Graph index status`.
2. Set its base URL to `https://api.studio.thegraph.com` with no authentication.
3. Set its OpenAPI URL to
   `https://tare-api.onrender.com/openapi-graph.json`.
4. Confirm the generated gateway has one tool named from
   `graph_tare_accounting_head` and test it.
5. Add that gateway and the existing Tare gateway to a new Recipe.
6. Enable only the Graph status tool and Tare's compact live-analysis tool.

## Base Sepolia sandbox acceptance

Bazantic enabled Base Sepolia sandbox settlement for the hackathon. The existing
Tare gateway is in sandbox mode and its MCP server exposes six tools, including
wallet discovery, compact analysis and short-lived session issuance.

Bazantic's sidebar balance currently shows live funds only. For sandbox testing,
fund the Bazantic receiving wallet with Base Sepolia USDC from Circle's testnet
faucet. The dashboard does not currently display this testnet balance, so confirm
the network, token contract and recipient in the faucet transaction before retrying.

1. Confirm the payment quote names Base Sepolia and test USDC before approving it.
2. Call `tare_status` first to prove the paid request lifecycle with the smallest
   response.
3. Call `tare_discover_vaults` with owner
   `0x9fc3dc011b461664c835f2527fffb1169b3c213e`. The indexed result should include
   Steakhouse USDC at `0xbeef01735c132ada46aa9aa4c54623caa92a64cb`.
4. Call `tare_analyze_compact` with that owner, vault and operation `resolve-v1`.
   The result must identify fresh Ethereum evidence and retain the independent
   backing and valuation limitations.

Save evidence of the Base Sepolia quote, completed payment lifecycle, HTTP 200
response and final conservative result. Sandbox settlement proves the Bazantic
payment path; the Tare evidence operation can still read Ethereum because payment
network and evidence network are separate concerns.

## Recipe text

Use the following as the Recipe goal. If Bazantic changes generated tool names,
replace the two names while preserving their roles.

```text
Evaluate whether Tare's current Ethereum MetaMorpho accounting evidence is safe to
use as a bounded, current-state result.

First call graph_tare_accounting_head with its exact default query. Reject the run
if hasIndexingErrors is true, the block hash is missing, or deployment is not
QmWSiZRvaFzYkohhsM2D9yHD4Nc7ZnZFRWz8pUcwfQi3j2.

Then call tare_analyze_compact with operation verify-accounting and vault
0xbeef01735c132ada46aa9aa4c54623caa92a64cb. Do not send a block number. Tare will
anchor to The Graph's current indexed head and independently compare the complete
56-read accounting set through Ethereum RPC.

Return the Graph indexed block and deployment, Tare status, number of matched
checks, findings, evidence digest and a final verdict. The final verdict is matched
only when The Graph is healthy and Tare reports status matched with 56 checks and no
findings. Otherwise return incomplete and list the exact failed condition. State
that this is current-state accounting evidence, not a historical share backfill and
not proof of independently verified asset backing.
```

## Qualification boundary

This flow makes the final result depend on both a direct sponsor service and Tare.
The direct Graph Studio gateway is active at
`https://hgtvwubvqvci5fddvkmksjtkdu.bazgateway.com`. The published Recipe
`tare-graph-accounting-assurance` binds `graph_tare_accounting_head` from that
gateway and `tare_analyze_compact` from the Tare gateway. The first post-deploy run
returned a bounded timeout report at Tare's 20-second acquisition limit. A warm
retry completed successfully on 2026-09-12: The Graph reported a healthy indexed
head at block `25961875` with the expected deployment, and Tare matched all 56
accounting checks with zero findings in `7.94s`. Bazantic returned the Recipe verdict
`matched`. The Recipe was published on 2026-09-12. Preserve this acceptance result.
The paid Base Sepolia sandbox lifecycle remains separate acceptance work.

The hosted Graph product acceptance passed separately on 2026-09-12. It proves
that the deployed Tare service can compose the Token API, Studio and RPC sources;
it does not substitute for the required Bazantic two-service Recipe test.

# Bazantic multi-service Recipe

This runbook preserves the two-service configuration and historical 2026-09-12
acceptance note. It is not a current gateway-health check. Use
[the integration guide](BAZANTIC_INTEGRATION.md) for the current tool inventory and
[the prize review](PRIZE_TRACKS.md) for eligibility. It uses two direct services:

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
Tare gateway was tested in sandbox mode. The current source schema defines five tools, including
wallet discovery, compact analysis and short-lived session issuance.

During the retained test, the sidebar balance did not show Base Sepolia funds.
For sandbox testing, confirm the network, token contract, and recipient in the
testnet funding transaction. Do not infer sandbox funding from a mainnet balance.
Current dashboard behavior was not independently checked in this review.

1. Confirm the payment quote names Base Sepolia and test USDC before approving it.
2. Call `tare_status` to inspect capabilities. Inspect an actual payment result
   separately before claiming settlement.
3. Call `tare_discover_vaults` with owner
   `0x9fc3dc011b461664c835f2527fffb1169b3c213e`. The historical indexed result included
   Steakhouse USDC at `0xbeef01735c132ada46aa9aa4c54623caa92a64cb`.
4. Call `tare_analyze_compact` with that owner, vault and operation `resolve-v1`.
   The result must identify fresh Ethereum evidence and retain the independent
   backing and valuation limitations.

Save evidence of the Base Sepolia quote, completed payment lifecycle, HTTP 200
response and final conservative result. Sandbox settlement proves the Bazantic
payment path; the Tare evidence operation can still read Ethereum because payment
network and evidence network are separate concerns.

The Bazantic Playground is only for testing gateways owned by the current account.
Customers use Tare's public gateway through the Bazantic CLI. Create a bounded
Base Sepolia grant, then call the session route with an explicit POST and empty JSON
body:

```sh
baz grant create --name tare-demo --cap 0.01 --network base-sepolia --service zvnss2njirhqjllnbfsv3sneca
baz curl https://zvnss2njirhqjllnbfsv3sneca.bazgateway.com/api/bazantic/session \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{}' \
  --account tare-demo \
  --max-amount 0.001 \
  --json
```

Review the quote before approving. Copy `body.accessToken` from the successful
response into Tare Explorer without sharing it. The default session lifetime is
15 minutes. A token is authorization evidence, not a settlement receipt.

## Recipe text

Use the following as the Recipe goal. If Bazantic changes generated tool names,
replace the two names while preserving their roles.

```text
Evaluate the scope and consistency of Tare's current Ethereum MetaMorpho
accounting evidence.

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
findings. Preserve Tare's actual status, including mismatch or unavailable, and
list the exact failed condition. If the two calls use different blocks, disclose
that; do not describe the direct Graph head and Tare result as a same-block pair. State
that this is current-state accounting evidence, not a historical share backfill and
not proof of independently verified asset backing.
```

## Qualification boundary

This flow makes the final result depend on both a direct sponsor service and Tare.
The direct Graph Studio gateway was recorded at
`https://hgtvwubvqvci5fddvkmksjtkdu.bazgateway.com`. The published Recipe
`tare-graph-accounting-assurance` binds `graph_tare_accounting_head` from that
gateway and `tare_analyze_compact` from the Tare gateway. The first post-deploy run
returned a bounded timeout report at Tare's 20-second acquisition limit. A warm
retry completed successfully on 2026-09-12: The Graph reported a healthy indexed
head at block `25961875` with the expected deployment, and Tare matched all 56
accounting checks with zero findings in `7.94s`. Bazantic returned the Recipe verdict
`matched`. The Recipe was published on 2026-09-12. This is a retained prose record;
attach the raw result for submission. The guidance above now explicitly preserves
source-block differences and mismatch statuses; it is not a verbatim snapshot of
the historical Recipe. Later maintainer testing reported paid Base Sepolia session
success, but a redacted raw paid response still needs retaining separately.

The historical hosted Graph product note reports a separate pass on 2026-09-12.
It records composition of the Token API, Studio and RPC sources;
it does not substitute for the required Bazantic two-service Recipe test.

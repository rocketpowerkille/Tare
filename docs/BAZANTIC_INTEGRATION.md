# Bazantic integration

Bazantic makes Tare callable by an agent through a gateway and hosted MCP tools,
then supplies reusable Recipe guidance for choosing tools and interpreting results.
The frontend's copy-context convenience is not this execution path.

## Paths and provenance

```text
Browser -> direct Tare API -> evidence report -> optional copy to an assistant
Agent -> published Bazantic Recipe -> gateway/MCP -> Tare -> agent explanation
Customer -> sandbox gateway payment -> short-lived session -> direct Explorer API
Browser report + explicit consent -> Tare temporary context -> Bazantic Recipe
  -> gateway retrieves context pages -> cited answer reviewed and displayed
```

The sandbox session path can authorize a direct API report without making that report a
Recipe execution. A valid session is authorization evidence, not automatically a
settlement receipt and never evidence of vault backing.

## Gateway and actual tools

Public gateway reference:
[Tare](https://zvnss2njirhqjllnbfsv3sneca.bazgateway.com).
Its source specification is [the MCP OpenAPI module](../apps/api/src/openapi-mcp.ts),
served at `/openapi-mcp.json` with existing versioned aliases. Current code defines
seven operations, including two additive investigation tools. The stdio inventory
below remains unchanged.

Use `https://tare.visk404.dev/openapi-mcp-v3.json` when refreshing the Tare
gateway. Refreshing tool specifications does not necessarily add the HTTP routes
to the gateway's serving table; review and apply route changes separately.

| Gateway tool | Operation |
| --- | --- |
| `tare_status` | Inspect configured capabilities before selecting a live check. |
| `tare_discover_vaults` | Find candidate vault positions for a public owner address. |
| `tare_analyze_compact` | Run a supported analysis and return a compact projection. |
| `tare_example_compact` | Replay a named saved example, explicitly not fresh evidence. |
| `tare_start_bazantic_sandbox_session` | Request a short-lived sandbox access session under gateway authorization. |
| `tare_report_context` | Retrieve pages of an expiring, browser-submitted pinned report under the configured gateway identity. |
| `tare_compare_indexed_accounting` | Compare supplied indexed observations with independent pinned RPC without claiming authenticated Graph provenance. |

The independent [local stdio server](../apps/mcp/src/server.ts), started with
`pnpm mcp`, exposes `tare_status`, `tare_analyze`, `tare_replay`, `tare_example`, and
`tare_compose`. Do not substitute those names for the gateway's compact tools.
Live deployment schemas should be refreshed and checked after an API deployment;
this source inventory is not a live gateway-health probe.

## Compact evidence and explanations

[Compact formatting](../packages/receipts/src/compact.ts) reuses full report
semantics. Its additive `explanationContext` provides exact observed and derived
values, eligible price information, source blocks, limitations, classification,
and agent instructions. Bounded-list omission counts disclose when the compact
view cannot include everything. Amount formatting requires actual returned units
and decimals. Missing USD estimates remain missing.

The external agent performs the explanation. Tare has no server-side LLM provider,
model key, or hidden paid explanation call. The optional, disabled-by-default
[investigation assistant](BAZANTIC_INVESTIGATION.md) calls a Bazantic Recipe and
stops on payment challenges. Browser users can also copy context or open
the public Recipe, while the original report, raw JSON, and downloads remain
available. The copy action alone demonstrates neither a gateway call nor payment.

## Recipes and retained status

| Recipe | Evidence and boundary |
| --- | --- |
| [Explain DeFi Vault Evidence Clearly](https://bazantic.com/recipes/explain-defi-vault-evidence-clearly) | The maintainer confirmed publication and testing. The public URL is also configured in the UI. A new controlled raw-versus-guided artifact pair is not retained. |
| `DeFi Vault Backing Evidence Evaluator` | Historical operator testing was reported. It does not establish current gateway health or a controlled performance improvement. |
| `tare-pinned-report-investigation` | Maintainer-reported deployed in-page success on 2026-09-13: saved Steakhouse context, seven sections and linked fact IDs. This is not fresh Graph/Chainlink acceptance, guaranteed free execution or a controlled benchmark. See the [pinned Recipe specification](recipes/pinned-report-investigation.json). |
| `tare-graph-accounting-assurance` | A completed Graph-plus-Tare run at block `25961875` was reported on 2026-09-12. Raw test output is not included in this repository. |

The two-service Recipe uses the separate
[Graph gateway](https://hgtvwubvqvci5fddvkmksjtkdu.bazgateway.com), generated from
`/openapi-graph.json`. Its `graph_tare_accounting_head` operation queries Studio
directly. Tare then checks the relevant accounting set. The final explanation must
depend on both sources and preserve any disagreement or availability failure.

For the plain-language path, start at the specific public Recipe URL above, not
the generic Recipes dashboard or an owner-only Playground. Recipe login, account
permissions, and current payment requirements belong to Bazantic; verify them as
a separate customer rather than assuming an operator test proves customer access.

## Reproduce a Recipe demonstration

1. Open the public Recipe and inspect the selected Tare tools.
2. Ask: "Use the saved Steakhouse USDC example. Explain what the wallet holds and
   whether this evidence independently verifies backing. Preserve exact units,
   source mode, block, findings, and limitations."
3. Inspect calls to `tare_status` and `tare_example_compact` with
   `id: steakhouse-usdc`. An example must remain labeled saved evidence.
4. Confirm the answer separates the contract quote, derived market allocations,
   missing sources, and unknown backing. Save redacted tool output and the answer.
5. For a live Graph demonstration, use the separately configured two-service
   Recipe and preserve the actual Graph block, deployment, calls, and comparison.
   Do not relabel the example run as a live Graph test.

The complete guidance and required seven-part answer structure are in the
[plain-language Recipe specification](BAZANTIC_PLAIN_LANGUAGE_RECIPE.md).

## Sandbox payment and session issuance

The repository implements the upstream authorization check and signed, expiring
session format. Bazantic handles its gateway payment flow. A customer grant must
allow Base Sepolia test USDC and the Tare gateway; a mainnet balance alone is not
proof of testnet funding. `tare-demo` below is a local grant name, not a shared
project account. Use a new name if it already exists.

Install/update the CLI and sign in first. Login manages the Bazantic account; the
grant separately authorizes bounded spending. These examples use Git Bash,
macOS or Linux shell quoting, not PowerShell or Command Prompt:

```sh
npm i -g @bazantic/cli@latest
baz login
baz grant create --name tare-demo --cap 0.01 --network base-sepolia --service zvnss2njirhqjllnbfsv3sneca
baz curl https://zvnss2njirhqjllnbfsv3sneca.bazgateway.com/api/bazantic/session \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{}' \
  --account tare-demo \
  --max-amount 0.001 \
  --yes \
  --json | command node --input-type=module -e 'let input = ""; for await (const chunk of process.stdin) input += chunk; try { const result = JSON.parse(input); const token = result.body?.accessToken; if (result.ok !== true || typeof token !== "string" || !/^tare_sandbox_v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new Error(); console.log(token); } catch { console.error("No access code returned. Check your grant, test USDC balance and gateway availability. Do not paste this error as a code."); process.exitCode = 1; }'
```

Running the session command approves one sandbox request capped at 0.001 test USDC.
Never share the returned access code. Paste the single code printed in the terminal
into Explorer. If extraction reports an error, resolve it before continuing; do not
paste the error as a code.
The default lifetime is 900 seconds; configuration can change it. An authorization
card cannot reconstruct a transaction receipt from that token.

Explorer and Investigate remember an accepted credential in tab-scoped session
storage and revalidate it on reload. Use **Disconnect session** beneath the service
status to clear that tab's credential and reload its workspace before entering a
different key. This removes in-memory reports from the screen, not downloaded
files, and does not revoke the API key, sandbox token or Bazantic grant.

The Explorer and developer setup guides use this token-only command as the primary
access path. It pipes the single session response
through Node.js and prints only a valid-shaped successful token, without using a
clipboard utility or making another network call. Another session call is another
payment request. The command includes `--yes` and a 0.001 cap, so executing it explicitly
approves that bounded testnet request. Copying alone makes no request.
The guide shows a non-working token format
example; do not paste that illustration, quotes, or the whole JSON response.

Historical notes report successful sandbox payment and session issuance. The
redacted raw paid response should still be retained for submission. Operator
Recipe tests use the operator credential and make no payment. Neither path proves
custody or solvency. No paid request was repeated for this documentation task.

## Domain and gateway maintenance

The public application moved to `https://tare.visk404.dev`. The old Render
subdomain is not the canonical URL. Keep historical deployment manifests intact;
their old URL records where that earlier run occurred.

For this deployment set `TARE_PUBLIC_ORIGIN=https://tare.visk404.dev` (no path,
trailing slash or port), preserve existing `TARE_API_KEYS`, and configure the
reverse proxy to preserve the trusted public Host. Set the platform health-check
path to `/healthz`, not an absolute URL. The API accepts only its configured host
and tightly scoped authenticated gateway exceptions; an internal probe host or
port that differs may be rejected. Inspect logs instead of weakening origin checks.

The **Tare gateway upstream** must point to the reachable Tare domain. The
**Graph gateway upstream** remains `https://api.studio.thegraph.com`; importing
Tare's `/openapi-graph.json` does not move the Graph data source onto Tare.
If disabling the old Render URL, first update every caller still using it.
DNS verification and a TLS certificate alone do not update app origin policy.

After deploying new gateway operations, the retained CLI workflow is:

```sh
# Read-only preview of serving-route differences.
baz gateway resync zvnss2njirhqjllnbfsv3sneca --json
# Review the proposal and explicitly confirm only intended route changes.
baz gateway resync zvnss2njirhqjllnbfsv3sneca
```

On 2026-09-13 the maintainer applied the two new context/comparison routes,
bringing the Tare serving table to seven routes. Route additions have pricing;
review those amounts and the sandbox setting rather than assuming a schema
refresh is free or that it changes existing prices. Then check Recipe tool
bindings and a consented run. A gateway 402 challenge alone does not establish
successful forwarding, payment settlement or session issuance.

## Evaluating Recipe output

For a new controlled product demonstration, hold the user prompt, model, settings,
API/MCP access, and input evidence constant. Change only Recipe guidance. Preserve
both raw answers, tool calls, latency, token usage when available, and factual
review. Use saved evidence in both runs if reproducibility is the priority; use
live evidence in both if demonstrating live access, and disclose block changes.
One pair is not a general benchmark. A controlled comparison of the current
plain-language Recipe is not included in this repository.

## Limitations

Gateway configuration, Recipe execution, Tare evidence acquisition, and settlement
are separate acceptance checks. Hosted availability was not retested in the
documentation verification. Credentials, session tokens, and payment authorizations must
never enter published evidence. No API or payment-contract changes are required
for the copy-context UI.

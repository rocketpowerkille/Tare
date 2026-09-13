# In-page investigation assistant

The optional assistant submits classified, pinned report context to a Bazantic
Recipe and shows its cited answer inside Explorer. Existing reports, source
details, limitations, downloads, copy-context and external Recipe paths remain.
No LLM SDK, model key or payment signer is added.

## Execution and payment

Each run discovers the execution URL from Bazantic's public MCP initialization,
validates its HTTPS gateway destination, checks the Recipe catalog, and calls the
configured tool. Requests carry no payer credentials. HTTP 402 stops the run:
there is no signing, payment or automatic retry. Maximum authorized spend is zero.
An Explorer session does not authorize Recipe payments.

On 2026-09-13, an unsigned development probe of the existing public explanation
Recipe unexpectedly returned an answer rather than a payment challenge. No receipt
was returned. This does not establish permanent free access or a payment network,
and does not establish acceptance of the new pinned-context Recipes.

Later on 2026-09-13, the maintainer reported a successful deployed
`tare-pinned-report-investigation` answer for the saved Steakhouse report. The
display contained seven sections and linked fact IDs after response-format fixes.
That is a reported in-page product result, not a retained raw execution artifact,
fresh source acceptance, permanent free service or a general correctness claim.
The wallet and indexed-accounting JSON specifications are separate Recipes;
their presence in the repository does not establish publication or acceptance.

Paid sponsorship remains disabled. Enabling it requires network confirmation,
an appropriately scoped grant, explicit spending approval, and durable spend and
idempotency accounting. Do not assume a Tare-service grant covers a Recipe gateway.

## Report context and limits

The user explicitly consents to sending classified facts and a question. The API
assigns stable fact IDs to the displayed primary report and separate source
modules. An expiring random reference lets the configured gateway API identity
retrieve pages. Ordinary Explorer sessions cannot read another user's reference.
The Recipe must retrieve every page and cite exact fact IDs. Invalid structure,
missing retrieval or invented citations withhold its answer. These are structural
checks, not a guarantee of model accuracy. Original evidence stays visible.

Context is labeled browser-submitted, not independently authenticated. The pure
projector allowlists evidence facts and retains omission notices. Credential-like
fields are rejected. Do not put secrets in reports or questions. Raw captures are
not sent to the model. Bazantic may retain execution data after Tare expires it.

Storage is process-local: 10-minute retention, 64 snapshots globally, 8 per access
identity, 1 MiB request limit and 512 facts / 512 KB context maximum. At most two
Recipe executions run at once, with five runs per identity per retained window.
Duplicate request IDs or identical snapshot/question pairs reuse one record.
Failures are not automatically retried. Restart loses references and records.
Use one API instance; multi-instance support needs shared storage first. This is
not a durable paid-execution ledger.

Execution records show the local run ID, Recipe handle, snapshot digest,
timestamps, elapsed time and returned gateway. Cost, settlement, model usage and
internal tool traces are not invented when the upstream omits them.

Failed runs include a safe diagnostic stage (discovery, catalog, execution or
response), local error code, and HTTP/MCP numeric status or an allowlisted upstream
tool-error code when available. Remote error prose and arbitrary error data are
never exposed. `no_tool_calls` means Bazantic reported no tool calls, not that the
vault evidence failed or that payment settled. A diagnostic run without a report
reference cannot establish why a different, report-backed execution failed.

Answers withheld for review include fixed reasons and expected/retrieved context
page counts. Invalid JSON, schema, section order, unknown citations, unread pages
and sensitive output remain separate failures. Rejected answer text and unknown
citation values are not included in diagnostics. These diagnostics do not weaken
the existing answer-validation rules or authorize a retry.

The response adapter accepts a structured answer, bare JSON, or one explicit JSON
code block surrounded by model narration. Narration is discarded, not rendered as
evidence. Multiple code blocks, competing outside JSON objects and malformed JSON
remain rejected. The exact seven-section schema, citation IDs, sensitive-output
screening and all-page retrieval requirements still apply to the extracted answer.

## Wallet, gaps and comparison

The in-page wallet pipeline reuses Tare discovery and analysis: up to ten
candidates, at most three supported positions, plus eligible Graph and Chainlink
checks. It preserves separate source blocks. Its subsequent Recipe answer uses
those reports. The acquisition pipeline is deterministic Tare orchestration, not
an autonomous Recipe call. A separate wallet Recipe supports agent-driven use.

The pinned-report Recipe covers explanation, disagreement, evidence gaps and next
checks. It must distinguish supported accounting/price comparisons from backing
claims for which Tare has no independent evidence. Repeating unavailable queries
cannot establish backing.

A previous report can be attached. The original unique-field comparison remains.
An additive bounded comparison checks matching position identity, compatible units
and increasing confirmed blocks, then calculates exact raw differences and matches
markets by identity. `comparison.scope` and `comparison.change.N` facts are citeable.
Wallet context also includes scoped shared-market overlap facts. Differences are
not proof of cause, profit, loss or a transaction. See
[change investigation and overlap](CHANGE_INVESTIGATION.md) for coverage and limits.

## Using it in Explorer

1. Connect if the deployment requires access, then run a supported check or a
   saved example. A saved example stays historical in the explanation.
2. In **Ask about this report**, choose a question or type up to 1500 characters.
   Optionally attach a previous report JSON, not a raw capture.
3. Read the transfer notice and explicitly check consent. Only then select
   **Ask with Bazantic**. The technical report remains available while it runs.
4. Follow citations to the exact classified facts. Read the omission notice and
   full report as well; a bounded context is not the full report.
5. Inspect the Recipe execution record. `complete` means structural checks passed,
   not that every sentence was fact-checked. `review-required` withholds an
   invalid answer. `unavailable` includes upstream, payment or timeout failures.

Copy context and the external public Recipe remain separate alternatives. They do
not automatically execute the configured pinned-report Recipe. A temporary
reference is neither a public report permalink nor an Explorer access code.
For exact route bodies and statuses, see the [API reference](API_REFERENCE.md).

## Two-service Graph path

`graph_tare_accounting_head` retains its name and old query. An additive snapshot
query accepts the exact head block hash and vault and returns indexed reads.
Pass the unchanged Graph `data` object to `tare_compare_indexed_accounting`.
Tare checks the configured deployment, pins independent Ethereum RPC, and reuses
the existing exact accounting comparator. The new source mode is
`agent-supplied-graph-live-rpc`: forwarded Graph bytes are not independently
authenticated merely by a matching deployment string. Agreement is not backing.
Existing acquisition/replay operations remain unchanged. No Graph deployment is
performed by this feature.

## Operator activation

1. Deploy with `TARE_RECIPE_ENABLED` unset. Preserve all existing auth secrets.
2. Refresh the **Tare gateway** tools from
   `https://tare.visk404.dev/openapi-mcp-v3.json`. Confirm the additive
   `tare_report_context` and `tare_compare_indexed_accounting` tools.
   Also preview and apply the serving-route resync described in the
   [gateway maintenance guide](BAZANTIC_INTEGRATION.md#domain-and-gateway-maintenance).
   A visible MCP tool with no serving route can still return 404.
3. For the two-service path, refresh the **Graph gateway specification** from
   `https://tare.visk404.dev/openapi-graph.json`. Its upstream remains Graph Studio,
   not the Tare domain.
4. Create new drafts from these files; leave existing working Recipes published:
   - [Pinned report investigation](recipes/pinned-report-investigation.json)
   - [Wallet investigation](recipes/wallet-investigation.json)
   - [Indexed accounting investigation](recipes/indexed-accounting-investigation.json)
5. Review tool bindings and model availability. The model ID reflects the
   previously used Haiku setting; confirm it is offered. Empty output examples
   intentionally avoid fabricated acceptance. Test and publish the drafts.
   For the pinned Recipe, keep only `tare_report_context` and the exact JSON
   output instructions in its specification. Do not paste the older public
   explanation Recipe's prose-only instructions into this Recipe. Its input is
   the string `question`; the runner adds the temporary reference and format rules.
6. Set `TARE_RECIPE_ENABLED=true` and `TARE_INVESTIGATION_RECIPE` to the actual
   published pinned-report handle, including any generated suffix. Restart.
   This enables unsigned execution only, never payment.
7. Run a report, consent to context transfer and ask a question. Check citations,
   exact units, source blocks, unknowns and the execution record. A 402 is a stopped
   execution, not permission to use the operator's balance.

The pinned Recipe needs a fresh reference from the same publicly reachable Tare
instance. It cannot retrieve a reference stored only on unreachable localhost.
Do not expose a development server or change gateway routing without approval.

## Troubleshooting without weakening evidence checks

| Symptom | Check |
| --- | --- |
| Disabled | Read authenticated `/api/investigation/options`; review the enable flag and published handle. |
| `recipe-not-published` | The configured handle must be present in Bazantic's public tool catalog, not merely a dashboard draft. |
| `tool_failed` or gateway 404 | Confirm the Tare upstream domain, serving-route resync, tool binding and gateway identity. |
| Missing context pages | The reference must be fresh and on the same reachable API process; the Recipe must read page 0 through `pages - 1`. |
| Invalid JSON/schema/order | Use the pinned Recipe's seven-section JSON contract. A prose-only answer belongs to the separate public Recipe. |
| Unknown citations | Cite exact returned fact IDs; do not invent or rewrite them. |
| Sensitive output | Never return the reference or credentials. Diagnostics deliberately omit rejected text. |
| Payment challenge | Execution stops with zero authorized spend. Do not add a payer or retry automatically. |
| Timeout | Remote execution may still finish. A local timeout is not proof that nothing ran. Inspect the existing record before a new attempt. |

The client has a 120-second overall upstream deadline and a 512,000-byte response
limit. The browser polls every four seconds for up to 135 seconds. Same-key or
same-snapshot/question requests reuse a retained run rather than retrying it.
These limits do not promise upstream latency or completion.

## Acceptance and controlled comparison

Local fixtures test software behavior, not hosted Bazantic acceptance. Test a
supported position, incomplete evidence, disagreement and an unsupported request
on the deployed bindings. Capture question, input digest, blocks, Recipe/model
settings, raw answer, citations, latency and confirmed cost only when provided.
Redact access credentials and temporary report references.

For baseline versus guided runs keep prompt, model, settings, evidence and tool
access constant; change only Recipe guidance. Preserve both outputs and check
unit formatting, source attribution and safety overclaims. One successful pair
is a controlled demonstration, not a general benchmark.

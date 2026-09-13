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

A previous report can be attached. Comparison requires matching network, wallet,
vault and operation, and pairs only unique fact fields. Both values remain intact;
no cross-unit arithmetic is performed. Repeated allocations are not paired by
array order. Differences are not proof of profit, loss or a transaction.

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
6. Set `TARE_RECIPE_ENABLED=true` and `TARE_INVESTIGATION_RECIPE` to the actual
   published pinned-report handle, including any generated suffix. Restart.
   This enables unsigned execution only, never payment.
7. Run a report, consent to context transfer and ask a question. Check citations,
   exact units, source blocks, unknowns and the execution record. A 402 is a stopped
   execution, not permission to use the operator's balance.

The pinned Recipe needs a fresh reference from the same publicly reachable Tare
instance. It cannot retrieve a reference stored only on unreachable localhost.
Do not expose a development server or change gateway routing without approval.

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

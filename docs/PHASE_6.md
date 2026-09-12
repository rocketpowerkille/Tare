# Phase six — event-driven monitoring

Local V1 monitoring is implemented. Hosted Substreams + Graph/RPC acceptance is
pending provider configuration. The worker is read-only and emits local JSON;
it does not send external notifications or execute transactions.

The deadline path for the composable-products prize no longer depends on waiting
for a stream event. `verify-graph-composition` combines The Graph Token API with
the live Studio accounting subgraph, then checks both products against Ethereum
RPC at the subgraph block. The Substreams worker remains the continuous monitoring
path and demonstrates cursor, replay and undo handling.

Configure `GRAPH_MARKET_API_TOKEN` with the JWT from The Graph Market and run:

```sh
pnpm cli verify graph-products --address YOUR_PUBLIC_ADDRESS --vault SUPPORTED_V1_VAULT --json
pnpm verify:hosted:graph-products
```

The hosted command uses the known public Steakhouse USDC position. A successful
acceptance must report two live Graph products, equal Token API and RPC share
balances, a matched Studio accounting result, 56 accounting reads and no findings.

## Run

Build with `pnpm build`. Download the published package from
[ethereum-common v0.3.3](https://spkg.io/streamingfast/ethereum-common-v0.3.3.spkg)
to a local path. Tare verifies its SHA-256 before parsing it:
`67cfcb8f52a65611d80d2fd6ee951ecb77d848ddcbda0eb5aac839e880b1e020`.

Configure `TARE_RPC_URL`, `TARE_GRAPH_URL`, `TARE_GRAPH_DEPLOYMENT`,
`SUBSTREAMS_API_TOKEN` and, when needed, `GRAPH_API_KEY` in the process environment.
`TARE_SUBSTREAMS_URL` defaults to `https://mainnet.eth.streamingfast.io`.
The program does not load `.env` automatically.

```sh
pnpm cli monitor run --address YOUR_PUBLIC_ADDRESS --vault SUPPORTED_V1_VAULT --block-number START_BLOCK --spkg LOCAL_PACKAGE_PATH --home .tare/monitor/position --max-blocks 1000
pnpm cli monitor status --home .tare/monitor/position
pnpm cli monitor replay LOCAL_RECORDING_PATH
```

Replace the uppercase placeholders. `--stop-block-number` sets an exclusive end;
`--max-blocks` bounds block messages per invocation (default 1000, maximum 100000).
Restart with the same position, start block and provider configuration to resume.
`--home` is the dedicated monitor state directory, not the wallet-profile root.
Use Ctrl+C to stop. No credentials are written into checkpoints or captures.

## Behavior and boundaries

- Consumes `filtered_events` from the existing package, filtering the selected
  V1 vault and Morpho Blue. No custom Rust module or duplicated accounting.
- Coalesces matching events into one recheck per block. Shared Blue activity may
  trigger extra checks for unrelated markets; this conservative filter avoids
  maintaining a second interpretation of allocation state.
- Reuses V1 resolution and Graph/RPC share verification at the stream block.
  A different RPC block hash prevents checkpoint advancement. Valid incomplete
  or mismatched reports remain explicit observations; they may advance progress.
- Alerts identify share, allocation, fee or evidence changes. USD prices, passive
  interest accrual without events, V2 positions and arbitrary portfolios are not
  monitored. There is no periodic refresh guarantee during event-free intervals.
- Stores cursor, recent observations and alerts together through a flushed file
  and atomic rename. Captures are saved first under their content digest. Read,
  validation or persistence exceptions leave the previous cursor intact.
- Deduplicates by chain/block hash/transaction hash/block-wide log index and
  validates replay consistency. Undo restores the prior baseline, persists the
  undo cursor and emits a retraction listing invalidated alert IDs.
- Retains 128 block entries and 256 recent alerts. Deeper undo stops for an
  explicit replay from an earlier start into a new state directory. Captures are
  retained separately and need operator-managed disk retention.
- A worker lock prevents simultaneous writers. After a crash, verify the saved
  PID is no longer running before removing `worker.lock`. Locks are not stolen.
- Reconnects with bounded backoff; five consecutive stream failures stop the run.
  Stdout is best-effort, not exactly-once delivery. `monitor status` recovers the
  retained alert journal after a crash. Event-free blocks may be filtered upstream.
- Checkpoint scope binds position, start, package/filter, provider identities and
  deployment. A different configuration needs a separate state directory.
- Lending backing and its numerical metric remain unavailable. Captures are
  unsigned; replay recomputes evidence and cannot authenticate a live provider.

Offline replay accepts `{version:1, sourceMode:"recorded-substreams", position,
startBlock, frames:[{frame, evidence?}]}`. Block frames carry `block:{number,hash}`,
`cursor`, and `events:[{address,transactionHash,logIndex}]`; undo frames carry their
last valid `block` and `cursor`. Supply the existing composition input as `evidence`
for each relevant new block. Replayed duplicates and undo need no new evidence.

## Verification

`pnpm verify` includes protobuf decoding, local gRPC request/response acceptance,
reconnect, restart, event deduplication, rollback, retained-history limits, failed
reads/writes and CLI replay. These are local tests, not hosted execution evidence.
The published package checksum, descriptor and request construction were also
checked locally. Live acceptance must retain provider execution, re-resolution
and aligned Graph/RPC captures when configuration resumes.

Protocol references: [Substreams JavaScript SDK](https://github.com/substreams-js/substreams-js),
[cursor and undo semantics](https://docs.substreams.dev/reference-material/core-concepts/reliability-guarantees).

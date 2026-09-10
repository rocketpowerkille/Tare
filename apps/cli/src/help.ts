export const help = `Tare 0.1.0 — exposure CLI with offline replay and read-only live sources

  tare live nested --address <owner> --vault <V2-vault> [--rpc-url <url>] [--block-number <n>] [--json] [--out <capture.json>]
  tare live nested-replay <capture.json> [--json]
  tare verify accounting --vault <V1-vault> [--rpc-url <url>] [--graph-url <url>]
       [--graph-deployment <CID>] [--block-number <n>] [--json] [--out <capture.json>]
  tare verify accounting-replay <capture.json> [--json]
  tare verify custody --address <holder> [--rpc-url <url>] [--secondary-rpc-url <url>]
       [--block-number <n>] [--json] [--out <capture.json>]
  tare verify custody-replay <capture.json> [--json]

  tare demo [control|deep|degraded|cycle|all|phase2|phase4] [--json]
  tare resolve <snapshot.json> [--wallet <name>] [--json] [--out <receipt.json>]
       [--max-depth <1..128>] [--max-visits <1..100000>] [--max-edges <1..100000>]
  tare replay <recording.json> [--wallet <name>] [--json] [--out <receipt.json>]
  tare snapshot normalize <recording.json> --out <snapshot.json>
  tare snapshot validate <snapshot.json>
  tare live discover [--address <0x...>] [--vault <0x...>] [--max-positions <1..500>] [--json]
  tare live resolve --address <0x...> --vault <0x...> --rpc-url <https://...> [--json]
  tare live example --rpc-url <https://...> [--out <receipt.json>] [--capture-out <capture.json>]
  tare live replay <capture.json> [--json]
       Live reads: Ethereum USDC MetaMorpho V1 only; --wallet may replace --address.
       Optional: --block-number, --max-markets, --max-calls, --deadline-ms, --graphql-url.
  tare verify shares --address <0x...> --vault <0x...> --rpc-url <url> --graph-url <url>
       [--block-number <number>] [--graph-deployment <CID>] [--json] [--out <report.json>]
  tare verify replay <report.json> [--json] [--out <report.json>]
       Requires Tare share-ledger subgraph; share agreement does not verify backing.
  tare wallet add <name> --address <0x...> --chain-id <number>
  tare wallet list
  tare wallet show <name>
  tare wallet balance <name> --rpc-url <https://...> [--symbol <symbol>]
       [--decimals <0..36>] [--timeout-ms <100..60000>] [--json]
  tare wallet remove <name>
  tare monitor run --address <0x...> --vault <0x...> --block-number <start>
       --spkg <ethereum-common-v0.3.3.spkg> --home <state-directory>
       [--stop-block-number <exclusive-end>] [--max-blocks <1..100000>]
       Requires configured RPC, Graph/deployment and SUBSTREAMS_API_TOKEN; read-only V1 monitoring.
  tare monitor replay <recording.json>
  tare monitor status --home <state-directory>
       JSON output; resumable checkpoints and retained alerts. Default run limit: 1000 block messages.

Wallet commands accept --home <directory>; resolve --wallet does too.
Default profile directory: TARE_HOME or .tare in the current directory.
Watch-only profiles store public addresses only. Balance reads are opt-in and never sign.
RPC URLs may also be supplied through TARE_RPC_URL instead of --rpc-url.
Legacy snapshots and demo cases are synthetic. Live captures retain RPC observations.
Complete live accounting is not independently verified backing or valuation.
Exit codes: 0 success; 1 invalid input/I/O; 2 partial resolution.
Receipt outputs are created exclusively. Monitor checkpoints are atomically replaced under a worker lock.`;

export const help = `Tare 0.1.0 — exposure CLI with offline replay and read-only live sources

  tare live nested --address <owner> --vault <V2-vault> [--rpc-url <url>] [--block-number <n>] [--json] [--out <capture.json>]
  tare live nested-replay <capture.json> [--json]
  tare verify accounting --vault <V1-vault> [--rpc-url <url>] [--graph-url <url>]
       [--graph-deployment <CID>] [--block-number <n>] [--json] [--out <capture.json>]
  tare verify accounting-replay <capture.json> [--json]
  tare verify graph-products --address <owner> --vault <V1-vault>
       [--rpc-url <url>] [--graph-url <url>] [--graph-deployment <CID>]
       [--json] [--out <capture.json>]
       Requires GRAPH_MARKET_API_TOKEN. Composes live Token API and Studio data,
       then checks both against RPC at the Studio accounting block. Endpoint: TARE_GRAPH_TOKEN_API_URL.
  tare verify graph-replay <capture.json> [--json]
  tare verify custody --address <holder> [--rpc-url <url>] [--secondary-rpc-url <url>]
       [--block-number <n>] [--json] [--out <capture.json>]
  tare verify custody-replay <capture.json> [--json]
  tare verify base-custody --address <owner> --deployment <deployment.json>
       [--rpc-url <url>] [--secondary-rpc-url <url>] [--block-number <n>]
       [--json] [--out <capture.json>]
  tare verify base-custody-replay <capture.json> [--json]

  tare demo [control|deep|degraded|cycle|all|phase2|phase4] [--json]
  tare resolve <snapshot.json> [--wallet <name>] [--json] [--out <receipt.json>]
       [--max-depth <1..128>] [--max-visits <1..100000>] [--max-edges <1..100000>]
  tare replay <recording.json> [--wallet <name>] [--json] [--out <receipt.json>]
  tare snapshot normalize <recording.json> --out <snapshot.json>
  tare snapshot validate <snapshot.json>
  tare live discover [--address <0x...>] [--vault <0x...>] [--chain-id <1|8453|42161>] [--max-positions <1..500>] [--json]
  tare live resolve --address <0x...> --vault <0x...> [--chain-id <1|8453|42161>] [--rpc-url <https://...>] [--json]
  tare live example --rpc-url <https://...> [--out <receipt.json>] [--capture-out <capture.json>]
  tare live replay <capture.json> [--json]
       V1 reads: Ethereum, Base and Arbitrum; --wallet may replace --address.
       CLI discovery is Morpho-only; Euler discovery and generic ERC-4626 analysis use the HTTP API.
       Nested V2 traversal remains limited to supported Ethereum USDC vaults.
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
V1 RPC defaults: TARE_RPC_URL (Ethereum), TARE_BASE_MAINNET_RPC_URL (Base), TARE_ARBITRUM_RPC_URL (Arbitrum).
Legacy snapshots and demo cases are synthetic. Live captures retain RPC observations.
Complete live accounting is not independently verified backing or valuation.
Exit codes: 0 success; 1 invalid input/I/O; 2 partial resolution.
Receipt outputs are created exclusively. Monitor checkpoints are atomically replaced under a worker lock.`;

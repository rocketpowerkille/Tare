# Local setup, CLI and verification

This guide describes repository commands. It does not deploy services, fund
wallets or establish live partner acceptance. Use Node 24+ and the pinned pnpm
11.19.0. From the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm serve
```

The default URL is `http://127.0.0.1:4318`. Rebuild after edits; there is no `dev`
script. Saved examples work without RPC credentials. Live discovery may contact
public indexers even when no RPC is configured; discovery alone is not analysis.

## Configuration

The server and CLI do not automatically load `.env`. Set environment variables
in the process environment, or use Node's explicit loader after building:

```sh
node --env-file=.env dist/apps/api/src/main.js
node --env-file=.env dist/apps/cli/src/main.js --help
```

Review [.env.example](../.env.example) before copying it: its active bottom section
contains historical Base Sepolia simulator defaults, sets port 4320 and refers
to an already-consumed test position. Those defaults are not a fresh executable
setup. Never put actual provider credentials, API tokens or wallet keys in Git.

| Capability | Configuration and boundary |
| --- | --- |
| Ethereum reads | `TARE_RPC_URL`; a second distinct `TARE_SECONDARY_RPC_URL` is needed for WETH custody. |
| Base / Arbitrum reads | `TARE_BASE_MAINNET_RPC_URL` / `TARE_ARBITRUM_RPC_URL`; selecting a chain never falls back to Ethereum's RPC. |
| Morpho discovery | Web/API `TARE_MORPHO_URL`, default `https://api.morpho.org/graphql`. CLI uses `--graphql-url`. |
| Euler discovery | Web/API enabled by default through `TARE_EULER_API_URL`, default `https://v3.euler.finance/v3`; disable with `TARE_EULER_DISCOVERY=false`. No payer or API key is added. |
| Additional ERC-4626 vaults | `TARE_ERC4626_REGISTRY`: JSON array of at most 25 `{chainId,vault,name,protocol}` entries. Reads require that chain's RPC. Missing or incomplete registry reads make discovery incomplete. |
| Graph accounting / shares | `TARE_GRAPH_URL`, `TARE_GRAPH_DEPLOYMENT`, Ethereum RPC; `GRAPH_API_KEY` when required. Choose the appropriate accounting or share-ledger deployment. |
| Graph product composition | Also requires `GRAPH_MARKET_API_TOKEN`; endpoint override `TARE_GRAPH_TOKEN_API_URL`. Studio coverage remains vault-specific. |
| Historical shares + accounting | `TARE_GRAPH_HISTORICAL_URL`, `TARE_GRAPH_HISTORICAL_DEPLOYMENT` and archive-capable `TARE_RPC_URL`. Uses the historical deployment for both comparisons; leaves the recent endpoint unchanged. See [setup and acceptance](GRAPH_INTEGRATION.md#historical-verification-without-waiting-for-sync). |
| Hosted HTTP | `TARE_PUBLIC_ORIGIN` plus JSON `TARE_API_KEYS`; `TARE_REQUESTS_PER_MINUTE` defaults to 60, range 1–600. Use unique 32–128 character base64url tokens. |
| Listen address | `TARE_BIND_HOST` defaults to `127.0.0.1`; `0.0.0.0` requires hosted access. `TARE_PORT` overrides platform `PORT`, otherwise 4318. TLS terminates at the configured ingress. |
| Render origin fallback | Platform `RENDER=true` and `RENDER_EXTERNAL_URL` supply the origin only when `TARE_PUBLIC_ORIGIN` is absent. |
| Bazantic sessions | `TARE_BAZANTIC_CLIENT_ID`, `TARE_BAZANTIC_SESSION_SECRET`, `TARE_BAZANTIC_GATEWAY_URL`; optional `TARE_BAZANTIC_SESSION_MINUTES`. The client must match the gateway's configured API-key identity. |
| In-page Recipe | `TARE_RECIPE_ENABLED=true`, `TARE_INVESTIGATION_RECIPE` set to a published handle. Default disabled; one reachable API instance, temporary storage, zero authorized spend. |
| Monitoring | Ethereum RPC, Graph URL/deployment, `SUBSTREAMS_API_TOKEN`; optional `TARE_SUBSTREAMS_URL`. Requires the pinned event package and a writable checkpoint directory. |
| Base Sepolia custody | `TARE_BASE_RPC_URL`, distinct `TARE_BASE_SECONDARY_RPC_URL`, allowlisted JSON `TARE_BASE_CUSTODY_DEPLOYMENT`; separate from Base mainnet. |
| Local wallet profiles | `TARE_HOME` or `--home`, otherwise `.tare` in the current directory. Public watch-only addresses only. |

For hosted access, gateway changes and Recipe activation use the
[Bazantic runbook](BAZANTIC_INTEGRATION.md) and
[assistant activation guide](BAZANTIC_INVESTIGATION.md#operator-activation).
CRE has its own targets and secret configuration; follow the
[Chainlink guide](CHAINLINK_CONFIDENTIAL_WORKFLOW.md), not the read-only CLI steps.

## CLI command coverage

Run `pnpm cli --help` for flags. In this table each command follows `pnpm cli`.
The CLI's `live discover` queries Morpho on one selected chain, default Ethereum;
use `--chain-id 8453` for Base or `--chain-id 42161` for Arbitrum. Euler discovery,
generic ERC-4626 analysis and in-page Recipe execution are HTTP operations, not
additional CLI subcommands. Local stdio MCP also has a different tool inventory;
see the [HTTP/MCP reference](API_REFERENCE.md).

| Command | Input / result |
| --- | --- |
| `demo` | Synthetic `control`, `deep`, `degraded`, `cycle`, `all`, `phase2` or `phase4` cases. |
| `wallet add`, `list`, `show`, `remove` | Manage named public address/chain profiles; no signing or secret storage. |
| `wallet balance` | Opt-in native balance read through the selected RPC; not token or vault discovery. |
| `resolve` | Resolve a synthetic normalized snapshot; optional wallet binding and traversal budgets. |
| `replay` | Normalize and resolve a synthetic adapter recording. |
| `snapshot normalize`, `snapshot validate` | Convert a recording or validate a normalized snapshot. |
| `live discover` | Indexed Morpho V1/V2 candidates filtered by owner or vault; not block-aligned. |
| `live resolve` | Morpho V1 RPC accounting/traversal on Ethereum, Base or Arbitrum. |
| `live example` | Discover a current public depositor and perform live V1 reads. The default example vault is Ethereum-specific. |
| `live replay` | Recompute a retained V1 RPC capture without network access. |
| `live nested`, `live nested-replay` | Supported Ethereum USDC V2-to-V1 traversal or capture replay. |
| `verify shares`, `verify replay` | Share-ledger/RPC comparison or replay of its verification report. |
| `verify accounting`, `verify accounting-replay` | Vault/market accounting comparison or capture replay. |
| `verify graph-products`, `verify graph-replay` | Token API + Studio + RPC composition or replay. Use `TARE_GRAPH_TOKEN_API_URL` for an endpoint override; the root CLI parser does not accept `--token-api-url`. |
| `verify custody`, `verify custody-replay` | Ethereum WETH wrapper custody control or replay. |
| `verify base-custody`, `verify base-custody-replay` | Allowlisted Base Sepolia custody control or replay; no exit transaction. |
| `monitor run`, `monitor replay`, `monitor status` | Bounded read-only Ethereum V1 stream evaluation, saved-stream replay or checkpoint inspection. |

Live V1 reads can use a matching `--wallet` profile instead of `--address`.
`--rpc-url` overrides the corresponding chain environment setting. Provider
secrets are better supplied through the local environment than command history.
`live example` is a real network operation; it is not the saved website example.

Monitor `--stop-block-number` is exclusive. The default run consumes at most 1000
block messages; `--max-blocks` accepts 1–100000. The store uses a worker lock,
atomic checkpoints and reorg rollback. See [the Graph guide](GRAPH_INTEGRATION.md)
and `pnpm cli --help` for required `--spkg`, position and state-directory inputs.
Implemented recovery logic does not establish a running hosted monitor.

## Files and exit status

- A **capture** stores source observations for compatible replay. A **report**
  stores interpreted results. Synthetic snapshots/recordings are separate formats.
- `live resolve/example/replay --out` writes a report; `--capture-out` writes its
  capture. The two paths must differ. Nested, accounting, historical, Graph-product and custody
  `--out` options write captures. Share verification `--out` writes its report.
- Ordinary CLI outputs use exclusive creation and refuse to overwrite a file.
  Monitor checkpoints are deliberately replaced atomically under the store lock.
- Browser Examples accepts a capture matching the selected check type. Two-block
  comparison accepts reports under 1 MiB each; replay a capture first if needed.
- Exit `0` indicates command success, `1` invalid input or an operational failure,
  and `2` a partial/unmatched/incomplete result where that command defines it.
  Read the result's status and limitations; success is not proof of backing.

## Verification

```sh
pnpm verify
pnpm test:web
```

`verify` builds the web and TypeScript code, runs core tests and CLI examples,
then replays saved evidence. It does not run browser, Graph Node, CRE or Foundry
acceptance. Those are separate checks in [CI](../.github/workflows/ci.yml).

For browser regressions, keep `pnpm serve` running in another terminal. Install
Playwright and its browser in your local tooling environment if unavailable.
`TARE_UI_ORIGIN` selects the local server (default `http://127.0.0.1:4318`),
`TARE_PLAYWRIGHT_MODULE` can point to an installed Playwright package, and
`TARE_BROWSER_CHANNEL` can select an installed channel such as `chrome`.
Then run `pnpm test:web:browser`. Fixture scenarios make no payments and are not
live provider acceptance. Screenshots stay in ignored `tmp/ui-review`.

`node scripts/verify-investigation-ui.mjs` separately starts a local fixture API
and tests in-page Recipe consent, citations, errors and payment blocking; it uses
`TARE_PLAYWRIGHT_MODULE` and requires installed Chrome. Neither browser runner
is intended to test the hosted production origin with private credentials.

`pnpm verify:hosted`, `pnpm verify:hosted:graph` and
`pnpm verify:hosted:graph-products` are live checks. Their endpoint/token setup and
evidence requirements are separate from local fixtures; inspect the
[verifier](../scripts/verify-hosted.mjs) before running them.

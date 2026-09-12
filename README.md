# Tare

**Phases two and three are implemented within their documented scope:** evidence
snapshots and offline adapters, plus live Ethereum USDC MetaMorpho V1 discovery,
allocation accounting and reproducible RPC receipts. See [phase two](docs/PHASE_2.md)
and [phase three](docs/PHASE_3.md) for acceptance evidence and limitations.

**Phase four implementation and local acceptance are delivered:** share and
underlying accounting indexing, real Graph Node rollback tests, live V2→V1→Blue
resolution, timestamped prices and a real WETH custody 1x control. The deadline-safe
`tare-live-accounting` Graph Studio deployment passed a 56/56 same-block Graph/RPC
comparison. The separate full-history share ledger is still syncing, so historical
share acceptance remains open.
See [phase four](docs/PHASE_4.md) for the exact remaining gates.

**Phase five Tare-side implementation is complete:** API, MCP and the modular web
application share the existing resolver. The web application includes a product
overview, guided explorer, beginner documentation and developer reference. Hosted
access controls and deterministic Recipe composition are tested; public recordings
need no configuration. A tested
Docker/Render package is deployed at `https://tare-api.onrender.com`; public,
authenticated and two-provider Base Sepolia acceptance passed. Bazantic platform
authoring and live acceptance are recorded in the team handoff.
See [phase five](docs/PHASE_5.md) for the implementation and rollout checklist.

**Phase six local V1 monitoring is implemented:** Substreams events trigger existing
resolution and Graph/RPC checks, with resumable checkpoints, deduplication and
reorg retractions. Hosted acceptance remains pending; see [monitoring](docs/PHASE_6.md).

**Phase seven has a confidential policy workflow and Solidity exit receiver:** private
thresholds drive signed verdicts, with a guarded Base Sepolia execution path.
The Base Sepolia producer independently pins two RPC hosts, checks allowlisted bytecode
and reconciles direct two-layer custody. Deterministic failure cases passed through a
test forwarder, then a separate hosted private-registry workflow delivered a bounded
100-share exit through Chainlink's production Base Sepolia Keystone Forwarder. That
workflow is paused after successful acceptance. The control assets are test-only, and
current Ethereum V1 reports cannot authorize exits.
See [phase seven](docs/PHASE_7.md) for the exact execution and claim boundary.

Tare is an exposure resolver for nested vault positions. Phase one is a working
**offline, synthetic-data resolver** with local watch-only wallet profiles. An
explicit `live` command now uses Morpho's public GraphQL API and read-only EVM RPC.
The original snapshot and synthetic adapter commands remain offline.

Live resolution covers one protocol family and its loan receivables, not every
position or underlying collateral. Synthetic demos and the real captured example
are labeled separately. Morpho loan backing remains unverified; its scoped metric
is unavailable even when a USD price is observed. The separate WETH custody
command supports a narrow wrapper-only metric with explicit provider limitations.

## Run

Use Node.js 24+ and pnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm cli --help
pnpm demo
pnpm cli resolve fixtures/synthetic/deep.json --json
pnpm cli snapshot validate fixtures/synthetic/control.json
pnpm demo:phase2
pnpm cli replay fixtures/recordings/multi-asset.json --json
pnpm demo:phase3
pnpm serve
pnpm cli live example --rpc-url https://ethereum-rpc.publicnode.com
```

After building, `pnpm serve` opens the service at `http://127.0.0.1:4318`.
The web application routes are `/`, `/explore`, `/docs` and `/developers`.
Run `pnpm build:web` to type-check and bundle only the browser application.
For MCP clients, launch `node` with the absolute path to
`dist/apps/mcp/src/main.js`; see the [interface guide](docs/PHASE_5.md).

`verify` builds strict TypeScript, runs the unit and CLI integration tests, and
executes both synthetic demo sets and the real capture replay, without external
network access. The separate `live example` command contacts public sources.
After building, you can also run
`node dist/apps/cli/src/main.js --help` directly. The demo command works from any
working directory. User-provided file paths are relative to the current directory.

## Configure a watch-only wallet

Copy the public account address from MetaMask and choose the chain ID. Replace
`YOUR_PUBLIC_ADDRESS` below; it is deliberately not a usable sample account.

```sh
pnpm cli wallet add metamask --address YOUR_PUBLIC_ADDRESS --chain-id 1
pnpm cli wallet list
pnpm cli wallet show metamask
pnpm cli wallet remove metamask
```

This is a watch-only profile: only its name, public EVM address, and chain ID are
stored. Do not supply a recovery phrase, private key, or MetaMask password.
Addresses are checked for 20-byte hexadecimal format and normalized to lowercase;
mixed-case checksum verification and ENS resolution are not implemented.

Profiles default to `.tare/wallets/` under the current directory, excluded from Git.
Use `--home <directory>` or `TARE_HOME` for a consistent location across directories.
Existing profile names are not overwritten. No default profile is silently selected.
The repository does not assume that any profile exists and never stores a private key.

`resolve snapshot.json --wallet metamask` checks that the snapshot's owner and chain
match the selected local profile. It does **not** discover holdings or prove wallet
ownership. Included demo snapshots use the synthetic address
`0x1111111111111111111111111111111111111111`; they will reject an unrelated real
wallet profile rather than attribute demo holdings to it.

### Read the real native balance

The balance command works with any EVM-compatible HTTP(S) JSON-RPC endpoint. It
first calls `eth_chainId`, refuses a network mismatch, reads the latest block, and
then calls `eth_getBalance` at that exact block number. The RPC URL is supplied at
read time and is not saved in the wallet profile.

For Base Sepolia:

```sh
pnpm cli wallet balance base-sepolia --rpc-url https://sepolia.base.org --symbol ETH
pnpm cli wallet balance base-sepolia --rpc-url https://sepolia.base.org --symbol ETH --json
```

Use `TARE_RPC_URL` instead of `--rpc-url` when an endpoint contains a provider
token that should not be written to shell history. Native decimals default to 18;
override them with `--decimals` for a chain whose native asset differs.

This reports an RPC-observed native balance, not its fiat value. It does not
discover ERC-20 balances, NFTs, vault positions, or independently verify the RPC
operator. No transaction, connection request, or signature is made.

## Commands and outputs

| Command | Purpose |
| --- | --- |
| `demo all` | Control, three-layer, source-outage, and cyclic fixtures |
| `resolve <file>` | Resolve a validated local snapshot |
| `resolve <file> --json` | Emit a schema-versioned JSON receipt |
| `resolve <file> --out receipt.json` | Save a receipt without overwriting a file |
| `resolve <file> --max-depth 2 --max-visits 100` | Bound traversal work |
| `snapshot validate <file>` | Validate the fixture schema, not completeness or truth |
| `snapshot normalize <recording> --out <file>` | Normalize an offline recording into a version-two snapshot |
| `replay <recording> --json` | Normalize and resolve a synthetic adapter recording |
| `demo phase2` | Run six version-two accounting and failure cases |
| `live discover --address <address>` | Discover indexed Ethereum MetaMorpho V1 positions |
| `live resolve --address <address> --vault <vault> --rpc-url <url>` | Resolve a supported USDC vault position at one block |
| `live example --rpc-url <url>` | Discover and resolve a public Steakhouse USDC depositor |
| `live replay <capture>` | Recompute a retained RPC capture without network calls |
| `verify shares --address <address> --vault <vault> --rpc-url <url> --graph-url <url>` | Compare Tare's indexed share ledger with RPC at one block |
| `verify replay <report>` | Recompute saved Graph/RPC checks without network calls |
| `live nested --address <owner> --vault <V2-vault>` | Resolve a supported V2→V1→Blue position and observe its USD price |
| `live nested-replay <capture>` | Replay nested accounting and valuation offline |
| `verify accounting --vault <V1-vault>` | Cross-check indexed underlying accounting against pinned RPC |
| `verify accounting-replay <capture>` | Recompute underlying accounting comparisons |
| `verify custody --address <holder>` | Cross-check WETH/native ETH custody across two RPC hosts |
| `verify custody-replay <capture>` | Replay the scoped custody metric |
| `verify base-custody --address <owner> --deployment <file>` | Verify the allowlisted Base Sepolia two-layer control across two RPC hosts |
| `verify base-custody-replay <capture>` | Replay Base evidence without claiming freshness or execution eligibility |
| `demo phase4` | Synthetic 1x/3x methodology controls and blocked cases |
| `wallet add/list/show/remove` | Manage local watch-only profiles |
| `wallet balance <name> --rpc-url <url>` | Read a block-pinned native balance from an EVM RPC endpoint |

Exit codes: **0** successful command or complete resolution; **1** invalid input
or I/O failure; **2** partial resolution. `demo` exits 0 when all selected cases
match their expected complete/partial states, including intentional failure cases.
Machine-readable output goes to stdout and errors to stderr.

Coverage lists terminal visits and unresolved findings, not an invented percentage.
If the global visit budget is exhausted, one finding represents all remaining
unvisited work; it is not a count of every missing branch. Source health is declared
by offline input snapshots; live receipts measure requests, failures and elapsed
time. Export parents must already exist. Live discovery is supplied by Morpho's
GraphQL API, not The Graph. Phase four adds a separate The Graph client and custom
subgraph. Hosted live accounting has passed; full-history share-ledger validation
is still pending.

## Repository structure

```text
apps/cli/src/              Command parsing and local CLI workflows
apps/api/src/              HTTP/OpenAPI, access controls and static serving
apps/mcp/src/              Tare's stdio MCP tools
apps/web/                  Explorer, capture import and report downloads
packages/service/src/     Shared dispatch and deterministic evidence composition
packages/monitor/src/     Event transitions, evidence evaluation and durable progress
packages/policy/src/      Private policy rules and Tare evidence projection
packages/domain/src/      Runtime schemas, branded addresses, result types
packages/adapters/src/    Fixture normalization and MetaMorpho/Morpho Blue accounting
packages/sources/src/     Bounded files, HTTP, GraphQL and block-pinned RPC readers
packages/resolver/src/    Deterministic traversal and integer attribution
packages/wallet/src/      Watch-only profile validation and persistence
packages/receipts/src/    JSON serialization and terminal formatting
packages/verification/    Block-aligned Graph/RPC share checks and evidence replay
graph/subgraph/           AssemblyScript share ledger, schema, manifest and isolated tooling
workflows/cre/            Confidential CRE workflow and isolated Bun/SDK tooling
contracts/                Base-Sepolia-only Solidity exit receiver and Foundry tests
deployments/              Public test deployment identities and acceptance manifests
fixtures/synthetic/       Control, deep, degraded, and cycle inputs
fixtures/recordings/      Synthetic adapter responses and multi-position cases
fixtures/live/            Real public RPC capture, receipt and provenance
tests/                    Resolver and subprocess CLI integration tests
docs/                     Phase plan, architecture, accounting policy
.github/workflows/        Linux/Windows offline CI checks
```

Core directories are logical modules under one TypeScript package and lockfile;
Graph and CRE tooling have isolated dependencies. These are not separately
published workspace packages. This keeps the core small while
preserving boundaries between adapters, verification and the CLI/API/MCP/web interfaces.
The project remains TypeScript-first. Rust is permitted only for an approved,
isolated custom Substreams module after the live resolver and RPC verification
path works end to end; it is not a general replacement path for core components.

See [phase-one steps and exit criteria](docs/PHASE_1.md),
[phase-two implementation](docs/PHASE_2.md),
[phase-three implementation](docs/PHASE_3.md),
[phase-four progress and acceptance](docs/PHASE_4.md),
[current team handoff](docs/TEAM_HANDOFF.md),
[architecture](docs/ARCHITECTURE.md), [accounting](docs/ACCOUNTING.md),
[language strategy and Rust boundary](docs/LANGUAGE_STRATEGY.md),
[scope](SCOPE.md), and [field notes](FIELD_NOTES.md).

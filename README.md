# Tare

Tare is an exposure resolver for nested vault positions. Phase one is a working
**offline, synthetic-data resolver** with local watch-only wallet profiles. An
explicit wallet-balance command can make a read-only EVM JSON-RPC call; resolution
itself makes no RPC, Graph, wallet-provider, or other network calls.

This is an implementation foundation, not a live portfolio analyzer. All demo
amounts and block references are explicitly synthetic. A complete traversal is
still unverified; no collateral multiple is claimed in this phase.

## Run

Use Node.js 24+ and pnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm cli --help
pnpm demo
pnpm cli resolve fixtures/synthetic/deep.json --json
pnpm cli snapshot validate fixtures/synthetic/control.json
```

`verify` builds strict TypeScript, runs the unit and CLI integration tests, and
executes the four reproducible demos. After building, you can also run
`node dist/apps/cli/src/main.js --help` directly. The demo command works from any
working directory. User-provided file paths are relative to the current directory.

## Configure your MetaMask address later

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
Your real wallet remains unconfigured, as requested.

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
| `wallet add/list/show/remove` | Manage local watch-only profiles |
| `wallet balance <name> --rpc-url <url>` | Read a block-pinned native balance from an EVM RPC endpoint |

Exit codes: **0** successful command or complete resolution; **1** invalid input
or I/O failure; **2** partial resolution. `demo` exits 0 when all selected cases
match their expected complete/partial states, including intentional failure cases.
Machine-readable output goes to stdout and errors to stderr.

Coverage lists terminal visits and unresolved findings, not an invented percentage.
If the global visit budget is exhausted, one finding represents all remaining
unvisited work; it is not a count of every missing branch. Source health is declared
by the input snapshot, not measured. Export parents must already exist.

## Repository structure

```text
apps/cli/src/              Command parsing and local CLI workflows
packages/domain/src/      Runtime schemas, branded addresses, result types
packages/sources/src/     Bounded local JSON/snapshot reader
packages/resolver/src/    Deterministic traversal and integer attribution
packages/wallet/src/      Watch-only profile validation and persistence
packages/receipts/src/    JSON serialization and terminal formatting
fixtures/synthetic/       Control, deep, degraded, and cycle inputs
tests/                    Resolver and subprocess CLI integration tests
docs/                     Phase plan, architecture, accounting policy
.github/workflows/        Linux/Windows offline CI checks
```

The directories are logical modules under one TypeScript package and one lockfile,
not separately published workspace packages. This keeps phase one small while
preserving boundaries for future adapters, verification, API, MCP, and web apps.
Rust can be introduced behind an adapter later if measured workloads justify it.

See [phase-one steps and exit criteria](docs/PHASE_1.md),
[architecture](docs/ARCHITECTURE.md), [accounting](docs/ACCOUNTING.md),
[scope](SCOPE.md), and [field notes](FIELD_NOTES.md).

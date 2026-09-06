# PROJECT BRIEF — Tare

## What you are building

Tare resolves what a crypto portfolio or protocol is ACTUALLY exposed to,
after unwrapping every layer of ERC-4626 vault nesting.

Vaults wrap vaults wrap vaults. The same underlying dollar gets counted as
TVL at three or four layers. A position that looks diversified across four
protocols can resolve to a single collateral asset. Nobody can see this
today because every protocol ships its own subgraph with its own schema,
so cross-protocol resolution needs a normalization layer that does not exist.

Tare builds that layer, then traverses it.

Core outputs:
- Full unwrap of a nested position down to true underlying leaf assets
- EFFECTIVE COLLATERAL MULTIPLE: if $100 of real USDC sits beneath $340
  of claims across four layers, that is 3.4x. This single number is the
  product's headline.
- Cycle detection: vault A holding shares of B holding shares of A is
  rehypothecation. The cycle IS the finding, not an error case.
- Change monitoring: alert when a risk parameter changes at any layer
  BENEATH a tracked position
- Natural-language query surface over all of the above

## Context: this is for ETHOnline 2026 (ETHGlobal)

Async hackathon, Sept 4-16 2026, ~$80k in partner prizes. Judging is
asynchronous by partner engineers, not a live pitch. They read the repo
and watch a video. Optimize for a technical reader who has seen a thousand
overstated demos.

Prior art you should know: at ETHGlobal Lisbon 2026, a project called
"atlas" took 2nd in The Graph's composable track with a fan-out over
schema families. It explicitly named its own gap: its standardized
fan-out reads protocol-level scalars only, so per-account position
conditions evaluate false and are marked inert. PER-ACCOUNT EXPOSURE
RESOLUTION IS THE UNBUILT HALF. That is our opening. Do not rebuild
atlas. Build the part it named as missing.

## Sponsors we are integrating, and their hard requirements

### The Graph — PRIMARY, $15,000 across three separate $5,000 pools

We target two pools: "Best Use of Composable or Standardized Graph
Products" and "Best AI Tooling or AI Use Case with The Graph (From
Scratch)". These are separate pools; one build can enter both.

NON-NEGOTIABLE, these are disqualification criteria:
- Must consume LIVE data from a Graph provider (Subgraph Studio for
  Subgraphs, The Graph Market for Substreams). Mocked, local-only, or
  static datasets DO NOT QUALIFY. This is stated explicitly in the rules.
- Must either compose two or more Graph products, OR build meaningfully
  on a standardized schema. Querying one subgraph with no composition
  or standardization does not qualify.
- For the AI pool: must do meaningful work with the data — reasoning,
  decisions, automation, natural-language interface — NOT just printing
  raw query results. Tooling must be reusable infrastructure, not a
  single end-user app.
- Open source with a clear README or SKILL.md so judges can run it.
- Public repo + 2-4 minute demo video.

The Graph's own track copy names ERC-4626 tokenized-vault flows as an
example of an emerging standard worth contributing a composable
Substreams module for. We are building exactly what they asked for.

We compose THREE Graph products: Subgraphs (Studio-deployed standardized
module), Substreams (change monitoring), and Subgraph MCP (agent surface).

### Chainlink — $2,000 Confidential Workflows pool, optional acting leg

If we build the acting leg (auto-unwind when effective multiple crosses
a threshold), it must use CRE Confidential Workflows:
- Register and use a confidential TEE handler (handlerInTee in TS,
  cre.HandlerInTee in Go)
- The confidential portion must process at least one real sensitive
  input, secret, or private parameter inside the enclave
- Must be meaningfully integrated into core functionality. A placeholder
  handler that does not contribute is EXPLICITLY DISQUALIFIED.
- Demonstrate via CRE CLI simulation OR live deployment. Simulation is
  acceptable — prefer it, it removes deployment risk.
- Provide evidence: demo video, terminal output, execution logs

Note: use CRE, not Chainlink Functions or Automation. Those are being
deprecated.

### Bazantic — $1,000, cheap add-on

"Best Recipe that uses ETHGlobal Hackathon Sponsor APIs." Requires:
account on bazantic.com, an x402/MPP Gateway for our project, a Recipe
combining our API with at least one other sponsor service in one working
flow where the result depends meaningfully on both, and a screen
recording. Roughly an afternoon of work. Do this near the end.

## Architecture — four layers

### Layer 1: Normalization
A standardized module for ERC-4626 flows normalizing deposits,
withdrawals, share-price evolution, and underlying asset references into
ONE schema across protocols and networks. Author it properly against the
standard — do not shape something that merely looks similar. Target
multiple networks so the fan-out has something to fan out to.

### Layer 2: Resolution — THIS IS THE PRODUCT
The traversal engine. Input a position or address, follow share tokens
down through wrapper layers, detect cycles, terminate at leaf assets,
compute effective collateral multiple.

Design decisions I am leaving to you — think hard about these:
- Cycle detection strategy. Vaults can form genuine cycles and the
  traversal must terminate and report rather than hang or overflow.
- Share-price accounting across layers. convertToAssets at each hop
  compounds; decide how you accumulate and where precision is lost.
- What counts as a "leaf". A stablecoin is a leaf. Is an LP token?
  Is a liquid staking token? Defend your answer in the README.
- Caching. Traversal is expensive and layers are shared across many
  positions. Design for reuse.
- Partial resolution. If one hop's source is dead, you have a partially
  resolved tree, not a failure. Represent that in the type system.

### Layer 3: Monitoring
Substreams subscription for parameter changes at any layer beneath a
tracked position. Polling a subgraph leaves a guard up to five minutes
late — a preference for something that displays, a correctness bug for
something that acts. Handle reorgs (blockUndoSignal must rewind, never
become a trigger), cursor resumption, and replay deduplication.

### Layer 4: Interface
MCP server exposing resolution as tools, plus a natural-language query
surface. Reasoning over data, not query printing.

### Optional: Chainlink acting leg
CRE workflow that acts when the effective multiple crosses a private
threshold. The threshold and unwind strategy live inside the enclave.

## Data strategy — important

READ FROM MAINNET, WRITE TO TESTNET.

A contract deployed this week has no history to index, so our data story
must be mainnet subgraphs with real vault data. Any contracts we deploy
go to testnet. This satisfies The Graph's live-data rule and keeps writes
cheap and safe.

## Engineering standards — top tier, non-negotiable

TypeScript strict mode, no `any` escapes. Zod or equivalent validating
every external boundary, especially GraphQL responses — subgraph schemas
drift and a runtime type error at demo time is fatal.

Make illegal states unrepresentable. A partially-resolved tree and a
fully-resolved tree are DIFFERENT TYPES. An unverified leaf and a
verified leaf are different types. If the compiler lets you print an
effective multiple from an incomplete traversal, the design is wrong.

Tests: the traversal engine needs real unit tests including cycles,
depth limits, precision at each hop, and partial-resolution paths.
A test suite that can only print a green check proves nothing — write
NEGATIVE tests. A control case that resolves to exactly 1.0 with no
cycle is as important as the four-layer case.

Source health is a FIRST-CLASS OUTPUT, not an internal concern. Roughly
a quarter of standardized subgraph deployments are dead at any given
moment. Health-check with a short TTL and a hard timeout, and surface
coverage in the output. An exposure calculation missing 30% of its
inputs is worse than no calculation if it presents as confident. Never
silently drop a dead source.

Never fabricate a number. If a value has no writer, render nothing
rather than a placeholder — a figure with no writer looks like a
measurement and is worse than a missing one. If you cannot compute
something, the type system should have prevented you from claiming it.

No database. Chains, IPFS, and generated snapshots are the state.

## Verification standard — this is how we win

Every headline claim must be independently verifiable, and verified by a
SECOND source. Specifically:

Pick one real, currently-live nested mainnet position. Resolve it fully.
Then verify the leaf holding by reading the underlying token balance
DIRECTLY off chain via RPC, not through the subgraph. Two independent
sources agreeing is the proof. Build this as a script that runs in CI
and prints both numbers side by side.

Ship three demo runs, all reproducible:
1. Deep case: 3+ layers, cycle detected, multiple computed, leaf verified
2. Control case: single-layer position, resolves to 1.0, no cycle
3. Degraded case: a source is down, tool reports incomplete coverage
   instead of a confident wrong number

## Where to be creative

I want you to invent things here. Some seeds, but go further:

- A visual representation of the unwrap that makes a 3.4x multiple
  immediately legible to someone who has never heard of ERC-4626
- A "blast radius" query: given a hypothetical depeg of one leaf asset,
  which positions across the indexed set are affected and by how much
- A shareable artifact per resolution — something a risk desk would
  actually paste into a channel
- Something that makes the cycle detection findings feel like discoveries
  rather than log lines

Constraint on creativity: every invented feature must be backed by real
resolved data. A clever feature computed from fabricated numbers is
worse than no feature. If you invent something, also invent how to
verify it.

## Working process

Maintain two files from day one, updating as you go:

FIELD_NOTES.md — every testnet or tooling wall you hit and the workaround.
Broken docs, endpoints that lie, SDK functions returning wrong values,
chains with undocumented gas floors, subgraphs whose schema does not
match their documentation. Be specific: include the address, the error,
and the working path. This becomes a section of the final submission and
it is one of the strongest differentiators available — most teams never
write it.

SCOPE.md — what we are deliberately NOT building, updated continuously.
Be precise: not "limited protocol coverage" but "non-ERC-4626 wrapper
types are unresolved; we detect and mark them as opaque leaves rather
than traversing them." Naming gaps precisely makes every remaining claim
credible. If an audit finds a claim overstated, strike it through rather
than deleting it.

Commit continuously with real messages. Sponsors check commit history
and a single large commit on the final day is a red flag.

## Build order

Days 1-3: standardized module authored and deploying via Subgraph Studio,
          live queries returning real vault data on 2+ networks
Days 4-6: traversal engine, cycle detection, effective multiple.
          THIS IS THE PRODUCT — protect this time.
Day 7:    Substreams monitoring layer
Days 8-9: MCP server, query interface, Bazantic Recipe
Day 10:   Chainlink acting leg (CUTTABLE)
Day 11:   writeup, video, evidence runs

Kill criterion: if the traversal is not resolving a real 3+ layer
position by end of day 6, drop the acting leg and monitoring and ship
the resolver alone. The resolver by itself is a valid composable-track
entry.

## Start here

Do NOT write code yet. First:

1. Investigate what ERC-4626 vault data is actually available through
   The Graph today — which standardized subgraphs exist, which networks,
   which are live. Report what you find, including what is missing.
2. Identify 3-5 REAL nested positions on mainnet we could use as test
   fixtures. Name the actual vaults and their nesting depth.
3. Flag the hardest technical unknown you see and propose how to
   de-risk it in the first 48 hours.
4. Propose the type-level design for a partially-resolved tree.

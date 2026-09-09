# Graph Node integration acceptance

This test runs the actual share and accounting WASM mappings in Graph Node 0.45.0.
It deploys unrestricted **local fixtures** to Anvil, indexes mint/transfer/burn
events and underlying state, and compares them with the CLI's real source clients.
It then reverts an indexed transfer, mines a replacement burn and a new head,
and verifies rollback: 80 owner shares, 80 total shares, and no orphan recipient.
Anvil uses chain ID 1 for the scoped verifier; it is not Ethereum mainnet.

Prerequisites: Node 24, installed root/subgraph dependencies, Docker with Linux
containers. Ports 18545, 18000, 18020, 18030 and 15001 must be free. All published
ports bind to localhost. The test has no configurable transaction RPC or key input.

```sh
node --run build
node --run build:subgraph
docker compose -f graph/integration/compose.yaml up -d
# Linux/macOS shell; on PowerShell replace $PWD with the absolute workspace path.
docker run --rm --entrypoint forge -v "$PWD/graph/integration:/work" -w /work ghcr.io/foundry-rs/foundry:v1.3.1 build
node --run test:graph
docker compose -f graph/integration/compose.yaml down --volumes
```

The final command removes only this test stack and its test data. Stop it after
testing. The Docker Desktop application itself is not shut down automatically.

The harness generates ignored `subgraph.local.yaml`, contract outputs, and
`result.json`. Its unique subgraph name allows retries within the same stack.
Run from a fresh stack for independent reproducibility. CI performs the same steps
and cleans up even after failure; no hosted Graph credentials are required.

The retained [acceptance result](../../fixtures/integration/graph-node-reorg.json)
is a local Anvil test, explicitly labeled by its outer `origin` field. Its nested
reports contain real local Graph/RPC captures, not mainnet proof. Public mainnet
RPC captures are kept separately in `fixtures/live/`.

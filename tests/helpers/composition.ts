import { fixture } from './morpho.js';
import { replayLiveCapture } from '../../packages/resolver/src/live.js';
import { ComposeSchema } from '../../packages/service/src/composition.js';
import { SELECTOR } from '../../packages/adapters/src/morpho-blue.js';
import { word } from '../../packages/sources/src/evm.js';

// Authored share/Graph test vector paired with a retained RPC capture; never live Graph acceptance.
export async function compositionFixture() {
  const source = await fixture();
  const report = await replayLiveCapture(source);
  const vault = report.vault!;
  const height = Number(BigInt(source.block!.number));
  const deployment = 'QmLocalCompositionTestOnly';
  const reads = [
    [SELECTOR.asset, word(vault.asset)], [SELECTOR.decimals, word(18n)],
    [SELECTOR.supply, word(BigInt(vault.totalSupplyRaw))],
    [SELECTOR.balance + word(source.owner), word(BigInt(vault.sharesRaw))],
  ];
  const input = { resolutionCapture: source, shareCapture: {
    captureVersion: 1, scope: 'erc4626-share-ledger', chainId: 1, owner: source.owner,
    vault: source.vault, capturedAt: source.capturedAt, expectedDeployment: deployment,
    rpc: { block: source.block, confirmed: true, failedCalls: [],
      health: { source: 'rpc', status: 'healthy', requests: 4, failures: 0, elapsedMs: 0 },
      calls: reads.map(([data, result], index) => ({ id: `test-${index}`, to: source.vault, data,
        result: `0x${result}`, blockHash: source.block!.hash, observedAt: source.capturedAt })) },
    graph: { source: 'the-graph', schema: 'tare-share-ledger-v1', observedAt: source.capturedAt, requestedBlock: height,
      data: { _meta: { block: { number: height, hash: source.block!.hash }, deployment, hasIndexingErrors: false },
        vault: { id: source.vault, chainId: 1, asset: vault.asset, shareDecimals: 18,
          totalShares: vault.totalSupplyRaw, indexedFromBlock: '0', lastUpdateBlock: String(height) },
        accountBalance: { id: `${source.vault}-${source.owner}`, account: source.owner, vault: { id: source.vault },
          shares: vault.sharesRaw, lastUpdateBlock: String(height) } } },
    graphHealth: { source: 'the-graph', status: 'healthy', requests: 1, failures: 0, elapsedMs: 0 }, failures: [],
  } };
  return ComposeSchema.parse({ ...input, graphResponse: { data: input.shareCapture.graph.data } });
}

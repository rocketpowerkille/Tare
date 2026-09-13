import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, replayHandler } from './helpers/morpho.js';
import { withServer } from './helpers/http.js';
import { readAccounting } from '../packages/adapters/src/accounting-reads.js';
import { RecordedReader } from '../packages/sources/src/recorded.js';
import { verifySuppliedAccounting } from '../packages/verification/src/supplied-accounting.js';
import { investigateWallet } from '../packages/service/src/wallet-investigation.js';
import { TareService } from '../packages/service/src/index.js';

test('forwarded Graph snapshots use pinned independent RPC and preserve provenance limitations', async () => {
  const source = await fixture();
  const reads = await readAccounting(new RecordedReader({ block: source.block, confirmed: true, calls: source.observations, failedCalls: [] }), source.vault);
  const graph = { _meta: { block: { number: Number(BigInt(source.block!.number)), hash: source.block!.hash }, deployment: 'QmLocalAuthoredTestOnly', hasIndexingErrors: false },
    accountingState: { id: source.vault, chainId: 1, blockNumber: BigInt(source.block!.number).toString(), blockHash: source.block!.hash, timestamp: BigInt(source.block!.timestamp).toString(), reads } };
  await withServer(replayHandler(source), async url => {
    const matched = await verifySuppliedAccounting({ vault: source.vault, graph }, url, graph._meta.deployment);
    assert.equal(matched.status, 'matched');
    assert.equal(matched.checks.length, 56);
    assert.equal(matched.sourceMode, 'agent-supplied-graph-live-rpc');
    assert.match(matched.limitations[0]!, /not independently authenticated/);
    for (const change of ['value', 'block', 'deployment', 'missing'] as const) {
      const mutated = structuredClone(graph);
      if (change === 'value') mutated.accountingState.reads[2]!.result = `0x${'0'.repeat(64)}`;
      if (change === 'block') mutated._meta.block.hash = `0x${'f'.repeat(64)}`;
      if (change === 'deployment') mutated._meta.deployment = 'QmDifferent';
      if (change === 'missing') mutated.accountingState.reads.pop();
      const result = await verifySuppliedAccounting({ vault: source.vault, graph: mutated }, url, graph._meta.deployment);
      assert.equal(result.status, change === 'value' ? 'mismatch' : 'incomplete');
      assert.equal(result.metric.kind, 'unavailable');
    }
  });
});

test('wallet investigation bounds candidate reads, preserves unavailable sources and does not infer empty ownership', async () => {
  const calls: string[] = [];
  class StubService extends TareService {
    override async run(action: 'analyze' | 'discover' | 'replay' | 'example' | 'compose', input: unknown) {
      const value = input as Record<string, unknown>;
      calls.push(String(value.operation ?? action));
      if (action === 'discover') return { complete: false, positions: Array.from({ length: 8 }, (_, index) => ({ vault: `0x${String(index).repeat(40)}`, chainId: 1, support: { status: 'supported', operation: 'resolve-v1' } })) };
      return { protocol: 'metamorpho-v1-blue-v1', kind: 'partial', findings: ['missing-source'] };
    }
  }
  const result = await investigateWallet(new StubService(), { owner: `0x${'1'.repeat(40)}` });
  assert.equal(result.results.length, 3);
  assert.equal(result.skippedSupportedPositions, 5);
  assert.equal(calls.length, 4);
  assert.equal(result.status, 'incomplete');
  assert.match(result.limitations[0]!, /not no assets/);
  await assert.rejects(investigateWallet(new StubService(), { owner: 'bad' }));
});

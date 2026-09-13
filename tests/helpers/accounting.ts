import { fixture } from './morpho.js';
import { readAccounting } from '../../packages/adapters/src/accounting-reads.js';
import { RecordedReader } from '../../packages/sources/src/recorded.js';
import { AccountingCaptureSchema } from '../../packages/verification/src/accounting-capture.js';

export async function accountingCapture() {
  const source = await fixture();
  const rpc = { block: source.block, confirmed: true, calls: source.observations, failedCalls: [] };
  const reads = await readAccounting(new RecordedReader(rpc), source.vault);
  return AccountingCaptureSchema.parse({
    captureVersion: 1, scope: 'morpho-v1-accounting', chainId: 1, vault: source.vault,
    capturedAt: source.capturedAt, rpc, failures: [], expectedDeployment: 'QmLocalAuthoredTestOnly',
    // These indexed values are an authored HTTP vector, not live Graph evidence.
    graph: { _meta: { block: { number: Number(BigInt(source.block!.number)), hash: source.block!.hash },
      deployment: 'QmLocalAuthoredTestOnly', hasIndexingErrors: false },
    accountingState: { id: source.vault, chainId: 1, blockNumber: BigInt(source.block!.number).toString(),
      blockHash: source.block!.hash, timestamp: BigInt(source.block!.timestamp).toString(), reads } },
  });
}

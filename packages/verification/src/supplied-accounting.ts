import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { readAccounting } from '../../adapters/src/accounting-reads.js';
import { PinnedRpc } from '../../sources/src/evm.js';
import { SourceFailure } from '../../sources/src/http.js';
import { DeploymentSchema } from '../../sources/src/the-graph.js';
import { AccountingDataSchema } from './accounting-capture.js';
import { replayAccounting } from './accounting.js';
import type { AccountingCapture } from './accounting-capture.js';

export const SuppliedAccountingInput = z.strictObject({ vault: AddressSchema, graph: AccountingDataSchema });

/** Compare supplied indexed bytes with independent RPC. A claimed deployment is not authenticated provenance. */
export async function verifySuppliedAccounting(input: unknown, rpcUrl: string, expectedDeployment: string) {
  const { vault, graph } = SuppliedAccountingInput.parse(input);
  const pinnedDeployment = DeploymentSchema.parse(expectedDeployment);
  const rpc = new PinnedRpc(rpcUrl, 10000, 267, 300000);
  const capture: AccountingCapture = { captureVersion: 1, scope: 'morpho-v1-accounting', chainId: 1,
    vault, capturedAt: new Date().toISOString(), expectedDeployment: pinnedDeployment,
    rpc: { block: null, confirmed: false, calls: rpc.observations, failedCalls: rpc.failedCalls }, graph, failures: [] };
  if (graph._meta.deployment !== pinnedDeployment) capture.failures.push('deployment-mismatch');
  if (graph._meta.hasIndexingErrors) capture.failures.push('indexing-errors');
  if (!graph.accountingState) capture.failures.push('missing-accounting-state');
  if (!graph._meta.block.hash) capture.failures.push('missing-block-hash');
  if (!capture.failures.length) {
    try {
      await rpc.pin(1, String(graph._meta.block.number));
      capture.rpc.block = rpc.block;
      if (rpc.block.hash !== graph._meta.block.hash) capture.failures.push('block-mismatch');
      else await readAccounting(rpc, vault);
      await rpc.confirm();
      capture.rpc.confirmed = true;
    } catch (error) {
      if (!(error instanceof SourceFailure)) throw error;
      capture.failures.push(error.code);
    }
  }
  const report = await replayAccounting(capture);
  return { ...report, sourceMode: 'agent-supplied-graph-live-rpc',
    limitations: ['Graph observations were supplied by the caller. Their claimed deployment and source are not independently authenticated.',
      'Only exact supplied indexed values versus pinned RPC are compared. Agreement does not establish custody, solvency or backing.'] };
}

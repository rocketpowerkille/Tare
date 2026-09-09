import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { UintSchema } from '../../domain/src/live.js';
import { readAccounting } from '../../adapters/src/accounting-reads.js';
import { PinnedRpc } from '../../sources/src/evm.js';
import { SourceFailure } from '../../sources/src/http.js';
import { evidenceDigest, RecordedReader } from '../../sources/src/recorded.js';
import { DeploymentSchema, GraphShareClient } from '../../sources/src/the-graph.js';
import { ACCOUNTING_QUERY, AccountingCaptureSchema, AccountingDataSchema } from './accounting-capture.js';
import type { AccountingCapture } from './accounting-capture.js';

export async function replayAccounting(input: unknown, sourceMode: 'live-graph-rpc' | 'recorded-graph-rpc' = 'recorded-graph-rpc') {
  const capture = AccountingCaptureSchema.parse(input);
  const findings = [...capture.failures];
  const checks: { to: string; data: string; rpc: string; graph: string | null; status: 'matched' | 'mismatch' | 'missing' }[] = [];
  const { block } = capture.rpc;
  const graph = capture.graph;
  if (!block || !capture.rpc.confirmed) findings.push('unconfirmed-block');
  if (!graph?.accountingState) findings.push('missing-accounting-state');
  if (block && graph?.accountingState) {
    const state = graph.accountingState;
    if (BigInt(graph._meta.block.number) !== BigInt(block.number) || graph._meta.block.hash !== block.hash
      || BigInt(state.blockNumber) !== BigInt(block.number) || state.blockHash !== block.hash
      || BigInt(state.timestamp) !== BigInt(block.timestamp)) findings.push('block-mismatch');
    if (graph._meta.hasIndexingErrors) findings.push('indexing-errors');
    if (capture.expectedDeployment && graph._meta.deployment !== capture.expectedDeployment) findings.push('deployment-mismatch');
    if (state.id !== capture.vault) findings.push('vault-mismatch');
    const indexed = new Map<string, string>();
    for (const read of state.reads) {
      const key = `${read.to}:${read.data}`;
      if (indexed.has(key)) findings.push('duplicate-indexed-read');
      indexed.set(key, read.result);
    }
    if (!findings.length) {
      try {
        const reads = await readAccounting(new RecordedReader(capture.rpc), capture.vault);
        if (reads.length !== indexed.size) findings.push('read-set-mismatch');
        for (const read of reads) {
          const value = indexed.get(`${read.to}:${read.data}`) ?? null;
          checks.push({ to: read.to, data: read.data, rpc: read.result, graph: value,
            status: value === null ? 'missing' : value === read.result ? 'matched' : 'mismatch' });
        }
      } catch (error) {
        if (!(error instanceof SourceFailure)) throw error;
        findings.push(error.code);
      }
    }
  }
  return {
    schemaVersion: 1, reportType: 'accounting-verification' as const, sourceMode,
    status: findings.length || checks.some(check => check.status === 'missing') ? 'incomplete' as const
      : checks.some(check => check.status === 'mismatch') ? 'mismatch' as const : 'matched' as const,
    captureDigest: evidenceDigest(capture), capture, checks, findings,
    verification: 'underlying-accounting-cross-check-only' as const,
    metric: { kind: 'unavailable' as const, reasons: ['lending-backing-unverified', 'missing-valuation'] },
  };
}

export const AccountingOptionsSchema = z.strictObject({
  vault: AddressSchema, rpcUrl: z.string().min(1), graphUrl: z.string().min(1),
  blockNumber: UintSchema.refine(value => BigInt(value) <= 2147483647n).optional(),
  expectedDeployment: DeploymentSchema.optional(), timeoutMs: z.number().int().min(100).max(60000).default(10000),
});
export async function verifyAccounting(input: z.input<typeof AccountingOptionsSchema>, apiKey?: string) {
  const options = AccountingOptionsSchema.parse(input);
  const rpc = new PinnedRpc(options.rpcUrl, options.timeoutMs, 267, 300000);
  const graph = new GraphShareClient(options.graphUrl, options.timeoutMs, apiKey);
  const capture: AccountingCapture = {
    captureVersion: 1, scope: 'morpho-v1-accounting', chainId: 1, vault: options.vault,
    capturedAt: new Date().toISOString(), expectedDeployment: options.expectedDeployment ?? null,
    rpc: { block: null, confirmed: false, calls: rpc.observations, failedCalls: rpc.failedCalls }, graph: null, failures: [],
  };
  try {
    await rpc.pin(1, options.blockNumber);
    capture.rpc.block = rpc.block;
    const block = Number(BigInt(rpc.block.number));
    z.number().int().max(2147483647).parse(block);
    const results = await Promise.allSettled([
      readAccounting(rpc, options.vault),
      graph.query(ACCOUNTING_QUERY, { block: { hash: rpc.block.hash }, vault: options.vault }, AccountingDataSchema),
    ]);
    for (const result of results) if (result.status === 'rejected') {
      if (!(result.reason instanceof SourceFailure)) throw result.reason;
      capture.failures.push(result.reason.code);
    }
    if (results[1].status === 'fulfilled') capture.graph = results[1].value;
    await rpc.confirm();
    capture.rpc.confirmed = true;
  } catch (error) {
    if (!(error instanceof SourceFailure)) throw error;
    capture.failures.push(error.code);
  }
  return replayAccounting(capture, 'live-graph-rpc');
}

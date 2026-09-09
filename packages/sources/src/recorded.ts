import { createHash } from 'node:crypto';
import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { CallObservationSchema, FailedCallSchema, RpcBlockSchema } from './evm.js';
import type { ContractReader } from './evm.js';
import { SourceFailure } from './http.js';

export const RpcEvidenceSchema = z.strictObject({
  block: RpcBlockSchema.nullable(), confirmed: z.boolean(),
  calls: z.array(CallObservationSchema).max(1000),
  failedCalls: z.array(FailedCallSchema).max(1000),
}).superRefine((evidence, context) => {
  const keys = new Set<string>();
  const ids = new Set<string>();
  for (const call of evidence.calls) {
    const key = `${call.to}:${call.data}`;
    if (keys.has(key) || ids.has(call.id)) context.addIssue({ code: 'custom', message: 'Duplicate RPC observation' });
    keys.add(key);
    ids.add(call.id);
  }
  for (const call of [...evidence.calls, ...evidence.failedCalls]) {
    if (call.blockHash !== evidence.block?.hash) context.addIssue({ code: 'custom', message: 'RPC observation block mismatch' });
  }
  if (evidence.confirmed && !evidence.block) context.addIssue({ code: 'custom', message: 'Confirmed evidence requires a block' });
});
export type RpcEvidence = z.infer<typeof RpcEvidenceSchema>;

export function evidenceDigest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

/** Replays only recorded reads; missing data never falls through to a network. */
export class RecordedReader implements ContractReader {
  readonly block;
  constructor(private readonly evidence: RpcEvidence) {
    if (!evidence.block) throw new SourceFailure('invalid-response', 'Missing recorded block');
    this.block = evidence.block;
  }
  async call(to: string, data: string): Promise<string> {
    const address = AddressSchema.parse(to);
    const calldata = data.toLowerCase();
    const call = this.evidence.calls.find(item => item.to === address && item.data === calldata);
    if (call) return call.result;
    const failed = this.evidence.failedCalls.find(item => item.to === address && item.data === calldata);
    throw new SourceFailure(failed?.code ?? 'invalid-response', 'Recorded call unavailable');
  }
}

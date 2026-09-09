import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { CallObservationSchema, FailedCallSchema, HealthSchema, RpcBlockSchema } from '../../sources/src/evm.js';
import { DeploymentSchema, GraphHealthSchema, GraphShareObservationSchema } from '../../sources/src/the-graph.js';

export const FindingSchema = z.strictObject({
  stage: z.enum(['rpc', 'graph', 'comparison']),
  code: z.string().min(1).max(80),
});

export const ShareVerificationCaptureSchema = z.strictObject({
  captureVersion: z.literal(1),
  scope: z.literal('erc4626-share-ledger'),
  chainId: z.literal(1),
  owner: AddressSchema,
  vault: AddressSchema,
  capturedAt: z.iso.datetime(),
  expectedDeployment: DeploymentSchema.nullable(),
  rpc: z.strictObject({
    block: RpcBlockSchema.nullable(),
    confirmed: z.boolean(),
    calls: z.array(CallObservationSchema).max(4),
    failedCalls: z.array(FailedCallSchema).max(4),
    health: HealthSchema,
  }),
  graph: GraphShareObservationSchema.nullable(),
  graphHealth: GraphHealthSchema,
  failures: z.array(FindingSchema).max(10),
}).superRefine((capture, ctx) => {
  if (capture.rpc.confirmed && !capture.rpc.block) {
    ctx.addIssue({ code: 'custom', message: 'Confirmation requires a block' });
  }
  const calls = new Set<string>();
  const ids = new Set<string>();
  for (const call of capture.rpc.calls) {
    const key = `${call.to}:${call.data}`;
    if (calls.has(key) || ids.has(call.id) || call.blockHash !== capture.rpc.block?.hash) {
      ctx.addIssue({ code: 'custom', message: 'Conflicting RPC evidence' });
    }
    calls.add(key);
    ids.add(call.id);
  }
  if (capture.rpc.failedCalls.some(call => call.blockHash !== capture.rpc.block?.hash)) {
    ctx.addIssue({ code: 'custom', message: 'Failed call block mismatch' });
  }
});
export type ShareVerificationCapture = z.infer<typeof ShareVerificationCaptureSchema>;
export const CheckSchema = z.strictObject({
  field: z.enum(['asset', 'share-decimals', 'total-shares', 'owner-shares']),
  rpc: z.string(),
  graph: z.string(),
  status: z.enum(['matched', 'mismatch']),
});

export type ShareCheck = z.infer<typeof CheckSchema>;
export type ShareFinding = z.infer<typeof FindingSchema>;

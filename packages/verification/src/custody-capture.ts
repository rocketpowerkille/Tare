import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { NativeBalanceSchema } from '../../sources/src/evm.js';
import { RpcEvidenceSchema } from '../../sources/src/recorded.js';

const WitnessSchema = z.strictObject({
  providerId: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  rpc: RpcEvidenceSchema, balances: z.array(NativeBalanceSchema).max(1),
}).superRefine((witness, context) => {
  for (const balance of witness.balances) if (balance.blockHash !== witness.rpc.block?.hash) {
    context.addIssue({ code: 'custom', message: 'Native balance block mismatch' });
  }
});
export const CustodyCaptureSchema = z.strictObject({
  captureVersion: z.literal(1), scope: z.literal('ethereum-weth-native-custody'), chainId: z.literal(1),
  owner: AddressSchema, capturedAt: z.iso.datetime(),
  witnesses: z.tuple([WitnessSchema, WitnessSchema]), failures: z.array(z.string().max(80)).max(10),
});
export type CustodyCapture = z.infer<typeof CustodyCaptureSchema>;

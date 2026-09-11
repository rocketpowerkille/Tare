import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { CodeObservationSchema } from '../../sources/src/evm.js';
import { RpcEvidenceSchema } from '../../sources/src/recorded.js';

const DigestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const DeploymentSchema = z.strictObject({
  outerVault: AddressSchema,
  innerVault: AddressSchema,
  terminalAsset: AddressSchema,
  codeDigests: z.strictObject({
    outerVault: DigestSchema,
    innerVault: DigestSchema,
    terminalAsset: DigestSchema,
  }),
});
const WitnessSchema = z.strictObject({
  providerId: DigestSchema,
  rpc: RpcEvidenceSchema,
  codes: z.array(CodeObservationSchema).length(3),
}).superRefine((witness, context) => {
  const addresses = new Set<string>();
  for (const code of witness.codes) {
    if (addresses.has(code.address)) context.addIssue({ code: 'custom', message: 'Duplicate code observation' });
    if (code.blockHash !== witness.rpc.block?.hash) context.addIssue({ code: 'custom', message: 'Code observation block mismatch' });
    addresses.add(code.address);
  }
});

export const SepoliaCustodyCaptureSchema = z.strictObject({
  captureVersion: z.literal(1),
  scope: z.literal('sepolia-two-layer-erc4626-custody'),
  chainId: z.literal(11155111),
  owner: AddressSchema,
  deployment: DeploymentSchema,
  capturedAt: z.iso.datetime(),
  witnesses: z.tuple([WitnessSchema, WitnessSchema]),
  failures: z.array(z.string().max(80)).max(10),
}).superRefine((capture, context) => {
  const expected = new Set([
    capture.deployment.outerVault,
    capture.deployment.innerVault,
    capture.deployment.terminalAsset,
  ]);
  for (const witness of capture.witnesses) {
    if (witness.codes.some(code => !expected.has(code.address))) {
      context.addIssue({ code: 'custom', message: 'Unexpected code observation' });
    }
    if (new Set(witness.codes.map(code => code.address)).size !== expected.size) {
      context.addIssue({ code: 'custom', message: 'Missing deployment code observation' });
    }
  }
});
export type SepoliaCustodyCapture = z.infer<typeof SepoliaCustodyCaptureSchema>;

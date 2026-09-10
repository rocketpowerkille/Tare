import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { UintSchema } from '../../domain/src/live.js';

const position = { owner: AddressSchema, vault: AddressSchema, blockNumber: UintSchema.optional() };
const graphBlock = z.string().regex(/^(0|[1-9][0-9]{0,9})$/)
  .refine(value => BigInt(value) <= 2147483647n).optional();
export const AnalyzeSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('resolve-v1'), ...position }),
  z.strictObject({ operation: z.literal('resolve-v2'), ...position }),
  z.strictObject({ operation: z.literal('verify-shares'), ...position, blockNumber: graphBlock }),
  z.strictObject({ operation: z.literal('verify-accounting'), vault: AddressSchema, blockNumber: graphBlock }),
  z.strictObject({ operation: z.literal('verify-weth'), owner: AddressSchema, blockNumber: UintSchema.optional() }),
]);
export const ReplaySchema = z.strictObject({
  operation: z.enum(['resolve-v1', 'resolve-v2', 'verify-shares', 'verify-accounting', 'verify-weth']),
  capture: z.json(),
});
export const ExampleSchema = z.strictObject({ id: z.enum(['steakhouse-usdc', 'ov-usdc-v2', 'weth-custody']) });
export const EmptySchema = z.strictObject({});
export const MAX_INPUT_BYTES = 5 * 1024 * 1024;

export class ServiceError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export function publicError(error: unknown): ServiceError {
  if (error instanceof ServiceError) return error;
  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return new ServiceError(400, 'invalid-input', 'Input does not match the operation schema.');
  }
  return new ServiceError(500, 'operation-failed', 'Operation failed; check local configuration and source availability.');
}

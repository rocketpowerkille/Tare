import { z } from 'zod/v4';
import { AddressSchema, SupportedEvmChainSchema } from '../../domain/src/index.js';
import { UintSchema } from '../../domain/src/live.js';
import { MorphoChainSchema } from '../../sources/src/morpho.js';

const position = { owner: AddressSchema, vault: AddressSchema, blockNumber: UintSchema.optional() };
const graphBlock = z.string().regex(/^(0|[1-9][0-9]{0,9})$/)
  .refine(value => BigInt(value) <= 2147483647n).optional();
export const AnalyzeSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('resolve-v1'), ...position, chainId: MorphoChainSchema.default(1) }),
  z.strictObject({ operation: z.literal('resolve-v2'), ...position }),
  z.strictObject({ operation: z.literal('resolve-erc4626'), ...position, chainId: SupportedEvmChainSchema.default(1) }),
  z.strictObject({ operation: z.literal('verify-shares'), ...position, blockNumber: graphBlock }),
  z.strictObject({ operation: z.literal('verify-accounting'), vault: AddressSchema, blockNumber: graphBlock }),
  z.strictObject({ operation: z.literal('verify-graph-composition'), owner: AddressSchema, vault: AddressSchema }),
  z.strictObject({ operation: z.literal('verify-weth'), owner: AddressSchema, blockNumber: UintSchema.optional() }),
  z.strictObject({ operation: z.literal('verify-base-custody'), owner: AddressSchema, blockNumber: UintSchema.optional() }),
]);
export const DiscoverSchema = z.strictObject({
  owner: AddressSchema,
  maxPositions: z.number().int().min(1).max(100).default(25),
});
export const ReplaySchema = z.strictObject({
  operation: z.enum(['resolve-v1', 'resolve-v2', 'resolve-erc4626', 'verify-shares', 'verify-accounting', 'verify-graph-composition', 'verify-weth', 'verify-base-custody']),
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

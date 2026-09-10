import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { HashSchema } from '../../sources/src/evm.js';
import { evidenceDigest } from '../../sources/src/recorded.js';

export const Height = z.string().regex(/^(0|[1-9][0-9]{0,9})$/)
  .refine(value => BigInt(value) <= 2147483647n, 'Block exceeds Graph Int range');
export const Block = z.strictObject({ number: Height, hash: HashSchema });
export const Position = z.strictObject({ chainId: z.literal(1), owner: AddressSchema, vault: AddressSchema });
const Cursor = z.string().min(1).max(4096);
export const StreamEvent = z.strictObject({ address: AddressSchema, transactionHash: HashSchema,
  logIndex: z.number().int().min(0).max(4294967295) });
export const Frame = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('block'), block: Block, cursor: Cursor, events: z.array(StreamEvent).max(10000) }),
  z.strictObject({ type: z.literal('undo'), block: Block, cursor: Cursor }),
]);
export type Frame = z.infer<typeof Frame>;
export type Position = z.infer<typeof Position>;
export const Summary = z.strictObject({
  status: z.enum(['matched', 'mismatch', 'incomplete']),
  shares: z.string().nullable(), allocationDigest: z.string(), fee: z.string().nullable(),
  findings: z.array(z.string()).max(500), evidenceDigest: z.string(),
  metric: z.literal('unavailable'),
});
export type Summary = z.infer<typeof Summary>;
export const Alert = z.strictObject({ id: z.string(), kind: z.enum(['change', 'undo']), block: Block,
  reasons: z.array(z.string()), invalidated: z.array(z.string()), summary: Summary.nullable() });
export type Alert = z.infer<typeof Alert>;
const Entry = z.strictObject({ block: Block, eventDigest: z.string(), summary: Summary.nullable(), alertId: z.string().nullable() });
export const State = z.strictObject({
  version: z.literal(1), scope: z.string(), sourceMode: z.enum(['live-substreams', 'recorded-substreams']),
  position: Position, startBlock: Height, cursor: z.string().max(4096), sequence: z.number().int().nonnegative(),
  base: z.strictObject({ number: z.string().regex(/^-?\d+$/), hash: HashSchema.nullable(), summary: Summary.nullable() }),
  history: z.array(Entry).max(128), alerts: z.array(Alert).max(256),
});
export type State = z.infer<typeof State>;
export function initialState(position: Position, startBlock: string, sourceMode: State['sourceMode'], identity: unknown): State {
  return State.parse({ version: 1, scope: evidenceDigest({ position, startBlock, sourceMode, identity }),
    sourceMode, position, startBlock, cursor: '', sequence: 0,
    base: { number: String(BigInt(startBlock) - 1n), hash: null, summary: null }, history: [], alerts: [] });
}
export function currentSummary(state: State): Summary | null {
  return state.history.at(-1)?.summary ?? state.base.summary;
}

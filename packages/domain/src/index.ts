import { z } from 'zod/v4';

export const AddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Expected a 20-byte EVM address').transform(value => value.toLowerCase()).brand<'Address'>();
export const ChainIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const SupportedEvmChainSchema = z.union([z.literal(1), z.literal(8453), z.literal(42161), z.literal(84532)]);
export const RawSchema = z.string().regex(/^(0|[1-9][0-9]{0,77})$/, 'Expected an unsigned integer string (at most 78 digits)');
const PositiveRawSchema = RawSchema.refine(value => BigInt(value) > 0n, 'Must be positive');
const IdSchema = z.string().regex(/^[a-zA-Z0-9:_-]{1,100}$/);
const BlockSchema = z.strictObject({ number: RawSchema, hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) });
const common = { id: IdSchema, sourceId: IdSchema, block: BlockSchema };
const AllocationSchema = z.strictObject({ target: IdSchema, balanceRaw: RawSchema });
const NodeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...common, kind: z.literal('vault'), totalSupplyRaw: PositiveRawSchema, allocations: z.array(AllocationSchema).min(1).max(1000) }),
  z.strictObject({ ...common, kind: z.literal('token'), symbol: z.string().regex(/^[a-zA-Z0-9._-]{1,20}$/), decimals: z.number().int().min(0).max(36) }),
  z.strictObject({ ...common, kind: z.literal('opaque'), reason: z.string().min(1).max(500) }),
]);
export const SnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  provenance: z.literal('synthetic'),
  name: z.string().regex(/^[a-zA-Z0-9 _-]{1,100}$/),
  chainId: ChainIdSchema,
  block: BlockSchema,
  root: z.strictObject({ owner: AddressSchema, nodeId: IdSchema, sharesRaw: RawSchema }),
  sources: z.array(z.strictObject({ id: IdSchema, status: z.enum(['healthy', 'unavailable']), detail: z.string().max(500) })).min(1).max(1000),
  nodes: z.array(NodeSchema).min(1).max(10000),
}).superRefine((snapshot, context) => {
  const unique = (ids: string[], label: string) => {
    if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', message: `Duplicate ${label}` });
  };
  unique(snapshot.sources.map(source => source.id), 'source IDs');
  unique(snapshot.nodes.map(node => node.id), 'node IDs');
  const sources = new Set(snapshot.sources.map(source => source.id));
  for (const node of snapshot.nodes) {
    if (!sources.has(node.sourceId)) context.addIssue({ code: 'custom', message: `Unknown source for ${node.id}` });
    if (node.kind === 'vault') unique(node.allocations.map(edge => edge.target), `allocation targets for ${node.id}`);
  }
});

export type Snapshot = z.infer<typeof SnapshotSchema>;
export type ExposureNode = Snapshot['nodes'][number];
export const BudgetsSchema = z.strictObject({
  maxDepth: z.number().int().min(1).max(128).default(32),
  maxVisits: z.number().int().min(1).max(100000).default(10000),
});
export type Budgets = z.infer<typeof BudgetsSchema>;
export const GapSchema = z.strictObject({
  reason: z.enum(['cycle', 'depth-limit', 'visit-limit', 'missing-node', 'source-unavailable', 'block-mismatch', 'unsupported-wrapper', 'ownership-exceeds-supply']),
  path: z.array(IdSchema),
  detail: z.string(),
});
export type Gap = z.infer<typeof GapSchema>;
const report = {
  schemaVersion: z.literal(1),
  provenance: z.literal('synthetic'),
  name: z.string(),
  chainId: ChainIdSchema,
  block: BlockSchema,
  root: SnapshotSchema.shape.root,
  verification: z.literal('unverified'),
  budgets: BudgetsSchema,
  coverage: z.strictObject({ visits: z.number().int().nonnegative(), resolvedTerminals: z.number().int().nonnegative(), unresolvedBranches: z.number().int().nonnegative(), valueCoverage: z.null() }),
  sources: SnapshotSchema.shape.sources,
  leaves: z.array(z.strictObject({ nodeId: IdSchema, symbol: z.string(), decimals: z.number().int(), amountRaw: z.string().regex(/^[0-9]+$/), verification: z.literal('unverified') })),
  steps: z.array(z.strictObject({ from: IdSchema, to: IdSchema, sourceId: IdSchema, path: z.array(IdSchema), inputRaw: z.string(), balanceRaw: RawSchema, totalSupplyRaw: PositiveRawSchema, outputRaw: z.string(), remainderNumerator: z.string() })),
  metric: z.strictObject({ kind: z.literal('unavailable'), reasons: z.array(z.string()).min(1) }),
};
export const ReceiptSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...report, kind: z.literal('complete'), gaps: z.tuple([]) }),
  z.strictObject({ ...report, kind: z.literal('partial'), gaps: z.tuple([GapSchema], GapSchema) }),
]);
export type Resolution = z.infer<typeof ReceiptSchema>;

export { formatUnits } from './units.js';

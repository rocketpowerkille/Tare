import { z } from 'zod/v4';
import { AddressSchema, BudgetsSchema, ChainIdSchema, RawSchema } from './index.js';

export const ReferenceSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const BlockV2Schema = z.strictObject({ number: RawSchema, hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value => value.toLowerCase()) });
export const EvidenceSchema = z.strictObject({
  id: ReferenceSchema, sourceId: ReferenceSchema, chainId: ChainIdSchema, block: BlockV2Schema,
  observedAt: z.iso.datetime(), origin: z.literal('synthetic-recording'),
});
export const SourceV2Schema = z.strictObject({ id: ReferenceSchema, status: z.enum(['healthy', 'unavailable']), healthBasis: z.literal('fixture-declared') });
const EvidenceRefSchema = ReferenceSchema;
export const RelationshipSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('holding'), target: AddressSchema, balanceRaw: RawSchema, evidenceId: EvidenceRefSchema }),
  z.strictObject({ kind: z.literal('debt'), target: AddressSchema, balanceRaw: RawSchema, evidenceId: EvidenceRefSchema }),
  z.strictObject({ kind: z.literal('accounting-asset'), target: AddressSchema, evidenceId: EvidenceRefSchema }),
  z.strictObject({ kind: z.literal('risk-dependency'), target: AddressSchema, evidenceId: EvidenceRefSchema }),
]);
const identity = { address: AddressSchema, evidenceId: EvidenceRefSchema };
export const NodeV2Schema = z.discriminatedUnion('kind', [
  z.strictObject({ ...identity, kind: z.literal('vault'), model: z.literal('proportional-holdings'), totalSupplyRaw: RawSchema,
    allocationCoverage: z.enum(['complete', 'partial']), relationships: z.array(RelationshipSchema).max(1000) }),
  z.strictObject({ ...identity, kind: z.literal('token'), classification: z.literal('plain-token'),
    symbol: z.string().regex(/^[a-zA-Z0-9._-]{1,20}$/), decimals: z.number().int().min(0).max(36) }),
  z.strictObject({ ...identity, kind: z.literal('opaque'), reason: z.enum(['unsupported-adapter', 'invalid-record', 'unsupported-wrapper']) }),
]);
export const PositionV2Schema = z.strictObject({ asset: AddressSchema, sharesRaw: RawSchema, evidenceId: EvidenceRefSchema });
export const SnapshotV2Schema = z.strictObject({
  schemaVersion: z.literal(2), provenance: z.literal('synthetic'),
  name: z.string().regex(/^[a-zA-Z0-9 _-]{1,100}$/), chainId: ChainIdSchema, block: BlockV2Schema,
  owner: AddressSchema, positions: z.array(PositionV2Schema).min(1).max(1000),
  sources: z.array(SourceV2Schema).min(1).max(1000), evidence: z.array(EvidenceSchema).min(1).max(20000),
  nodes: z.array(NodeV2Schema).min(1).max(10000),
}).superRefine((snapshot, context) => {
  function unique(ids: string[], name: string) {
    if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', message: `Duplicate ${name}` });
  }
  unique(snapshot.nodes.map(node => node.address), 'canonical node identities');
  unique(snapshot.positions.map(position => position.asset), 'root positions; consolidate account balances before resolution');
  unique(snapshot.sources.map(source => source.id), 'source IDs');
  unique(snapshot.evidence.map(item => item.id), 'evidence IDs');
  const evidence = new Set(snapshot.evidence.map(item => item.id));
  const sources = new Set(snapshot.sources.map(source => source.id));
  for (const item of snapshot.evidence) if (!sources.has(item.sourceId)) context.addIssue({ code: 'custom', message: `Unknown source ${item.sourceId}` });
  const refs = [...snapshot.positions.map(position => position.evidenceId), ...snapshot.nodes.map(node => node.evidenceId)];
  for (const node of snapshot.nodes) if (node.kind === 'vault') {
    unique(node.relationships.map(edge => `${edge.kind}:${edge.target}`), `relationships at ${node.address}`);
    refs.push(...node.relationships.map(edge => edge.evidenceId));
  }
  for (const ref of refs) if (!evidence.has(ref)) context.addIssue({ code: 'custom', message: `Unknown evidence ${ref}` });
});
export type SnapshotV2 = z.infer<typeof SnapshotV2Schema>;
export type NodeV2 = z.infer<typeof NodeV2Schema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export function assetId(chainId: number, address: string): string {
  return `eip155:${ChainIdSchema.parse(chainId)}:erc20:${AddressSchema.parse(address)}`;
}
export function contractId(chainId: number, address: string): string {
  return `eip155:${ChainIdSchema.parse(chainId)}:contract:${AddressSchema.parse(address)}`;
}
const AssetIdSchema = z.string().regex(/^eip155:[1-9][0-9]*:erc20:0x[0-9a-f]{40}$/);
const ContractIdSchema = z.string().regex(/^eip155:[1-9][0-9]*:contract:0x[0-9a-f]{40}$/);
const GraphIdSchema = z.union([AssetIdSchema, ContractIdSchema]);
const AmountSchema = z.string().regex(/^(0|[1-9][0-9]*)$/).max(160);
export const FindingV2Schema = z.strictObject({
  reason: z.enum(['cycle', 'depth-limit', 'visit-limit', 'edge-limit', 'missing-node', 'source-unavailable', 'block-mismatch',
    'unsupported-adapter', 'invalid-record', 'unsupported-wrapper', 'zero-supply', 'ownership-exceeds-supply', 'incomplete-allocation', 'unsupported-debt']),
  path: z.array(GraphIdSchema).min(1), evidenceId: EvidenceRefSchema.optional(),
});
export type FindingV2 = z.infer<typeof FindingV2Schema>;
export const BudgetsV2Schema = BudgetsSchema.extend({ maxEdges: z.number().int().min(1).max(100000).default(20000) });
export type BudgetsV2 = z.infer<typeof BudgetsV2Schema>;
const baseReceipt = {
  schemaVersion: z.literal(2), provenance: z.literal('synthetic'), name: z.string(),
  snapshotDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  chainId: ChainIdSchema, block: BlockV2Schema, owner: AddressSchema,
  positions: z.array(PositionV2Schema), sources: z.array(SourceV2Schema), evidence: z.array(EvidenceSchema),
  budgets: BudgetsV2Schema,
  verification: z.strictObject({ kind: z.literal('unverified'), reason: z.literal('synthetic-evidence') }),
  metric: z.strictObject({ kind: z.literal('unavailable'), blockers: z.array(z.enum(['synthetic-evidence', 'incomplete-resolution', 'missing-independent-verification', 'missing-valuation'])).min(1) }),
  leaves: z.array(z.strictObject({ assetId: AssetIdSchema, symbol: z.string(), decimals: z.number().int().min(0).max(36), amountRaw: AmountSchema, evidenceIds: z.array(EvidenceRefSchema).min(1), verification: z.literal('unverified') })),
  steps: z.array(z.strictObject({ from: AssetIdSchema, to: AssetIdSchema, path: z.array(AssetIdSchema),
    evidenceId: EvidenceRefSchema, inputRaw: AmountSchema, balanceRaw: RawSchema, totalSupplyRaw: RawSchema,
    outputRaw: AmountSchema, remainderNumerator: AmountSchema })),
  dependencies: z.array(z.discriminatedUnion('kind', [
    z.strictObject({ from: AssetIdSchema, to: AssetIdSchema, kind: z.literal('accounting-asset'), evidenceId: EvidenceRefSchema }),
    z.strictObject({ from: AssetIdSchema, to: ContractIdSchema, kind: z.literal('risk-dependency'), evidenceId: EvidenceRefSchema }),
  ])),
  coverage: z.strictObject({ visits: z.number().int().nonnegative(), resolvedTerminals: z.number().int().nonnegative(), unresolvedFindings: z.number().int().nonnegative(), valueCoverage: z.null() }),
};
export const ReceiptV2Schema = z.discriminatedUnion('kind', [
  z.strictObject({ ...baseReceipt, kind: z.literal('complete'), findings: z.tuple([]) }),
  z.strictObject({ ...baseReceipt, kind: z.literal('partial'), findings: z.tuple([FindingV2Schema], FindingV2Schema) }),
]).superRefine((receipt, context) => {
  if (receipt.coverage.unresolvedFindings !== receipt.findings.length) context.addIssue({ code: 'custom', message: 'Coverage does not match findings' });
  for (const blocker of ['synthetic-evidence', 'missing-independent-verification', 'missing-valuation'] as const) {
    if (!receipt.metric.blockers.includes(blocker)) context.addIssue({ code: 'custom', message: `Missing metric blocker: ${blocker}` });
  }
  if (receipt.kind === 'partial' && !receipt.metric.blockers.includes('incomplete-resolution')) context.addIssue({ code: 'custom', message: 'Partial result must block metrics' });
  const refs = new Set(receipt.evidence.map(item => item.id));
  if (refs.size !== receipt.evidence.length) context.addIssue({ code: 'custom', message: 'Duplicate receipt evidence IDs' });
  const sources = new Set(receipt.sources.map(source => source.id));
  for (const item of receipt.evidence) if (!sources.has(item.sourceId)) context.addIssue({ code: 'custom', message: 'Receipt evidence references missing source' });
  for (const ref of [...receipt.positions.map(position => position.evidenceId), ...receipt.steps.map(step => step.evidenceId), ...receipt.dependencies.map(edge => edge.evidenceId), ...receipt.leaves.flatMap(leaf => leaf.evidenceIds), ...receipt.findings.flatMap(finding => finding.evidenceId ? [finding.evidenceId] : [])]) {
    if (!refs.has(ref)) context.addIssue({ code: 'custom', message: 'Receipt references missing evidence' });
  }
});
export type ResolutionV2 = z.infer<typeof ReceiptV2Schema>;

import { z } from 'zod/v4';
import { AddressSchema, ChainIdSchema, RawSchema } from '../../domain/src/index.js';
import { BlockV2Schema, EvidenceSchema, NodeV2Schema, PositionV2Schema, ReferenceSchema, SnapshotV2Schema, SourceV2Schema } from '../../domain/src/v2.js';
import type { NodeV2, SnapshotV2 } from '../../domain/src/v2.js';

const RecordSchema = z.strictObject({ address: AddressSchema, evidenceId: ReferenceSchema, adapter: ReferenceSchema, response: z.unknown() });
export const RecordingSchema = z.strictObject({
  recordingVersion: z.literal(1), origin: z.literal('synthetic-recording'),
  name: z.string(), chainId: ChainIdSchema, block: BlockV2Schema, owner: AddressSchema,
  positions: z.array(PositionV2Schema).min(1).max(1000), sources: z.array(SourceV2Schema).min(1).max(1000),
  evidence: z.array(EvidenceSchema).min(1).max(20000), records: z.array(RecordSchema).min(1).max(10000),
});
export type RecordedObservation = z.infer<typeof RecordSchema>;
export interface ExposureAdapter {
  readonly id: string;
  normalize(record: RecordedObservation): NodeV2;
}

const balance = z.strictObject({ token: AddressSchema, raw_balance: RawSchema, evidence_id: ReferenceSchema });
const reference = z.strictObject({ token: AddressSchema, evidence_id: ReferenceSchema });
const ResponseSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('vault'), total_supply: RawSchema, allocations_complete: z.boolean(),
    holdings: z.array(balance).max(1000), debts: z.array(balance).max(1000),
    accounting_asset: reference.nullable(), risk_dependencies: z.array(reference).max(1000) }),
  z.strictObject({ type: z.literal('token'), classification: z.enum(['plain-token', 'unsupported-wrapper']),
    symbol: z.string().regex(/^[a-zA-Z0-9._-]{1,20}$/), decimals: z.number().int().min(0).max(36) }),
]);

// A fixture adapter contract, deliberately not an ERC-4626 or protocol implementation.
export const proportionalRecordingAdapter: ExposureAdapter = {
  id: 'fixture-holdings-v1',
  normalize(record) {
    const input = ResponseSchema.parse(record.response);
    const identity = { address: record.address, evidenceId: record.evidenceId };
    if (input.type === 'token') return input.classification === 'unsupported-wrapper'
      ? { ...identity, kind: 'opaque', reason: 'unsupported-wrapper' }
      : { ...identity, kind: 'token', classification: 'plain-token', symbol: input.symbol, decimals: input.decimals };
    return NodeV2Schema.parse({
      ...identity, kind: 'vault', model: 'proportional-holdings', totalSupplyRaw: input.total_supply,
      allocationCoverage: input.allocations_complete ? 'complete' : 'partial',
      relationships: [
        ...input.holdings.map(item => ({ kind: 'holding', target: item.token, balanceRaw: item.raw_balance, evidenceId: item.evidence_id })),
        ...input.debts.map(item => ({ kind: 'debt', target: item.token, balanceRaw: item.raw_balance, evidenceId: item.evidence_id })),
        ...(input.accounting_asset ? [{ kind: 'accounting-asset', target: input.accounting_asset.token, evidenceId: input.accounting_asset.evidence_id }] : []),
        ...input.risk_dependencies.map(item => ({ kind: 'risk-dependency', target: item.token, evidenceId: item.evidence_id })),
      ],
    });
  },
};

export function normalizeRecording(input: unknown, adapters: readonly ExposureAdapter[] = [proportionalRecordingAdapter]): SnapshotV2 {
  const recording = RecordingSchema.parse(input);
  const registry = new Map(adapters.map(adapter => [adapter.id, adapter]));
  if (registry.size !== adapters.length) throw new Error('Duplicate adapter registration');
  const nodes = recording.records.map(record => {
    const adapter = registry.get(record.adapter);
    const opaque = (reason: 'unsupported-adapter' | 'invalid-record'): NodeV2 => ({ address: record.address, evidenceId: record.evidenceId, kind: 'opaque', reason });
    if (!adapter) return opaque('unsupported-adapter');
    try {
      const node = NodeV2Schema.parse(adapter.normalize(record));
      if (node.address !== record.address || node.evidenceId !== record.evidenceId) return opaque('invalid-record');
      return node;
    } catch (error) {
      if (error instanceof z.ZodError) return opaque('invalid-record');
      // Programming failures must fail the command, not masquerade as source outages.
      throw error;
    }
  });
  return SnapshotV2Schema.parse({ schemaVersion: 2, provenance: 'synthetic', name: recording.name,
    chainId: recording.chainId, block: recording.block, owner: recording.owner, positions: recording.positions,
    sources: recording.sources, evidence: recording.evidence, nodes });
}

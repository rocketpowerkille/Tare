import { z } from 'zod/v4';
import { createHash } from 'node:crypto';
import { AddressSchema, ChainIdSchema, RawSchema } from './index.js';
import { CallObservationSchema, FailedCallSchema, HealthSchema, RpcBlockSchema } from '../../sources/src/evm.js';
import { DiscoverySchema, VaultMetadataSchema } from '../../sources/src/morpho.js';

export const UintSchema = RawSchema.refine(value => BigInt(value) < 2n ** 256n, 'Value exceeds uint256');
export const CaptureSchema = z.strictObject({
  captureVersion: z.literal(1), origin: z.literal('rpc-observed'), adapter: z.literal('metamorpho-v1-blue-v1'),
  chainId: z.literal(1), owner: AddressSchema, vault: AddressSchema, capturedAt: z.iso.datetime(),
  block: RpcBlockSchema.nullable(), blockConfirmed: z.boolean(),
  metadata: VaultMetadataSchema.nullable(), discovery: DiscoverySchema.nullable(),
  observations: z.array(CallObservationSchema).max(1000), health: z.array(HealthSchema).max(2),
  failedCalls: z.array(FailedCallSchema).max(1000),
  acquisitionFailures: z.array(z.strictObject({ stage: z.string().max(80), code: z.string().max(80) })).max(100),
}).superRefine((capture, context) => {
  const keys = new Set<string>();
  const ids = new Set<string>();
  for (const observation of capture.observations) {
    const key = `${observation.to}:${observation.data}`;
    if (keys.has(key)) context.addIssue({ code: 'custom', message: 'Duplicate recorded call' });
    keys.add(key);
    if (ids.has(observation.id)) context.addIssue({ code: 'custom', message: 'Duplicate observation ID' });
    ids.add(observation.id);
    if (observation.blockHash !== capture.block?.hash) context.addIssue({ code: 'custom', message: 'Recorded call block mismatch' });
  }
  for (const call of capture.failedCalls) {
    if (call.blockHash !== capture.block?.hash) context.addIssue({ code: 'custom', message: 'Failed call block mismatch' });
  }
  if (capture.metadata && (capture.metadata.address !== capture.vault || capture.metadata.chain.id !== capture.chainId)) context.addIssue({ code: 'custom', message: 'Metadata identity mismatch' });
  if (capture.blockConfirmed && !capture.block) context.addIssue({ code: 'custom', message: 'Confirmed capture requires a block' });
});
export type LiveCapture = z.infer<typeof CaptureSchema>;
export function captureDigest(capture: LiveCapture): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(capture)).digest('hex')}`;
}
export const MarketObservationSchema = z.strictObject({
  marketId: z.string().regex(/^0x[0-9a-f]{64}$/),
  loanToken: AddressSchema, collateralToken: AddressSchema, oracle: AddressSchema, irm: AddressSchema, lltvRaw: UintSchema,
  supplySharesRaw: UintSchema, expectedSupplyAssetsRaw: UintSchema, expectedSupplySharesRaw: UintSchema,
  expectedBorrowAssetsRaw: UintSchema, vaultAssetsRaw: UintSchema,
  attributedAssetsRaw: UintSchema.nullable(), attributionRemainder: UintSchema.nullable(),
  type: z.literal('lending-receivable'), backingVerification: z.literal('unverified'),
});
export type MarketObservation = z.infer<typeof MarketObservationSchema>;
export const VaultObservationSchema = z.strictObject({
  address: AddressSchema, asset: AddressSchema, decimals: z.number().int().min(0).max(36),
  sharesRaw: UintSchema, totalSupplyRaw: UintSchema, totalAssetsRaw: UintSchema,
  convertToAssetsRaw: UintSchema, feeRaw: UintSchema, feeSharesRaw: UintSchema,
  virtualSharesRaw: UintSchema, queueLength: z.number().int().min(0).max(1000),
});
export const LiveFindingSchema = z.strictObject({ stage: z.string().max(100), code: z.string().max(80), marketId: z.string().optional() });
const base = {
  schemaVersion: z.literal(3), protocol: z.literal('metamorpho-v1-blue-v1'),
  sourceMode: z.enum(['live-rpc', 'recorded-rpc']), chainId: ChainIdSchema, owner: AddressSchema,
  scope: z.literal('vault-to-blue-loan-receivables'),
  captureDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/), capture: CaptureSchema,
  vault: VaultObservationSchema.nullable(), markets: z.array(MarketObservationSchema).max(64),
  unattributedAssetsRaw: UintSchema.nullable(),
  verification: z.literal('not-independently-verified'),
  metric: z.strictObject({ kind: z.literal('unavailable'), reasons: z.tuple([z.literal('missing-independent-backing-verification'), z.literal('missing-valuation')]) }),
  coverage: z.strictObject({ expectedMarkets: z.number().int().nonnegative().nullable(), observedMarkets: z.number().int().nonnegative(), valueCoverage: z.null() }),
};
export const LiveReceiptSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...base, kind: z.literal('complete'), findings: z.tuple([]) }),
  z.strictObject({ ...base, kind: z.literal('partial'), findings: z.tuple([LiveFindingSchema], LiveFindingSchema) }),
]).superRefine((receipt, context) => {
  const issue = (message: string) => context.addIssue({ code: 'custom', message });
  if (receipt.captureDigest !== captureDigest(receipt.capture)) issue('Capture digest mismatch');
  if (receipt.chainId !== receipt.capture.chainId || receipt.owner !== receipt.capture.owner) context.addIssue({ code: 'custom', message: 'Receipt/capture identity mismatch' });
  if (receipt.coverage.observedMarkets !== receipt.markets.length) context.addIssue({ code: 'custom', message: 'Market coverage mismatch' });
  if (new Set(receipt.markets.map(market => market.marketId)).size !== receipt.markets.length) issue('Duplicate receipt market');
  if (receipt.coverage.expectedMarkets !== (receipt.vault?.queueLength ?? null)) issue('Queue coverage mismatch');
  if (receipt.vault && receipt.vault.address !== receipt.capture.vault) issue('Receipt vault identity mismatch');
  if (!receipt.capture.blockConfirmed && (receipt.unattributedAssetsRaw !== null || receipt.markets.some(m => m.attributedAssetsRaw !== null))) issue('Unconfirmed block cannot support attribution');
  if (receipt.vault && receipt.unattributedAssetsRaw !== null) {
    const attributed = receipt.markets.reduce((sum, market) => sum + BigInt(market.attributedAssetsRaw ?? '0'), 0n);
    if (attributed + BigInt(receipt.unattributedAssetsRaw) !== BigInt(receipt.vault.convertToAssetsRaw)) issue('Account quote is not conserved');
  }
  if (receipt.kind === 'complete' && (!receipt.capture.metadata || receipt.capture.acquisitionFailures.length || receipt.unattributedAssetsRaw === null)) issue('Complete receipt requires root evidence and accounting');
  if (receipt.kind === 'complete' && (!receipt.vault || !receipt.capture.blockConfirmed || receipt.coverage.expectedMarkets !== receipt.markets.length || receipt.markets.some(m => m.attributedAssetsRaw === null))) context.addIssue({ code: 'custom', message: 'Incomplete evidence cannot produce a complete receipt' });
});
export type LiveReceipt = z.infer<typeof LiveReceiptSchema>;

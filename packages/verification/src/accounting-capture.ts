import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { UintSchema } from '../../domain/src/live.js';
import { HashSchema, HexDataSchema } from '../../sources/src/evm.js';
import { RpcEvidenceSchema } from '../../sources/src/recorded.js';
import { DeploymentSchema, GraphShareDataSchema } from '../../sources/src/the-graph.js';

export const AccountingDataSchema = z.object({
  _meta: GraphShareDataSchema.shape._meta,
  accountingState: z.object({
    id: AddressSchema, chainId: z.literal(1), blockNumber: UintSchema, blockHash: HashSchema,
    timestamp: UintSchema,
    reads: z.array(z.object({ to: AddressSchema, data: HexDataSchema, result: HexDataSchema })).max(264),
  }).nullable(),
});
export const AccountingHeadDataSchema = z.object({
  _meta: GraphShareDataSchema.shape._meta,
});
export const AccountingCaptureSchema = z.strictObject({
  captureVersion: z.literal(1), scope: z.literal('morpho-v1-accounting'), chainId: z.literal(1),
  vault: AddressSchema, capturedAt: z.iso.datetime(), expectedDeployment: DeploymentSchema.nullable(),
  rpc: RpcEvidenceSchema, graph: AccountingDataSchema.nullable(),
  failures: z.array(z.string().max(80)).max(100),
});
export type AccountingCapture = z.infer<typeof AccountingCaptureSchema>;
export const ACCOUNTING_QUERY = `query TareAccounting($block:Block_height!,$vault:ID!){
  _meta(block:$block){block{number hash} deployment hasIndexingErrors}
  accountingState(id:$vault,block:$block){id chainId blockNumber blockHash timestamp reads(first:264){to data result}}
}`;
export const ACCOUNTING_HEAD_QUERY = `query TareAccountingHead{
  _meta{block{number hash} deployment hasIndexingErrors}
}`;

import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { HashSchema } from './evm.js';
import { SourceFailure, postJson, validateHttpUrl } from './http.js';

const Raw = z.string().regex(/^(0|[1-9][0-9]{0,77})$/).refine(value => BigInt(value) < 2n ** 256n);
export const DeploymentSchema = z.string().regex(/^[A-Za-z0-9]{10,128}$/);
export const GraphShareDataSchema = z.object({
  _meta: z.object({
    block: z.object({ number: z.number().int().min(0).max(2147483647), hash: HashSchema.nullable() }),
    deployment: DeploymentSchema, hasIndexingErrors: z.boolean(),
  }),
  vault: z.object({ id: AddressSchema, chainId: z.number().int().positive(), asset: AddressSchema,
    shareDecimals: z.number().int().min(0).max(255), totalShares: Raw, indexedFromBlock: Raw, lastUpdateBlock: Raw }).nullable(),
  accountBalance: z.object({ id: z.string().max(100), account: AddressSchema,
    vault: z.object({ id: AddressSchema }), shares: Raw, lastUpdateBlock: Raw }).nullable(),
});
export const GraphShareObservationSchema = z.strictObject({
  source: z.literal('the-graph'), schema: z.literal('tare-share-ledger-v1'),
  observedAt: z.iso.datetime(), requestedBlock: z.number().int().min(0).max(2147483647),
  data: GraphShareDataSchema,
});
export type GraphShareObservation = z.infer<typeof GraphShareObservationSchema>;
export const GraphHealthSchema = z.strictObject({
  source: z.literal('the-graph'), status: z.enum(['not-requested', 'healthy', 'unavailable']),
  requests: z.number().int().nonnegative(), failures: z.number().int().nonnegative(), elapsedMs: z.number().nonnegative(),
});
export const SHARE_QUERY = `query TareShares($block:Block_height!,$vault:ID!,$balance:ID!){
  _meta(block:$block){block{number hash} deployment hasIndexingErrors}
  vault(id:$vault,block:$block){id chainId asset shareDecimals totalShares indexedFromBlock lastUpdateBlock}
  accountBalance(id:$balance,block:$block){id account vault{id} shares lastUpdateBlock}
}`;
export class GraphShareClient {
  readonly health: z.infer<typeof GraphHealthSchema> = { source: 'the-graph', status: 'not-requested', requests: 0, failures: 0, elapsedMs: 0 };
  private readonly url: string;
  constructor(url: string, private readonly timeoutMs = 10000, private readonly apiKey?: string) {
    this.url = validateHttpUrl(url);
    z.number().int().min(100).max(60000).parse(timeoutMs);
    if (apiKey) {
      if (!/^[\x21-\x7e]+$/.test(apiKey)) throw new Error('GRAPH_API_KEY has invalid characters');
      const parsed = new URL(this.url);
      if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) throw new Error('Graph authentication requires HTTPS outside localhost');
    }
  }
  async readAt(vaultInput: string, ownerInput: string, block: number): Promise<GraphShareObservation> {
    const vault = AddressSchema.parse(vaultInput); const owner = AddressSchema.parse(ownerInput);
    z.number().int().min(0).max(2147483647).parse(block);
    this.health.requests++; const start = performance.now();
    try {
      const raw = await postJson(this.url, { query: SHARE_QUERY, variables: { block: { number: block }, vault, balance: `${vault}-${owner}` } }, this.timeoutMs, 1024 * 1024, this.apiKey ? `Bearer ${this.apiKey}` : undefined);
      const envelope = z.object({ data: z.unknown().optional(), errors: z.array(z.unknown()).optional() }).safeParse(raw);
      if (!envelope.success) throw new SourceFailure('invalid-response', 'Invalid Graph response envelope');
      if (envelope.data.errors?.length) throw new SourceFailure('graphql-error', 'Graph query failed; partial data was rejected');
      const data = GraphShareDataSchema.safeParse(envelope.data.data);
      if (!data.success) throw new SourceFailure('invalid-response', 'Graph response does not implement tare-share-ledger-v1');
      this.health.status = 'healthy';
      return { source: 'the-graph', schema: 'tare-share-ledger-v1', requestedBlock: block, observedAt: new Date().toISOString(), data: data.data };
    } catch (error) {
      this.health.failures++; this.health.status = 'unavailable'; throw error;
    } finally { this.health.elapsedMs += performance.now() - start; }
  }
}

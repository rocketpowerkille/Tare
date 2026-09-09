import { z } from 'zod/v4';
import { AddressSchema, ChainIdSchema, RawSchema } from '../../domain/src/index.js';
import type { Health } from './evm.js';
import { postJson, SourceFailure, validateHttpUrl } from './http.js';

export const MORPHO_GRAPHQL = 'https://api.morpho.org/graphql';
export const VaultMetadataSchema = z.object({
  address: AddressSchema, name: z.string().min(1).max(200),
  asset: z.object({ address: AddressSchema, symbol: z.string().regex(/^[a-zA-Z0-9._-]{1,20}$/), decimals: z.number().int().min(0).max(36) }),
  chain: z.object({ id: ChainIdSchema }),
});
export type VaultMetadata = z.infer<typeof VaultMetadataSchema>;
const PositionSchema = z.object({
  user: z.object({ address: AddressSchema }),
  vault: z.object({ address: AddressSchema, name: z.string().max(200), chain: z.object({ id: ChainIdSchema }) }),
  state: z.object({ shares: RawSchema }).nullable(),
});
const PageSchema = z.object({ vaultPositions: z.object({
  items: z.array(PositionSchema).max(100),
  pageInfo: z.object({ count: z.number().int().nonnegative(), countTotal: z.number().int().nonnegative(), skip: z.number().int().nonnegative(), limit: z.number().int().positive() }),
}) });
export const DiscoverySchema = z.strictObject({
  source: z.literal('morpho-graphql'), scope: z.literal('indexed-morpho-v1-only'), observedAt: z.iso.datetime(),
  blockAligned: z.literal(false), complete: z.boolean(), issues: z.array(z.enum(['limit', 'index-changed', 'missing-state'])),
  positions: z.array(z.strictObject({ owner: AddressSchema, vault: AddressSchema, name: z.string(), reportedSharesRaw: RawSchema.nullable() })),
});
export type Discovery = z.infer<typeof DiscoverySchema>;
export class MorphoDiscovery {
  readonly health: Health = { source: 'morpho-graphql', status: 'healthy', requests: 0, failures: 0, elapsedMs: 0 };
  private readonly url: string;
  constructor(url = MORPHO_GRAPHQL, private readonly timeoutMs = 10000) { this.url = validateHttpUrl(url); }
  private async query(query: string, variables: object): Promise<unknown> {
    this.health.requests++;
    const start = performance.now();
    try {
      const raw = await postJson(this.url, { query, variables }, this.timeoutMs);
      const result = z.object({ data: z.unknown().optional(), errors: z.array(z.unknown()).optional() }).safeParse(raw);
      if (!result.success) throw new SourceFailure('invalid-response', 'Invalid GraphQL envelope');
      if (result.data.errors?.length) throw new SourceFailure('graphql-error', 'GraphQL returned errors; partial data is not accepted');
      if (result.data.data === undefined || result.data.data === null) throw new SourceFailure('invalid-response', 'GraphQL omitted its data');
      return result.data.data;
    } catch (error) {
      this.health.failures++; this.health.status = this.health.failures === this.health.requests ? 'unavailable' : 'degraded'; throw error;
    } finally { this.health.elapsedMs += performance.now() - start; }
  }
  async vault(address: string, chainId: number): Promise<VaultMetadata> {
    const vault = AddressSchema.parse(address); const chain = ChainIdSchema.parse(chainId);
    const raw = await this.query('query($vault:String!,$chain:Int!){vaultByAddress(address:$vault,chainId:$chain){address name asset{address symbol decimals} chain{id}}}', { vault, chain });
    const parsed = z.object({ vaultByAddress: VaultMetadataSchema }).safeParse(raw);
    if (!parsed.success || parsed.data.vaultByAddress.address !== vault || parsed.data.vaultByAddress.chain.id !== chain) throw new SourceFailure('invalid-response', 'GraphQL vault metadata does not match the requested vault and chain');
    return parsed.data.vaultByAddress;
  }
  async positions(input: { chainId: number; owner?: string; vault?: string; maxPositions?: number }): Promise<Discovery> {
    const chain = ChainIdSchema.parse(input.chainId);
    const owner = input.owner === undefined ? undefined : AddressSchema.parse(input.owner);
    const vault = input.vault === undefined ? undefined : AddressSchema.parse(input.vault);
    if (!owner && !vault) throw new Error('Discovery requires an owner or vault filter');
    const max = z.number().int().min(1).max(500).parse(input.maxPositions ?? 100);
    const positions: Discovery['positions'] = [];
    const issues: Discovery['issues'] = [];
    const seen = new Set<string>();
    let total: number | undefined;
    while (positions.length < max) {
      const first = Math.min(50, max - positions.length); const skip = positions.length;
      const query = `query($chain:Int!,$first:Int!,$skip:Int!${owner ? ',$owner:String!' : ''}${vault ? ',$vault:String!' : ''}){
        vaultPositions(first:$first,skip:$skip,orderBy:Shares,orderDirection:Desc,where:{chainId_in:[$chain]${owner ? ',userAddress_in:[$owner]' : ''}${vault ? ',vaultAddress_in:[$vault]' : ''}}){
          items{user{address}vault{address name chain{id}}state{shares}}pageInfo{count countTotal skip limit}}}`;
      const raw = await this.query(query, { chain, first, skip, ...(owner ? { owner } : {}), ...(vault ? { vault } : {}) });
      const parsed = PageSchema.safeParse(raw);
      if (!parsed.success) throw new SourceFailure('invalid-response', 'GraphQL position schema changed');
      const page = parsed.data.vaultPositions;
      if (page.pageInfo.skip !== skip || page.pageInfo.count !== page.items.length || page.items.length > first || page.pageInfo.countTotal < skip + page.items.length) throw new SourceFailure('invalid-response', 'GraphQL pagination is inconsistent');
      if (total !== undefined && total !== page.pageInfo.countTotal) { issues.push('index-changed'); break; }
      total = page.pageInfo.countTotal;
      for (const item of page.items) {
        if (item.vault.chain.id !== chain || (owner && item.user.address !== owner) || (vault && item.vault.address !== vault)) throw new SourceFailure('invalid-response', 'Discovery returned a position outside the requested scope');
        const key = `${item.user.address}:${item.vault.address}`;
        if (seen.has(key)) { issues.push('index-changed'); break; }
        seen.add(key);
        if (item.state === null) issues.push('missing-state');
        positions.push({ owner: item.user.address, vault: item.vault.address, name: item.vault.name, reportedSharesRaw: item.state?.shares ?? null });
      }
      if (issues.includes('index-changed') || positions.length >= total) break;
      if (page.items.length === 0) throw new SourceFailure('invalid-response', 'GraphQL pagination stopped before its reported total');
    }
    if (total !== undefined && positions.length < total && !issues.includes('index-changed')) issues.push('limit');
    return DiscoverySchema.parse({ source: 'morpho-graphql', scope: 'indexed-morpho-v1-only', observedAt: new Date().toISOString(), blockAligned: false, complete: issues.length === 0, issues: [...new Set(issues)], positions });
  }
}

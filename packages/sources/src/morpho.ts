import { z } from 'zod/v4';
import { AddressSchema, ChainIdSchema, RawSchema } from '../../domain/src/index.js';
import type { Health } from './evm.js';
import { postJson, SourceFailure, validateHttpUrl } from './http.js';

export const MORPHO_GRAPHQL = 'https://api.morpho.org/graphql';
export const MORPHO_CHAINS = [1, 8453, 42161] as const;
export const MorphoChainSchema = z.union([z.literal(1), z.literal(8453), z.literal(42161)]);
export type MorphoChainId = z.infer<typeof MorphoChainSchema>;

const AssetSchema = z.object({
  address: AddressSchema,
  symbol: z.string().regex(/^[a-zA-Z0-9._-]{1,20}$/),
  decimals: z.number().int().min(0).max(36),
});
const ApiRawSchema = z.union([RawSchema, z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)])
  .transform(value => String(value));
export const VaultMetadataSchema = z.object({
  address: AddressSchema,
  name: z.string().min(1).max(200),
  asset: AssetSchema,
  chain: z.object({ id: ChainIdSchema }),
});
export type VaultMetadata = z.infer<typeof VaultMetadataSchema>;

const V1PositionSchema = z.object({
  vault: VaultMetadataSchema,
  state: z.object({ shares: ApiRawSchema, assets: ApiRawSchema }).nullable(),
});
const V2PositionSchema = z.object({
  vault: VaultMetadataSchema,
  shares: ApiRawSchema,
  assets: ApiRawSchema,
});
const UserSchema = z.object({
  userByAddress: z.object({
    vaultPositions: z.array(V1PositionSchema).max(500),
    vaultV2Positions: z.array(V2PositionSchema).max(500),
  }).nullable(),
});
const LegacyPageSchema = z.object({ vaultPositions: z.object({
  items: z.array(z.object({ user: z.object({ address: AddressSchema }), vault: VaultMetadataSchema,
    state: z.object({ shares: ApiRawSchema, assets: ApiRawSchema }).nullable() })).max(100),
  pageInfo: z.object({ countTotal: z.number().int().nonnegative() }),
}) });

export const DiscoveredPositionSchema = z.strictObject({
  owner: AddressSchema,
  vault: AddressSchema,
  name: z.string(),
  protocol: z.literal('morpho'),
  version: z.enum(['v1', 'v2']),
  chainId: MorphoChainSchema,
  asset: AssetSchema,
  reportedSharesRaw: RawSchema.nullable(),
  reportedAssetsRaw: RawSchema.nullable(),
});
const CurrentDiscoverySchema = z.strictObject({
  source: z.literal('morpho-graphql'),
  scope: z.literal('indexed-morpho-v1-and-v2'),
  observedAt: z.iso.datetime(),
  blockAligned: z.literal(false),
  complete: z.boolean(),
  issues: z.array(z.enum(['limit', 'chain-unavailable', 'missing-state'])),
  positions: z.array(DiscoveredPositionSchema).max(500),
});
const LegacyDiscoverySchema = z.strictObject({
  source: z.literal('morpho-graphql'), scope: z.literal('indexed-morpho-v1-only'), observedAt: z.iso.datetime(),
  blockAligned: z.literal(false), complete: z.boolean(), issues: z.array(z.enum(['limit', 'index-changed', 'missing-state'])),
  positions: z.array(z.strictObject({ owner: AddressSchema, vault: AddressSchema, name: z.string(), reportedSharesRaw: RawSchema.nullable() })),
});
export const DiscoverySchema = z.union([CurrentDiscoverySchema, LegacyDiscoverySchema]);
export type Discovery = z.infer<typeof CurrentDiscoverySchema>;

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
      this.health.failures++;
      this.health.status = this.health.failures === this.health.requests ? 'unavailable' : 'degraded';
      throw error;
    } finally { this.health.elapsedMs += performance.now() - start; }
  }

  async vault(address: string, chainId: number): Promise<VaultMetadata> {
    const vault = AddressSchema.parse(address); const chain = ChainIdSchema.parse(chainId);
    const raw = await this.query('query($vault:String!,$chain:Int!){vaultByAddress(address:$vault,chainId:$chain){address name asset{address symbol decimals} chain{id}}}', { vault, chain });
    const parsed = z.object({ vaultByAddress: VaultMetadataSchema }).safeParse(raw);
    if (!parsed.success || parsed.data.vaultByAddress.address !== vault || parsed.data.vaultByAddress.chain.id !== chain) throw new SourceFailure('invalid-response', 'GraphQL vault metadata does not match the requested vault and chain');
    return parsed.data.vaultByAddress;
  }

  private async ownerPositions(owner: z.output<typeof AddressSchema>, chainId: MorphoChainId): Promise<Discovery['positions']> {
    const query = `query($owner:String!,$chain:Int!){
      userByAddress(address:$owner,chainId:$chain){
        vaultPositions{vault{address name asset{address symbol decimals}chain{id}}state{shares assets}}
        vaultV2Positions{vault{address name asset{address symbol decimals}chain{id}}shares assets}
      }
    }`;
    const parsed = UserSchema.safeParse(await this.query(query, { owner, chain: chainId }));
    if (!parsed.success) throw new SourceFailure('invalid-response', 'Morpho user position schema changed');
    const user = parsed.data.userByAddress;
    if (!user) return [];
    const checkVault = (vault: VaultMetadata) => {
      if (vault.chain.id !== chainId) throw new SourceFailure('invalid-response', 'Discovery returned a position on another chain');
    };
    return [
      ...user.vaultPositions.map(position => {
        checkVault(position.vault);
        return DiscoveredPositionSchema.parse({ owner, vault: position.vault.address, name: position.vault.name, protocol: 'morpho',
          version: 'v1' as const, chainId, asset: position.vault.asset,
          reportedSharesRaw: position.state?.shares ?? null, reportedAssetsRaw: position.state?.assets ?? null });
      }),
      ...user.vaultV2Positions.map(position => {
        checkVault(position.vault);
        return DiscoveredPositionSchema.parse({ owner, vault: position.vault.address, name: position.vault.name, protocol: 'morpho',
          version: 'v2' as const, chainId, asset: position.vault.asset,
          reportedSharesRaw: position.shares, reportedAssetsRaw: position.assets });
      }),
    ];
  }

  private async vaultOwners(vault: z.output<typeof AddressSchema>, chainId: MorphoChainId): Promise<Discovery['positions']> {
    const query = `query($vault:String!,$chain:Int!){vaultPositions(first:100,skip:0,orderBy:Shares,orderDirection:Desc,where:{chainId_in:[$chain],vaultAddress_in:[$vault]}){items{user{address}vault{address name asset{address symbol decimals}chain{id}}state{shares assets}}pageInfo{countTotal}}}`;
    const parsed = LegacyPageSchema.safeParse(await this.query(query, { vault, chain: chainId }));
    if (!parsed.success) throw new SourceFailure('invalid-response', 'Morpho vault position schema changed');
    return parsed.data.vaultPositions.items.map(position => DiscoveredPositionSchema.parse({
      owner: position.user.address, vault: position.vault.address, name: position.vault.name, protocol: 'morpho', version: 'v1', chainId,
      asset: position.vault.asset, reportedSharesRaw: position.state?.shares ?? null, reportedAssetsRaw: position.state?.assets ?? null,
    }));
  }

  async positions(input: { chainIds?: number[]; chainId?: number; owner?: string; vault?: string; maxPositions?: number }): Promise<Discovery> {
    const owner = input.owner === undefined ? undefined : AddressSchema.parse(input.owner);
    const vault = input.vault === undefined ? undefined : AddressSchema.parse(input.vault);
    if (!owner && !vault) throw new Error('Discovery requires an owner or vault filter');
    const chainIds = (input.chainIds ?? (input.chainId === undefined ? MORPHO_CHAINS : [input.chainId]))
      .map(chain => MorphoChainSchema.parse(chain));
    const max = z.number().int().min(1).max(500).parse(input.maxPositions ?? 100);
    const positions: Discovery['positions'] = [];
    const issues: Discovery['issues'] = [];
    const chainResults = await Promise.allSettled(chainIds.map(chainId => owner
      ? this.ownerPositions(owner, chainId)
      : this.vaultOwners(vault!, chainId)));
    for (const result of chainResults) {
      if (result.status === 'fulfilled') positions.push(...result.value);
      else issues.push('chain-unavailable');
    }
    const active = positions.filter(position => (!vault || position.vault === vault)
      && (position.reportedSharesRaw === null || BigInt(position.reportedSharesRaw) > 0n));
    active.sort((a, b) => BigInt(b.reportedAssetsRaw ?? '0') > BigInt(a.reportedAssetsRaw ?? '0') ? 1 : -1);
    if (active.length > max) issues.push('limit');
    return CurrentDiscoverySchema.parse({
      source: 'morpho-graphql', scope: 'indexed-morpho-v1-and-v2', observedAt: new Date().toISOString(),
      blockAligned: false, complete: issues.length === 0, issues: [...new Set(issues)], positions: active.slice(0, max),
    });
  }
}

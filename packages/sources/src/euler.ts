import { z } from 'zod/v4';
import { AddressSchema, RawSchema } from '../../domain/src/index.js';
import { getJson, SourceFailure, validateHttpUrl } from './http.js';

export const EULER_API = 'https://v3.euler.finance/v3';
export const EULER_METADATA = 'https://app.euler.finance/api/public/metadata';
const chains = [1, 8453, 42161] as const;
const ChainSchema = z.union([z.literal(1), z.literal(8453), z.literal(42161)]);
const PositionSchema = z.object({
  chainId: ChainSchema, account: AddressSchema, vault: AddressSchema,
  vaultType: z.enum(['evk', 'earn', 'securitize']), asset: AddressSchema.nullable(),
  shares: RawSchema.nullable(), assets: RawSchema.nullable(), borrowed: RawSchema.nullable(),
});
const PageSchema = z.object({
  data: z.array(PositionSchema).max(100),
  meta: z.object({ timestamp: z.iso.datetime(), hasMore: z.boolean(), offset: z.literal(0),
    limit: z.number().int().min(1).max(100), degradedProviders: z.array(z.string()).optional() }),
});
const MetadataSchema = z.object({
  chainId: ChainSchema, address: AddressSchema, name: z.string().min(1).max(200),
  type: z.enum(['evk', 'earn', 'securitize']), deprecated: z.boolean(),
  asset: z.object({ address: AddressSchema, symbol: z.string().min(1).max(40), decimals: z.number().int().min(0).max(36) }),
});
export interface EulerPosition {
  owner: string; vault: string; chainId: 1 | 8453 | 42161; name: string;
  protocol: 'euler'; version: 'erc4626';
  asset: z.infer<typeof MetadataSchema>['asset'];
  reportedSharesRaw: string | null; reportedAssetsRaw: string | null;
  reportedBorrowedRaw: string | null;
}

/** Indexed candidates only. Analysis must acquire its own pinned RPC evidence. */
export class EulerDiscovery {
  constructor(private readonly apiUrl = EULER_API, private readonly metadataUrl = EULER_METADATA) {
    validateHttpUrl(apiUrl);
    validateHttpUrl(metadataUrl);
  }

  async positions(address: string) {
    const owner = AddressSchema.parse(address);
    const url = new URL(`${this.apiUrl.replace(/\/$/, '')}/accounts/${owner}/positions`);
    url.search = new URLSearchParams({ chainId: chains.join(','), limit: '100', offset: '0' }).toString();
    const parsed = PageSchema.safeParse(await getJson(url.toString(), 10000));
    if (!parsed.success) throw new SourceFailure('invalid-response', 'Euler account position schema changed');
    const page = parsed.data;
    const issues: string[] = [];
    if (page.meta.hasMore) issues.push('euler-limit');
    if (page.meta.degradedProviders?.length) issues.push('euler-source-degraded');
    const candidates = page.data.filter(item => {
      if (item.account !== owner) { issues.push('euler-subaccount-omitted'); return false; }
      if (item.vaultType === 'securitize') { issues.push('euler-vault-type-unsupported'); return false; }
      if (item.shares === null) issues.push('euler-missing-state');
      return item.shares === null || BigInt(item.shares) > 0n;
    });
    const results = await Promise.allSettled(chains.map(async chainId => {
      const selected = candidates.filter(item => item.chainId === chainId);
      if (!selected.length) return [];
      const metadataUrl = new URL(this.metadataUrl);
      metadataUrl.search = new URLSearchParams({ chainId: String(chainId), addresses: [...new Set(selected.map(item => item.vault))].join(',') }).toString();
      const raw = z.record(z.string(), z.unknown()).parse(await getJson(metadataUrl.toString(), 10000));
      // The endpoint also returns request-context keys; only address keys are metadata.
      const metadata = new Map(Object.entries(raw).filter(([key]) => /^0x[0-9a-fA-F]{40}$/.test(key))
        .map(([key, value]) => [key.toLowerCase(), value]));
      const positions: EulerPosition[] = [];
      for (const item of selected) {
        const entry = MetadataSchema.safeParse(metadata.get(item.vault));
        if (!entry.success || entry.data.chainId !== chainId || entry.data.address !== item.vault
          || entry.data.type !== item.vaultType || entry.data.asset.address !== item.asset) {
          issues.push('euler-metadata-unavailable');
          continue;
        }
        if (entry.data.deprecated) { issues.push('euler-deprecated-vault-omitted'); continue; }
        positions.push({ owner, vault: item.vault, chainId, protocol: 'euler', version: 'erc4626',
          name: entry.data.name, asset: entry.data.asset, reportedSharesRaw: item.shares,
          reportedAssetsRaw: item.assets, reportedBorrowedRaw: item.borrowed });
      }
      return positions;
    }));
    if (results.some(result => result.status === 'rejected')) issues.push('euler-metadata-unavailable');
    return { positions: results.flatMap(result => result.status === 'fulfilled' ? result.value : []),
      issues: [...new Set(issues)], observedAt: page.meta.timestamp };
  }
}

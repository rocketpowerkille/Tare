import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { getJson, SourceFailure, validateHttpUrl } from './http.js';

const RawAmountSchema = z.string().regex(/^(0|[1-9][0-9]{0,77})$/)
  .refine(value => BigInt(value) < 2n ** 256n);
const TokenBalanceSchema = z.object({
  address: AddressSchema,
  contract: AddressSchema,
  amount: RawAmountSchema,
  decimals: z.number().int().min(0).max(255).nullable(),
  name: z.string().max(200).nullable().optional(),
  symbol: z.string().max(40).nullable().optional(),
  last_update_block_num: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  network: z.string().max(40).optional(),
  network_id: z.string().max(40).optional(),
});

export const GraphTokenObservationSchema = z.strictObject({
  source: z.literal('the-graph-token-api'),
  schema: z.literal('evm-wallet-balance-v1'),
  observedAt: z.iso.datetime(),
  network: z.literal('mainnet'),
  owner: AddressSchema,
  contract: AddressSchema,
  balance: TokenBalanceSchema.nullable(),
});
export type GraphTokenObservation = z.infer<typeof GraphTokenObservationSchema>;

export class GraphTokenClient {
  private readonly url: URL;
  constructor(baseUrl: string, private readonly token: string, private readonly timeoutMs = 10000) {
    this.url = new URL(validateHttpUrl(baseUrl));
    if (this.url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(this.url.hostname)) {
      throw new Error('Graph Token API authentication requires HTTPS outside localhost');
    }
    if (!/^[\x21-\x7e]{1,4096}$/.test(token)) throw new Error('GRAPH_MARKET_API_TOKEN is missing or invalid');
    z.number().int().min(100).max(60000).parse(timeoutMs);
  }

  async balance(ownerInput: string, contractInput: string): Promise<GraphTokenObservation> {
    const owner = AddressSchema.parse(ownerInput);
    const contract = AddressSchema.parse(contractInput);
    const url = new URL('/v1/evm/balances', this.url);
    url.searchParams.set('network', 'mainnet');
    url.searchParams.set('address', owner);
    url.searchParams.set('contract', contract);
    url.searchParams.set('include_null_balances', 'true');
    url.searchParams.set('limit', '10');
    url.searchParams.set('page', '1');
    const raw = await getJson(url.href, this.timeoutMs, 256 * 1024, `Bearer ${this.token}`);
    const envelope = z.object({ data: z.array(TokenBalanceSchema).max(10) }).safeParse(raw);
    if (!envelope.success) throw new SourceFailure('invalid-response', 'Graph Token API returned an invalid balance response');
    const matching = envelope.data.data.filter(item => item.address === owner && item.contract === contract
      && (item.network ?? item.network_id ?? 'mainnet') === 'mainnet');
    if (matching.length > 1) throw new SourceFailure('invalid-response', 'Graph Token API returned duplicate wallet balances');
    return GraphTokenObservationSchema.parse({
      source: 'the-graph-token-api', schema: 'evm-wallet-balance-v1', observedAt: new Date().toISOString(),
      network: 'mainnet', owner, contract, balance: matching[0] ?? null,
    });
  }
}

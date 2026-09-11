import { z } from 'zod/v4';
import { AddressSchema, ChainIdSchema } from '../../domain/src/index.js';
import { postJson, SourceFailure, validateHttpUrl } from './http.js';

export const HexQuantitySchema = z.string().regex(/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/).max(66);
export const HexDataSchema = z.string().regex(/^0x(?:[0-9a-fA-F]{2})*$/).max(65538).transform(value => value.toLowerCase());
export const HashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value => value.toLowerCase());
export const RpcBlockSchema = z.object({ number: HexQuantitySchema, hash: HashSchema, timestamp: HexQuantitySchema });
export type RpcBlock = z.infer<typeof RpcBlockSchema>;
export const CallObservationSchema = z.strictObject({
  id: z.string(), to: AddressSchema, data: HexDataSchema, result: HexDataSchema,
  blockHash: HashSchema, observedAt: z.iso.datetime(),
});
export type CallObservation = z.infer<typeof CallObservationSchema>;
export const NativeBalanceSchema = z.strictObject({
  address: AddressSchema, balance: HexQuantitySchema, blockHash: HashSchema, observedAt: z.iso.datetime(),
});
export const CodeObservationSchema = z.strictObject({
  address: AddressSchema, code: HexDataSchema, blockHash: HashSchema, observedAt: z.iso.datetime(),
});
export type CodeObservation = z.infer<typeof CodeObservationSchema>;
export const FailedCallSchema = z.strictObject({ to: AddressSchema, data: HexDataSchema, blockHash: HashSchema, code: z.enum(['timeout', 'network', 'http', 'oversized', 'invalid-json', 'invalid-response', 'rpc-error', 'graphql-error', 'budget', 'reorg']) });
export type FailedCall = z.infer<typeof FailedCallSchema>;
const EnvelopeSchema = z.object({ jsonrpc: z.literal('2.0'), id: z.number().int(), result: z.unknown().optional(), error: z.unknown().optional() });
export const HealthSchema = z.strictObject({
  source: z.enum(['rpc', 'morpho-graphql']), status: z.enum(['healthy', 'degraded', 'unavailable']),
  requests: z.number().int().nonnegative(), failures: z.number().int().nonnegative(), elapsedMs: z.number().nonnegative(),
});
export type Health = z.infer<typeof HealthSchema>;
export interface ContractReader {
  readonly block: RpcBlock;
  call(to: string, data: string): Promise<string>;
}
/** Drain a read batch before finalizing evidence, including when one call fails. */
export async function settleReads<T>(requests: Promise<T>[]): Promise<T[]> {
  const results = await Promise.allSettled(requests);
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  return results.map(result => {
    if (result.status !== 'fulfilled') throw new Error('Read batch did not settle');
    return result.value;
  });
}
export class PinnedRpc implements ContractReader {
  block!: RpcBlock;
  readonly observations: CallObservation[] = [];
  readonly nativeBalances: z.infer<typeof NativeBalanceSchema>[] = [];
  readonly codes: CodeObservation[] = [];
  readonly failedCalls: FailedCall[] = [];
  readonly health: Health = { source: 'rpc', status: 'healthy', requests: 0, failures: 0, elapsedMs: 0 };
  private readonly cache = new Map<string, string>();
  private readonly url: string;
  private readonly deadline: number;
  constructor(url: string, private readonly timeoutMs = 10000, private readonly maxCalls = 250, deadlineMs = 120000) {
    this.url = validateHttpUrl(url); this.deadline = Date.now() + deadlineMs;
  }
  async nativeBalance(addressInput: string): Promise<bigint> {
    if (!this.block) throw new Error('Pin a block before reading balances');
    const address = AddressSchema.parse(addressInput);
    const raw = await this.request('eth_getBalance', [address, { blockHash: this.block.hash, requireCanonical: true }]);
    const parsed = HexQuantitySchema.safeParse(raw);
    if (!parsed.success) throw new SourceFailure('invalid-response', 'Invalid native balance');
    this.nativeBalances.push({ address, balance: parsed.data, blockHash: this.block.hash, observedAt: new Date().toISOString() });
    return BigInt(parsed.data);
  }
  async code(addressInput: string): Promise<string> {
    if (!this.block) throw new Error('Pin a block before reading contract code');
    const address = AddressSchema.parse(addressInput);
    const previous = this.codes.find(item => item.address === address);
    if (previous) return previous.code;
    const raw = await this.request('eth_getCode', [address, { blockHash: this.block.hash, requireCanonical: true }]);
    const parsed = HexDataSchema.safeParse(raw);
    if (!parsed.success) throw new SourceFailure('invalid-response', 'Invalid contract code');
    this.codes.push(CodeObservationSchema.parse({
      address, code: parsed.data, blockHash: this.block.hash, observedAt: new Date().toISOString(),
    }));
    return parsed.data;
  }
  private async request(method: string, params: unknown[]): Promise<unknown> {
    if (this.health.requests >= this.maxCalls || Date.now() >= this.deadline) throw new SourceFailure('budget', 'RPC request or deadline budget exhausted');
    const id = ++this.health.requests;
    const started = performance.now();
    try {
      const input = await postJson(this.url, { jsonrpc: '2.0', id, method, params }, Math.min(this.timeoutMs, Math.max(1, this.deadline - Date.now())));
      const parsed = EnvelopeSchema.safeParse(input);
      if (!parsed.success || parsed.data.id !== id) throw new SourceFailure('invalid-response', 'RPC envelope is invalid or has a mismatched ID');
      if (parsed.data.error !== undefined) throw new SourceFailure('rpc-error', 'RPC reported an error');
      if (!Object.prototype.hasOwnProperty.call(parsed.data, 'result')) throw new SourceFailure('invalid-response', 'RPC omitted its result');
      return parsed.data.result;
    } catch (error) {
      this.health.failures++; this.health.status = this.health.failures === this.health.requests ? 'unavailable' : 'degraded'; throw error;
    } finally { this.health.elapsedMs += performance.now() - started; }
  }
  async pin(chainId: number, blockNumber?: string): Promise<void> {
    if (this.block) throw new Error('A pinned reader cannot be reused for another block');
    const expected = ChainIdSchema.parse(chainId);
    const chain = HexQuantitySchema.safeParse(await this.request('eth_chainId', []));
    if (!chain.success || BigInt(chain.data) !== BigInt(expected)) throw new SourceFailure('invalid-response', 'RPC chain does not match the requested chain');
    const tag = blockNumber === undefined ? 'latest' : `0x${BigInt(blockNumber).toString(16)}`;
    const block = RpcBlockSchema.safeParse(await this.request('eth_getBlockByNumber', [tag, false]));
    if (!block.success || (tag !== 'latest' && BigInt(block.data.number) !== BigInt(tag))) throw new SourceFailure('invalid-response', 'RPC returned an invalid block');
    this.block = block.data;
  }
  async call(to: string, data: string): Promise<string> {
    if (!this.block) throw new Error('RPC must be pinned before a contract read');
    const address = AddressSchema.parse(to); const calldata = HexDataSchema.parse(data);
    const key = `${address}:${calldata}`;
    const cached = this.cache.get(key); if (cached !== undefined) return cached;
    let parsed: string;
    try {
      const result = await this.request('eth_call', [{ to: address, data: calldata }, { blockHash: this.block.hash, requireCanonical: true }]);
      const decoded = HexDataSchema.safeParse(result);
      if (!decoded.success) {
        this.health.failures++; this.health.status = 'degraded';
        throw new SourceFailure('invalid-response', 'RPC returned invalid ABI data');
      }
      parsed = decoded.data;
    }
    catch (error) {
      if (error instanceof SourceFailure) this.failedCalls.push({ to: address, data: calldata, blockHash: this.block.hash, code: error.code });
      throw error;
    }
    const observation = CallObservationSchema.parse({ id: `rpc-${this.observations.length + 1}`, to: address, data: calldata, result: parsed, blockHash: this.block.hash, observedAt: new Date().toISOString() });
    this.observations.push(observation); this.cache.set(key, parsed); return parsed;
  }
  async confirm(): Promise<void> {
    if (!this.block) throw new Error('No pinned block');
    const observed = RpcBlockSchema.safeParse(await this.request('eth_getBlockByNumber', [this.block.number, false]));
    if (!observed.success || observed.data.number !== this.block.number || observed.data.hash !== this.block.hash || observed.data.timestamp !== this.block.timestamp) throw new SourceFailure('reorg', 'Pinned block changed during resolution');
  }
}

/** Minimal static ABI codec for the explicitly supported read methods. */
export function word(value: bigint | string): string {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  if (n < 0n || n >= 2n ** 256n) throw new Error('Value is outside uint256');
  return n.toString(16).padStart(64, '0');
}
export function decodeWords(data: string, count: number): bigint[] {
  const parsed = HexDataSchema.parse(data);
  if (parsed.length !== 2 + count * 64) throw new SourceFailure('invalid-response', 'Unexpected ABI response length');
  return Array.from({ length: count }, (_, i) => BigInt(`0x${parsed.slice(2 + i * 64, 66 + i * 64)}`));
}
export function decodeAddress(data: string): string {
  const value = decodeWords(data, 1)[0]!;
  if (value >= 2n ** 160n) throw new SourceFailure('invalid-response', 'Non-canonical ABI address');
  return AddressSchema.parse(`0x${value.toString(16).padStart(40, '0')}`);
}

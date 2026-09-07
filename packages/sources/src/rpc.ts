import { z } from 'zod/v4';
import { AddressSchema, ChainIdSchema, RawSchema, formatUnits } from '../../domain/src/index.js';

const HexQuantitySchema = z.string().regex(/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/, 'Expected a JSON-RPC quantity');
const BlockHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Expected a 32-byte block hash');
const RpcEnvelopeSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.number().int(),
  result: z.unknown().optional(),
  error: z.object({ code: z.number().int(), message: z.string() }).passthrough().optional(),
}).passthrough();
const RpcBlockSchema = z.object({ number: HexQuantitySchema, hash: BlockHashSchema }).passthrough();
const NativeAssetSchema = z.strictObject({
  symbol: z.string().regex(/^[a-zA-Z0-9._-]{1,20}$/),
  decimals: z.number().int().min(0).max(36),
});
const RpcOptionsSchema = z.strictObject({ timeoutMs: z.number().int().min(100).max(60000).default(10000) });

export const NativeBalanceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal('native-balance'),
  verification: z.literal('rpc-observed'),
  address: AddressSchema,
  chainId: ChainIdSchema,
  block: z.strictObject({ number: RawSchema, hash: BlockHashSchema }),
  asset: NativeAssetSchema,
  balanceRaw: RawSchema,
  balance: z.string().regex(/^[0-9]+(?:\.[0-9]+)?$/),
  source: z.strictObject({ kind: z.literal('evm-json-rpc') }),
});
export type NativeBalance = z.infer<typeof NativeBalanceSchema>;

function parseRpcUrl(input: string): string {
  let url: URL;
  try { url = new URL(input); }
  catch { throw new Error('RPC URL must be a valid HTTP(S) URL'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('RPC URL must use HTTP or HTTPS');
  if (url.username || url.password) throw new Error('RPC URL must not contain embedded credentials; use a provider token in its path or query string');
  return url.toString();
}

async function rpcCall(url: string, method: string, params: readonly unknown[], id: number, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id }),
      signal: controller.signal,
    });
    text = await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error(`RPC request timed out during ${method}`);
    throw new Error(`RPC request failed during ${method}`);
  } finally { clearTimeout(timeout); }
  if (!response.ok) throw new Error(`RPC returned HTTP ${response.status} during ${method}`);
  if (Buffer.byteLength(text, 'utf8') > 1024 * 1024) throw new Error('RPC response exceeds 1048576 bytes');
  let parsed: unknown;
  try { parsed = JSON.parse(text) as unknown; }
  catch { throw new Error(`RPC returned invalid JSON during ${method}`); }
  const envelope = RpcEnvelopeSchema.parse(parsed);
  if (envelope.id !== id) throw new Error(`RPC returned a mismatched response ID during ${method}`);
  if (envelope.error) throw new Error(`RPC ${method} failed with code ${envelope.error.code}: ${envelope.error.message.slice(0, 200)}`);
  if (!('result' in envelope)) throw new Error(`RPC response omitted a result during ${method}`);
  return envelope.result;
}

function quantityToBigInt(value: unknown): bigint { return BigInt(HexQuantitySchema.parse(value)); }

export async function getNativeBalance(
  rpcUrl: string,
  wallet: { address: string; chainId: number },
  asset: { symbol: string; decimals: number },
  options: { timeoutMs?: number } = {},
): Promise<NativeBalance> {
  const url = parseRpcUrl(rpcUrl);
  const address = AddressSchema.parse(wallet.address);
  const expectedChainId = ChainIdSchema.parse(wallet.chainId);
  const nativeAsset = NativeAssetSchema.parse(asset);
  const { timeoutMs } = RpcOptionsSchema.parse(options);

  const observedChain = quantityToBigInt(await rpcCall(url, 'eth_chainId', [], 1, timeoutMs));
  if (observedChain !== BigInt(expectedChainId)) throw new Error(`RPC chain ID ${observedChain} does not match wallet chain ID ${expectedChainId}`);

  const initialBlock = RpcBlockSchema.parse(await rpcCall(url, 'eth_getBlockByNumber', ['latest', false], 2, timeoutMs));
  const balance = quantityToBigInt(await rpcCall(url, 'eth_getBalance', [address, initialBlock.number], 3, timeoutMs));
  const confirmedBlock = RpcBlockSchema.parse(await rpcCall(url, 'eth_getBlockByNumber', [initialBlock.number, false], 4, timeoutMs));
  if (confirmedBlock.hash.toLowerCase() !== initialBlock.hash.toLowerCase()) throw new Error('RPC block changed during the balance read; retry the request');

  const balanceRaw = balance.toString();
  return NativeBalanceSchema.parse({
    schemaVersion: 1,
    kind: 'native-balance',
    verification: 'rpc-observed',
    address,
    chainId: expectedChainId,
    block: { number: quantityToBigInt(initialBlock.number).toString(), hash: initialBlock.hash.toLowerCase() },
    asset: nativeAsset,
    balanceRaw,
    balance: formatUnits(balanceRaw, nativeAsset.decimals),
    source: { kind: 'evm-json-rpc' },
  });
}

import { z } from 'zod/v4';
import { AddressSchema, SupportedEvmChainSchema } from '../../domain/src/index.js';
import { UintSchema } from '../../domain/src/live.js';
import { SELECTOR, readUint } from '../../adapters/src/morpho-blue.js';
import { CallObservationSchema, FailedCallSchema, HealthSchema, PinnedRpc, RpcBlockSchema, decodeAddress, decodeString, word } from '../../sources/src/evm.js';
import type { ContractReader } from '../../sources/src/evm.js';
import { SourceFailure } from '../../sources/src/http.js';

const ERC4626 = { name: '0x06fdde03', symbol: '0x95d89b41' } as const;
export const Erc4626OptionsSchema = z.strictObject({
  owner: AddressSchema,
  vault: AddressSchema,
  chainId: SupportedEvmChainSchema,
  rpcUrl: z.string().min(1),
  blockNumber: UintSchema.optional(),
  timeoutMs: z.number().int().min(100).max(60000).default(10000),
});
const CaptureSchema = z.strictObject({
  captureVersion: z.literal(1),
  origin: z.literal('rpc-observed'),
  adapter: z.literal('erc4626'),
  chainId: SupportedEvmChainSchema,
  owner: AddressSchema,
  vault: AddressSchema,
  capturedAt: z.iso.datetime(),
  block: RpcBlockSchema,
  blockConfirmed: z.boolean(),
  observations: z.array(CallObservationSchema).max(30),
  failedCalls: z.array(FailedCallSchema).max(30),
  health: z.array(HealthSchema).length(1),
});
const PositionSchema = z.strictObject({
  vault: AddressSchema,
  vaultName: z.string().min(1).max(200),
  asset: AddressSchema,
  assetSymbol: z.string().min(1).max(40),
  decimals: z.number().int().min(0).max(36),
  sharesRaw: UintSchema,
  assetsRaw: UintSchema,
  totalSupplyRaw: UintSchema,
  totalAssetsRaw: UintSchema,
});
export const Erc4626ReceiptSchema = z.strictObject({
  schemaVersion: z.literal(1),
  protocol: z.literal('erc4626'),
  sourceMode: z.enum(['live-rpc', 'recorded-rpc']),
  chainId: SupportedEvmChainSchema,
  owner: AddressSchema,
  kind: z.enum(['complete', 'partial']),
  status: z.enum(['complete', 'partial']),
  scope: z.literal('erc4626-share-conversion'),
  verification: z.literal('onchain-accounting-only'),
  capture: CaptureSchema,
  position: PositionSchema.nullable(),
  metric: z.strictObject({ kind: z.literal('unavailable'), reasons: z.array(z.string()).min(1) }),
  findings: z.array(z.string()),
  limitations: z.array(z.string()).min(1),
});
export type Erc4626Receipt = z.infer<typeof Erc4626ReceiptSchema>;

async function optionalString(reader: ContractReader, address: string, selector: string, fallback: string) {
  try { return decodeString(await reader.call(address, selector)) || fallback; }
  catch { return fallback; }
}

async function inspect(reader: ContractReader, owner: string, vault: string) {
  const asset = decodeAddress(await reader.call(vault, SELECTOR.asset));
  const shares = await readUint(reader, vault, SELECTOR.balance, word(owner));
  const [assets, totalSupply, totalAssets, decimals] = await Promise.all([
    readUint(reader, vault, SELECTOR.convert, word(shares)),
    readUint(reader, vault, SELECTOR.supply),
    readUint(reader, vault, SELECTOR.assets),
    readUint(reader, asset, SELECTOR.decimals),
  ]);
  if (shares > totalSupply || decimals > 36n) throw new SourceFailure('invalid-response', 'Invalid ERC-4626 ownership or decimals');
  return PositionSchema.parse({
    vault, vaultName: await optionalString(reader, vault, ERC4626.name, 'ERC-4626 vault'),
    asset, assetSymbol: await optionalString(reader, asset, ERC4626.symbol, 'underlying asset'),
    decimals: Number(decimals), sharesRaw: shares.toString(), assetsRaw: assets.toString(),
    totalSupplyRaw: totalSupply.toString(), totalAssetsRaw: totalAssets.toString(),
  });
}

function makeReceipt(capture: z.infer<typeof CaptureSchema>, position: z.infer<typeof PositionSchema> | null, sourceMode: 'live-rpc' | 'recorded-rpc', findings: string[]): Erc4626Receipt {
  const kind = capture.blockConfirmed && position && findings.length === 0 ? 'complete' : 'partial';
  return Erc4626ReceiptSchema.parse({
    schemaVersion: 1, protocol: 'erc4626', sourceMode, chainId: capture.chainId, owner: capture.owner,
    kind, status: kind, scope: 'erc4626-share-conversion', verification: 'onchain-accounting-only', capture, position,
    metric: { kind: 'unavailable', reasons: ['ERC-4626 conversion does not independently verify downstream backing or value'] },
    findings,
    limitations: ['This check confirms the wallet share balance and the vault conversion quote at one block.',
      'A general ERC-4626 check cannot identify protocol-specific downstream positions without an adapter.'],
  });
}

export async function resolveErc4626Position(input: z.input<typeof Erc4626OptionsSchema>): Promise<Erc4626Receipt> {
  const options = Erc4626OptionsSchema.parse(input);
  const rpc = new PinnedRpc(options.rpcUrl, options.timeoutMs, 30, 60000);
  await rpc.pin(options.chainId, options.blockNumber);
  let position: z.infer<typeof PositionSchema> | null = null;
  const findings: string[] = [];
  try {
    if (await rpc.code(options.vault) === '0x') throw new SourceFailure('invalid-response', 'Vault has no contract code');
    position = await inspect(rpc, options.owner, options.vault);
    await rpc.confirm();
  } catch (error) {
    findings.push(error instanceof SourceFailure ? error.code : 'invalid-response');
  }
  const capture = CaptureSchema.parse({
    captureVersion: 1, origin: 'rpc-observed', adapter: 'erc4626', chainId: options.chainId,
    owner: options.owner, vault: options.vault, capturedAt: new Date().toISOString(), block: rpc.block,
    blockConfirmed: findings.length === 0, observations: rpc.observations, failedCalls: rpc.failedCalls, health: [rpc.health],
  });
  return makeReceipt(capture, position, 'live-rpc', findings);
}

class ReplayReader implements ContractReader {
  readonly block;
  constructor(private readonly capture: z.infer<typeof CaptureSchema>) { this.block = capture.block; }
  async call(to: string, data: string) {
    const address = AddressSchema.parse(to); const calldata = data.toLowerCase();
    const found = this.capture.observations.find(item => item.to === address && item.data === calldata);
    if (found) return found.result;
    throw new SourceFailure('invalid-response', 'Recorded contract call is unavailable');
  }
}

export async function replayErc4626Capture(input: unknown): Promise<Erc4626Receipt> {
  const capture = CaptureSchema.parse(input);
  try { return makeReceipt(capture, await inspect(new ReplayReader(capture), capture.owner, capture.vault), 'recorded-rpc', []); }
  catch (error) { return makeReceipt(capture, null, 'recorded-rpc', [error instanceof SourceFailure ? error.code : 'invalid-response']); }
}

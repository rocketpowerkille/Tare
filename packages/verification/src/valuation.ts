import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { UintSchema } from '../../domain/src/live.js';
import { HashSchema, PinnedRpc } from '../../sources/src/evm.js';
import { readPrice, readSequencerStatus } from '../../sources/src/chainlink.js';
import { SourceFailure } from '../../sources/src/http.js';
import { supportedChainlinkAsset } from '../../domain/src/chainlink-feeds.js';
export { supportedChainlinkAsset } from '../../domain/src/chainlink-feeds.js';

export const ChainlinkValuationOptionsSchema = z.strictObject({
  chainId: z.union([z.literal(1), z.literal(8453), z.literal(42161)]),
  asset: AddressSchema,
  amountRaw: UintSchema,
  assetDecimals: z.number().int().min(0).max(36),
  blockNumber: UintSchema.optional(),
  blockHash: HashSchema.optional(),
  rpcUrl: z.string().min(1),
  timeoutMs: z.number().int().min(100).max(60000).default(10000),
});

export function calculateUsdValue(amountRaw: string, assetDecimals: number, answerRaw: string) {
  const scale = 10n ** BigInt(assetDecimals);
  const product = BigInt(UintSchema.parse(amountRaw)) * BigInt(UintSchema.parse(answerRaw));
  return { valueRaw: (product / scale).toString(), roundingNumerator: (product % scale).toString() };
}

export async function valuePositionWithChainlink(input: z.input<typeof ChainlinkValuationOptionsSchema>) {
  const options = ChainlinkValuationOptionsSchema.parse(input);
  const asset = supportedChainlinkAsset(options.chainId, options.asset);
  if (!asset) throw new Error('No approved Chainlink valuation adapter is configured for this asset and network.');
  if (options.assetDecimals !== asset.assetDecimals) throw new SourceFailure('invalid-response', 'Asset decimals do not match the approved token');

  const rpc = new PinnedRpc(options.rpcUrl, options.timeoutMs, 8, 60000);
  await rpc.pin(options.chainId, options.blockNumber);
  if (options.blockHash && rpc.block.hash !== options.blockHash) throw new SourceFailure('reorg', 'Position and price block hashes differ');
  const sequencer = options.chainId === 1 ? undefined : await readSequencerStatus(rpc, options.chainId);
  const price = await readPrice(rpc, asset.proxy, BigInt(asset.maxAgeSeconds), options.chainId);
  await rpc.confirm();
  const value = calculateUsdValue(options.amountRaw, options.assetDecimals, price.answerRaw);

  return {
    schemaVersion: 1,
    reportType: 'chainlink-position-valuation' as const,
    sourceMode: 'live-rpc' as const,
    status: 'complete' as const,
    verification: 'chainlink-price-at-pinned-block' as const,
    chainId: options.chainId,
    asset: options.asset,
    assetSymbol: asset.symbol,
    amountRaw: options.amountRaw,
    assetDecimals: options.assetDecimals,
    price,
    ...(sequencer ? { sequencer } : {}),
    value: { currency: 'USD' as const, decimals: price.decimals, ...value },
    capture: {
      capturedAt: new Date().toISOString(),
      block: rpc.block,
      confirmed: true,
      observations: rpc.observations,
      failedCalls: rpc.failedCalls,
    },
    limitations: [
      'The price feed values the accounting quote. It does not verify vault backing, liquidity, or redeemability.',
      'The amount is supplied by the caller; this operation does not independently authenticate a vault position.',
      ...(asset.symbol === 'WETH' ? ['ETH/USD is a reference for the allowlisted WETH token, not a WETH market-liquidity or redemption check.'] : []),
    ],
  };
}

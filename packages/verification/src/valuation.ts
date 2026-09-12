import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { UintSchema } from '../../domain/src/live.js';
import { PinnedRpc } from '../../sources/src/evm.js';
import { readEthPrice, readUsdcPrice } from '../../sources/src/chainlink.js';

const ETHEREUM_USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const ETHEREUM_WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

export const ChainlinkValuationOptionsSchema = z.strictObject({
  chainId: z.literal(1),
  asset: AddressSchema,
  amountRaw: UintSchema,
  assetDecimals: z.number().int().min(0).max(36),
  blockNumber: UintSchema.optional(),
  rpcUrl: z.string().min(1),
  timeoutMs: z.number().int().min(100).max(60000).default(10000),
});

export function supportedChainlinkAsset(chainId: number, asset: string) {
  if (chainId !== 1) return undefined;
  const normalized = asset.toLowerCase();
  if (normalized === ETHEREUM_USDC) return { symbol: 'USDC', feed: 'USDC/USD' } as const;
  if (normalized === ETHEREUM_WETH) return { symbol: 'WETH', feed: 'ETH/USD' } as const;
  return undefined;
}

export function calculateUsdValue(amountRaw: string, assetDecimals: number, answerRaw: string) {
  const scale = 10n ** BigInt(assetDecimals);
  const product = BigInt(UintSchema.parse(amountRaw)) * BigInt(UintSchema.parse(answerRaw));
  return { valueRaw: (product / scale).toString(), roundingNumerator: (product % scale).toString() };
}

export async function valuePositionWithChainlink(input: z.input<typeof ChainlinkValuationOptionsSchema>) {
  const options = ChainlinkValuationOptionsSchema.parse(input);
  const asset = supportedChainlinkAsset(options.chainId, options.asset);
  if (!asset) throw new Error('No approved Chainlink valuation adapter is configured for this asset and network.');

  const rpc = new PinnedRpc(options.rpcUrl, options.timeoutMs, 8, 60000);
  await rpc.pin(options.chainId, options.blockNumber);
  const price = asset.symbol === 'USDC' ? await readUsdcPrice(rpc) : await readEthPrice(rpc);
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
    ],
  };
}

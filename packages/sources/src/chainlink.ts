import type { ContractReader } from './evm.js';
import { decodeWords, settleReads } from './evm.js';
import { SourceFailure } from './http.js';
import { UintSchema } from '../../domain/src/live.js';

// Ethereum USDC/USD standard proxy; directory verified 2026-09-09.
export const USDC_USD_FEED = '0x8fffffd4afb6115b954bd326cbe7b4ba576818f6';
export const PRICE_SELECTORS = { decimals: '0x313ce567', round: '0xfeaf968c' } as const;
export const PRICE_MAX_AGE_SECONDS = 86400n;
export const ETH_USD_FEED = '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419';

export async function readUsdcPrice(reader: ContractReader) {
  return readPrice(reader, USDC_USD_FEED, PRICE_MAX_AGE_SECONDS);
}
export async function readEthPrice(reader: ContractReader) {
  return readPrice(reader, ETH_USD_FEED, 3600n);
}
async function readPrice(reader: ContractReader, feed: string, maxAge: bigint) {
  const [decimalsData, roundData] = await settleReads([
    reader.call(feed, PRICE_SELECTORS.decimals),
    reader.call(feed, PRICE_SELECTORS.round),
  ]);
  const decimals = decodeWords(decimalsData!, 1)[0]!;
  const [round, answer, started, updated, answered] = decodeWords(roundData!, 5) as [bigint, bigint, bigint, bigint, bigint];
  const timestamp = BigInt(reader.block.timestamp);
  if (decimals !== 8n || round === 0n || round >= 2n ** 80n || answered < round || answered >= 2n ** 80n
    || answer === 0n || answer >= 2n ** 255n || started === 0n || started > updated
    || updated > timestamp || timestamp - updated > maxAge) {
    throw new SourceFailure('invalid-response', 'Invalid, future or stale USD price');
  }
  return {
    feed, chainId: 1 as const, currency: 'USD' as const,
    decimals: 8 as const, answerRaw: answer.toString(), roundId: round.toString(),
    updatedAt: updated.toString(), blockHash: reader.block.hash,
    blockTimestamp: timestamp.toString(), maxAgeSeconds: maxAge.toString(),
  };
}
export type UsdcPrice = Awaited<ReturnType<typeof readUsdcPrice>>;

/** USD has eight decimals; amounts retain a rounding numerator over 1,000,000. */
export function valueUsdc(amountRaw: string, price: UsdcPrice) {
  const product = BigInt(UintSchema.parse(amountRaw)) * BigInt(UintSchema.parse(price.answerRaw));
  return { valueRaw: (product / 1000000n).toString(), roundingNumerator: (product % 1000000n).toString() };
}

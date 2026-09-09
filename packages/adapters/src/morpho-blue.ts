import { decodeAddress, decodeWords, settleReads, word } from '../../sources/src/evm.js';
import type { ContractReader } from '../../sources/src/evm.js';
import { SourceFailure } from '../../sources/src/http.js';
import type { MarketObservation } from '../../domain/src/live.js';

export const MORPHO_BLUE_ETHEREUM = '0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb';
export const ETHEREUM_USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
export const PUBLIC_EXAMPLE_VAULT = '0xbeef01735c132ada46aa9aa4c54623caa92a64cb';
export const SELECTOR = {
  morpho: '0x3acb5624', queueLength: '0x33f91ebb', queue: '0x62518ddf',
  params: '0x2c3c9157', market: '0x5c60e39a', position: '0x93c52062', borrowRate: '0x8c00bf6b',
  fee: '0xddca3f43', lastAssets: '0x568efc07', offset: '0xaea70acc', convert: '0x07a2d13a',
  asset: '0x38d52e0f', supply: '0x18160ddd', assets: '0x01e1d114', balance: '0x70a08231', decimals: '0x313ce567',
} as const;
const WAD = 10n ** 18n;
const ZERO = `0x${'0'.repeat(40)}`;
function uint(value: bigint, bits = 256): bigint {
  if (value < 0n || value >= 2n ** BigInt(bits)) throw new SourceFailure('invalid-response', 'Accounting value exceeds its Solidity integer range');
  return value;
}
function product(a: bigint, b: bigint): bigint { return uint(a * b); }

/** Morpho Blue's published integer interest and virtual-share accounting rules.
 * This is expected accounting value, not cash liquidity or independently verified backing.
 */
export function expectedMarket(input: readonly bigint[], borrowRate: bigint, timestamp: bigint): { assets: bigint; shares: bigint; borrow: bigint } {
  if (input.length !== 6) throw new Error('Expected six market fields');
  const [a, s, b, , last, fee] = input as readonly [bigint, bigint, bigint, bigint, bigint, bigint];
  input.forEach(value => uint(value, 128));
  if (last > timestamp || fee > WAD) throw new SourceFailure('invalid-response', 'Invalid market time or fee');
  const elapsed = timestamp - last;
  const first = product(borrowRate, elapsed);
  const second = product(first, first) / (2n * WAD);
  const third = product(second, first) / (3n * WAD);
  const interest = product(b, uint(first + second + third)) / WAD;
  const assets = uint(a + interest, 128);
  const borrow = uint(b + interest, 128);
  const feeAssets = product(interest, fee) / WAD;
  const feeShares = product(feeAssets, s + 1000000n) / (assets - feeAssets + 1n);
  return { assets, borrow, shares: uint(s + feeShares, 128) };
}
export function vaultFeeShares(totalAssets: bigint, lastAssets: bigint, fee: bigint, supply: bigint, offset: bigint): bigint {
  if (fee > WAD || offset > 18n) throw new SourceFailure('invalid-response', 'Unsupported vault fee or decimals offset');
  const interest = totalAssets > lastAssets ? totalAssets - lastAssets : 0n;
  const feeAssets = product(interest, fee) / WAD;
  return feeAssets * (supply + 10n ** offset) / (totalAssets - feeAssets + 1n);
}
export async function readUint(reader: ContractReader, to: string, selector: string, args = ''): Promise<bigint> {
  return decodeWords(await reader.call(to, selector + args), 1)[0]!;
}
export async function readMarket(reader: ContractReader, vault: string, marketId: string, asset: string): Promise<MarketObservation> {
  const id = marketId.slice(2);
  const [paramsData, stateData, positionData] = await settleReads([
    reader.call(MORPHO_BLUE_ETHEREUM, SELECTOR.params + id),
    reader.call(MORPHO_BLUE_ETHEREUM, SELECTOR.market + id),
    reader.call(MORPHO_BLUE_ETHEREUM, SELECTOR.position + id + word(vault)),
  ]);
  const params = decodeWords(paramsData!, 5);
  const [loan, collateral, oracle, irm, lltv] = params as [bigint, bigint, bigint, bigint, bigint];
  const asAddress = (n: bigint) => decodeAddress(`0x${word(n)}`);
  if (asAddress(loan) !== asset || lltv > WAD) throw new SourceFailure('invalid-response', 'Market parameters conflict with the supported loan asset');
  const state = decodeWords(stateData!, 6);
  const position = decodeWords(positionData!, 3);
  if (position[1] !== 0n || position[2] !== 0n) throw new SourceFailure('invalid-response', 'Vault position unexpectedly contains debt or collateral');
  const timestamp = BigInt(reader.block.timestamp);
  let rate = 0n;
  if (timestamp !== state[4] && state[2] !== 0n && asAddress(irm) !== ZERO) {
    rate = await readUint(reader, asAddress(irm), SELECTOR.borrowRate, params.map(word).join('') + state.map(word).join(''));
  }
  const expected = expectedMarket(state, rate, timestamp);
  const shares = position[0]!;
  if (shares > state[1]!) throw new SourceFailure('invalid-response', 'Vault market shares exceed the observed supply');
  const assets = product(shares, expected.assets + 1n) / (expected.shares + 1000000n);
  return {
    marketId, loanToken: asAddress(loan) as MarketObservation['loanToken'],
    collateralToken: asAddress(collateral) as MarketObservation['collateralToken'], oracle: asAddress(oracle) as MarketObservation['oracle'],
    irm: asAddress(irm) as MarketObservation['irm'], lltvRaw: lltv.toString(), supplySharesRaw: shares.toString(),
    expectedSupplyAssetsRaw: expected.assets.toString(), expectedSupplySharesRaw: expected.shares.toString(),
    expectedBorrowAssetsRaw: expected.borrow.toString(), vaultAssetsRaw: assets.toString(),
    attributedAssetsRaw: null, attributionRemainder: null, type: 'lending-receivable', backingVerification: 'unverified',
  };
}

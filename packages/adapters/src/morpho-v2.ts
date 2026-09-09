import type { ContractReader } from '../../sources/src/evm.js';
import { decodeAddress, decodeWords, settleReads, word } from '../../sources/src/evm.js';
import { SourceFailure } from '../../sources/src/http.js';
import { ETHEREUM_USDC, readUint, SELECTOR } from './morpho-blue.js';

// Selectors from morpho-org/vault-v2. Only Ethereum USDC V2 -> V1 adapters are expanded.
export const V2 = {
  adaptersLength: '0x5aa22bc8', adapters: '0x4ef501ac', realAssets: '0x56c07573',
  parentVault: '0x0fe36536', morphoVaultV1: '0xe4baaddf', virtualShares: '0xc719946c',
  accrueInterestView: '0x60a38ac1', storedAssets: '0xce04bebb', lastUpdate: '0xc0463711',
  maxRate: '0xece1d6e5', performanceFee: '0x87788782', managementFee: '0xa6f7f5d6',
  performanceRecipient: '0xed27f7c9', managementRecipient: '0x6d9a3010',
  canReceiveShares: '0x98c9b49c', allocation: '0x88a17bde',
} as const;
const WAD = 10n ** 18n;

export async function readV2Root(reader: ContractReader, vault: string, owner: string) {
  const asset = decodeAddress(await reader.call(vault, SELECTOR.asset));
  if (asset !== ETHEREUM_USDC) throw new SourceFailure('invalid-response', 'Unsupported V2 asset');
  const selectors = [SELECTOR.supply, SELECTOR.assets, V2.virtualShares, V2.adaptersLength,
    V2.storedAssets, V2.lastUpdate, V2.maxRate, V2.performanceFee, V2.managementFee];
  const values = await settleReads(selectors.map(selector => readUint(reader, vault, selector)));
  const [supply, assets, virtual, count, stored, last, rate, performanceFee, managementFee] = values as
    [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
  const shares = await readUint(reader, vault, SELECTOR.balance, word(owner));
  const quote = await readUint(reader, vault, SELECTOR.convert, word(shares));
  const accrued = decodeWords(await reader.call(vault, V2.accrueInterestView), 3);
  if (shares > supply || virtual !== 10n ** 12n || count > 64n || last > BigInt(reader.block.timestamp)
    || stored >= 2n ** 128n || last >= 2n ** 64n || rate >= 2n ** 64n
    || performanceFee > WAD || managementFee > WAD) {
    throw new SourceFailure('invalid-response', 'Invalid V2 accounting or unsupported adapter count');
  }
  const enabledFees: boolean[] = [];
  for (const selector of [V2.performanceRecipient, V2.managementRecipient]) {
    const recipient = decodeAddress(await reader.call(vault, selector));
    const allowed = await readUint(reader, vault, V2.canReceiveShares, word(recipient));
    if (allowed > 1n) throw new SourceFailure('invalid-response', 'Invalid fee gate result');
    enabledFees.push(allowed === 1n);
  }
  return {
    asset, supply, assets, virtual, count: Number(count), shares, quote, accrued,
    stored, elapsed: BigInt(reader.block.timestamp) - last, rate,
    performanceFee: enabledFees[0] ? performanceFee : 0n,
    managementFee: enabledFees[1] ? managementFee : 0n,
  };
}
export type V2Root = Awaited<ReturnType<typeof readV2Root>>;

/** Reconstruct V2's capped interest and pending dilution before accepting its quote. */
export function reconcileV2(root: V2Root, realAssets: bigint): boolean {
  const cap = root.stored + root.stored * root.elapsed * root.rate / WAD;
  const assets = realAssets < cap ? realAssets : cap;
  const interest = assets > root.stored ? assets - root.stored : 0n;
  const performanceAssets = interest * root.performanceFee / WAD;
  const managementAssets = assets * root.elapsed * root.managementFee / WAD;
  if (performanceAssets + managementAssets > assets) return false;
  const denominator = assets - performanceAssets - managementAssets + 1n;
  const performanceShares = performanceAssets * (root.supply + root.virtual) / denominator;
  const managementShares = managementAssets * (root.supply + root.virtual) / denominator;
  const quote = root.shares * (assets + 1n) / (root.supply + performanceShares + managementShares + root.virtual);
  return root.assets === assets && root.quote === quote && root.accrued[0] === assets
    && root.accrued[1] === performanceShares && root.accrued[2] === managementShares;
}

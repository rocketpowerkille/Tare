import type { MarketObservation } from '../../domain/src/live.js';

/** Consolidate the owner's claims before reporting any market liquidity bound.
 * Borrower collateral is a risk dependency; it is never added as owned backing.
 */
export function assessLoanBacking(markets: MarketObservation[]) {
  const groups = new Map<string, { market: MarketObservation; claim: bigint }>();
  const findings = new Set<string>();
  for (const market of markets) {
    if (market.attributedAssetsRaw === null) {
      findings.add('unattributed-lending-claim');
      continue;
    }
    const key = `1:${market.marketId}:${market.loanToken}`;
    const previous = groups.get(key);
    if (previous && (previous.market.expectedSupplyAssetsRaw !== market.expectedSupplyAssetsRaw
      || previous.market.expectedBorrowAssetsRaw !== market.expectedBorrowAssetsRaw)) {
      findings.add('conflicting-shared-market-state');
    }
    groups.set(key, { market, claim: (previous?.claim ?? 0n) + BigInt(market.attributedAssetsRaw) });
  }
  const claims = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([id, item]) => {
    const supply = BigInt(item.market.expectedSupplyAssetsRaw);
    const borrow = BigInt(item.market.expectedBorrowAssetsRaw);
    if (borrow > supply || item.claim > supply) findings.add('market-accounting-contradiction');
    const liquidity = borrow > supply ? 0n : supply - borrow;
    return {
      id, claimRaw: item.claim.toString(), type: 'lending-receivable' as const,
      accountingLiquidityUpperBoundRaw: (item.claim < liquidity ? item.claim : liquidity).toString(),
      verifiedBackingRaw: null,
    };
  });
  return {
    status: 'unverified' as const,
    claims: findings.size ? claims.map(claim => ({ ...claim, accountingLiquidityUpperBoundRaw: null })) : claims,
    findings: [...findings],
    limitations: ['borrower-collateral-not-owned', 'bad-debt-not-valued', 'withdrawal-gates-and-liquidity-not-guaranteed'],
  };
}

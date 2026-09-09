import { UintSchema } from '../../domain/src/live.js';

interface ValuedClaim { id: string; usdRaw: string }
interface Backing {
  // A canonical custody/asset ID, never a path ID. Repeated paths do not create backing.
  id: string;
  usdRaw: string;
  treatment: 'cash-custody' | 'lending-receivable' | 'unsupported-wrapper';
  verification: 'matched' | 'unverified' | 'mismatch';
}
interface MetricInput {
  scope: 'local-control' | 'live';
  complete: boolean;
  debt: 'zero-verified' | 'positive' | 'unknown';
  valuation: 'fresh-common-usd' | 'unavailable';
  claims: ValuedClaim[];
  backing: Backing[];
}

/** Eligibility and arithmetic only. Callers must establish backing and price evidence.
 * Generic inputs cannot authorize live metrics. The WETH custody verifier requires
 * its own bounded, block-aligned raw witnesses; local controls cannot bypass it.
 */
export function evaluateClaimMultiple(input: MetricInput) {
  const reasons = new Set<string>();
  if (!input.complete) reasons.add('incomplete-resolution');
  if (input.debt !== 'zero-verified') reasons.add('unsupported-or-unknown-debt');
  if (input.valuation !== 'fresh-common-usd') reasons.add('missing-valuation');
  if (input.scope === 'live') reasons.add('missing-approved-backing-adapter');
  const claims = new Set<string>();
  let numerator = 0n;
  for (const claim of input.claims) {
    if (claims.has(claim.id)) reasons.add('duplicate-economic-claim');
    claims.add(claim.id);
    numerator += BigInt(UintSchema.parse(claim.usdRaw));
  }
  const backing = new Map<string, string>();
  for (const item of input.backing) {
    UintSchema.parse(item.usdRaw);
    if (item.treatment !== 'cash-custody') reasons.add('unsupported-backing-treatment');
    if (item.verification !== 'matched') reasons.add('backing-not-verified');
    const previous = backing.get(item.id);
    if (previous !== undefined && previous !== item.usdRaw) reasons.add('conflicting-shared-backing');
    backing.set(item.id, item.usdRaw);
  }
  const denominator = [...backing.values()].reduce((sum, value) => sum + BigInt(value), 0n);
  if (!claims.size) reasons.add('missing-claims');
  if (denominator === 0n) reasons.add('missing-positive-backing');
  if (reasons.size) return { kind: 'unavailable' as const, reasons: [...reasons] };
  return {
    kind: 'control-result' as const, scope: 'local-control' as const, currency: 'USD' as const,
    numeratorRaw: numerator.toString(), denominatorRaw: denominator.toString(),
    multipleMillionths: (numerator * 1000000n / denominator).toString(),
    roundingNumerator: (numerator * 1000000n % denominator).toString(),
  };
}

import { z } from 'zod/v4';

const Uint = z.string().regex(/^(0|[1-9][0-9]{0,77})$/).refine(value => BigInt(value) < 2n ** 256n);
export const PrivatePolicy = z.strictObject({
  maxAgeSeconds: z.number().int().min(30).max(3600),
  maxConcentrationBps: z.number().int().min(1).max(10000),
  maxMultipleBps: z.number().int().min(10000).max(1000000),
});
export const Evidence = z.strictObject({
  chainId: z.number().int().positive(), owner: z.string().regex(/^0x[0-9a-f]{40}$/), vault: z.string().regex(/^0x[0-9a-f]{40}$/),
  blockNumber: Uint, blockHash: z.string().regex(/^0x[0-9a-f]{64}$/), blockTimestamp: Uint,
  live: z.boolean(), complete: z.boolean(), backingVerified: z.boolean(),
  largestMarketBps: z.number().int().min(0).max(10000).nullable(),
  multiple: z.strictObject({ numerator: Uint, denominator: Uint.refine(value => BigInt(value) > 0n) }).nullable(),
});
export type Evidence = z.infer<typeof Evidence>;
export type Decision = { action: 'blocked' | 'hold' | 'review' | 'exit'; reason: string };
export const EXECUTION_CHAIN_ID = 84532;

/** Private thresholds stay inside the caller's confidentiality boundary. No ratio uses floating point. */
export function decide(rawEvidence: unknown, rawPolicy: unknown, now: number, allowTestnetExit = false): Decision {
  const evidence = Evidence.parse(rawEvidence);
  const policy = PrivatePolicy.parse(rawPolicy);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid policy clock');
  const age = BigInt(now) - BigInt(evidence.blockTimestamp);
  if (!evidence.live || !evidence.complete) return { action: 'blocked', reason: 'incomplete-or-recorded-evidence' };
  if (age < 0n || age > BigInt(policy.maxAgeSeconds)) return { action: 'blocked', reason: 'stale-or-future-evidence' };
  const concentrated = evidence.largestMarketBps !== null && evidence.largestMarketBps > policy.maxConcentrationBps;
  const multiple = evidence.multiple;
  if (!evidence.backingVerified || !multiple) {
    return concentrated ? { action: 'review', reason: 'concentration-with-unverified-backing' }
      : { action: 'hold', reason: 'execution-evidence-unavailable' };
  }
  const breached = BigInt(multiple.numerator) * 10000n > BigInt(multiple.denominator) * BigInt(policy.maxMultipleBps);
  if (!breached) return concentrated ? { action: 'review', reason: 'concentration-limit' } : { action: 'hold', reason: 'within-policy' };
  return allowTestnetExit && evidence.chainId === EXECUTION_CHAIN_ID
    ? { action: 'exit', reason: 'verified-multiple-limit' }
    : { action: 'review', reason: 'execution-disabled-or-wrong-chain' };
}

import { compositionFixture } from './composition.js';
import { replayLiveCapture } from '../../packages/resolver/src/live.js';
import { replayShareVerification } from '../../packages/verification/src/shares.js';

export const privatePolicy = { maxAgeSeconds: 300, maxConcentrationBps: 5000, maxMultipleBps: 15000 };
export async function policyFixture() {
  const input = await compositionFixture();
  // Local transport fixture; changing these labels does not make it live acceptance evidence.
  const resolution = { ...await replayLiveCapture(input.resolutionCapture), sourceMode: 'live-rpc' as const };
  const verification = { ...replayShareVerification(input.shareCapture), sourceMode: 'live-graph-rpc' as const };
  const expected = { owner: input.resolutionCapture.owner, vault: input.resolutionCapture.vault,
    deployment: input.shareCapture.expectedDeployment! };
  const block = input.resolutionCapture.block!;
  const checks = Array.from({ length: 56 }, (_, index) => ({
    to: expected.vault, data: `0x${index.toString(16).padStart(8, '0')}`,
    rpc: `0x${'0'.repeat(63)}1`, graph: `0x${'0'.repeat(63)}1`, status: 'matched' as const,
  }));
  const accounting = {
    reportType: 'accounting-verification' as const, sourceMode: 'live-graph-rpc' as const, status: 'matched' as const,
    capture: { chainId: 1 as const, vault: expected.vault, expectedDeployment: expected.deployment,
      rpc: { block, confirmed: true },
      graph: { _meta: { block: { number: Number(BigInt(block.number)), hash: block.hash },
        deployment: expected.deployment, hasIndexingErrors: false },
      accountingState: { id: expected.vault, chainId: 1 as const, blockNumber: BigInt(block.number).toString(),
        blockHash: block.hash, timestamp: BigInt(block.timestamp).toString(),
        reads: checks.map(check => ({ to: check.to, data: check.data, result: check.rpc })) } } },
    checks, findings: [],
  };
  return { resolution, verification, accounting, expected, now: Number(BigInt(block.timestamp)) };
}
export const testnetEvidence = {
  chainId: 11155111, owner: `0x${'1'.repeat(40)}`, vault: `0x${'2'.repeat(40)}`, blockNumber: '99',
  blockHash: `0x${'a'.repeat(64)}`, blockTimestamp: '1000', live: true, complete: true,
  backingVerified: true, multiple: { numerator: '2', denominator: '1' }, largestMarketBps: 10000,
};

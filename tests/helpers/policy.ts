import { compositionFixture } from './composition.js';
import { replayLiveCapture } from '../../packages/resolver/src/live.js';
import { replayShareVerification } from '../../packages/verification/src/shares.js';

export const privatePolicy = { maxAgeSeconds: 300, maxConcentrationBps: 5000, maxMultipleBps: 15000 };
export async function policyFixture() {
  const input = await compositionFixture();
  // Local transport fixture; changing these labels does not make it live acceptance evidence.
  const resolution = { ...await replayLiveCapture(input.resolutionCapture), sourceMode: 'live-rpc' as const };
  const verification = { ...replayShareVerification(input.shareCapture), sourceMode: 'live-graph-rpc' as const };
  return { resolution, verification, expected: { owner: input.resolutionCapture.owner, vault: input.resolutionCapture.vault,
    deployment: input.shareCapture.expectedDeployment! }, now: Number(BigInt(input.resolutionCapture.block!.timestamp)) };
}
export const testnetEvidence = {
  chainId: 11155111, owner: `0x${'1'.repeat(40)}`, vault: `0x${'2'.repeat(40)}`, blockNumber: '99',
  blockHash: `0x${'a'.repeat(64)}`, blockTimestamp: '1000', live: true, complete: true,
  backingVerified: true, multiple: { numerator: '2', denominator: '1' }, largestMarketBps: 10000,
};

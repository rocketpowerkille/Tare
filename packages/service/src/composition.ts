import { z } from 'zod/v4';
import { CaptureSchema } from '../../domain/src/live.js';
import { replayLiveCapture } from '../../resolver/src/live.js';
import { ShareVerificationCaptureSchema, replayShareVerification } from '../../verification/src/shares.js';
import { evidenceDigest } from '../../sources/src/recorded.js';
import { GraphShareDataSchema } from '../../sources/src/the-graph.js';

export const ComposeSchema = z.strictObject({
  resolutionCapture: CaptureSchema,
  shareCapture: ShareVerificationCaptureSchema,
  graphResponse: z.object({
    data: GraphShareDataSchema.nullable().optional(),
    // Keep evidence of GraphQL failure without retaining arbitrary provider diagnostics.
    errors: z.array(z.unknown().transform(() => 'graphql-error')).max(100).optional(),
  }),
});

/** Recompute both reports before joining; caller-provided statuses and amounts are never trusted. */
export async function composePosition(input: unknown) {
  const capture = ComposeSchema.parse(input);
  const resolution = await replayLiveCapture(capture.resolutionCapture);
  const verification = replayShareVerification(capture.shareCapture);
  const source = resolution.capture;
  const shares = verification.capture;
  const findings: string[] = [];
  if (source.owner !== shares.owner || source.vault !== shares.vault || source.chainId !== shares.chainId) {
    findings.push('position-identity-mismatch');
  }
  if (!source.block || !shares.rpc.block || source.block.hash !== shares.rpc.block.hash
    || BigInt(source.block.number) !== BigInt(shares.rpc.block.number)
    || BigInt(source.block.timestamp) !== BigInt(shares.rpc.block.timestamp)) {
    findings.push('position-block-mismatch');
  }
  if (!shares.expectedDeployment) findings.push('deployment-unpinned');
  if (capture.graphResponse.errors?.length) findings.push('external-graph-errors');
  if (!capture.graphResponse.data) findings.push('external-graph-unavailable');
  else if (JSON.stringify(capture.graphResponse.data) !== JSON.stringify(shares.graph?.data)) {
    findings.push('external-graph-disagreement');
  }
  if (resolution.kind !== 'complete') findings.push('resolution-incomplete');
  if (verification.status === 'incomplete') findings.push('share-verification-incomplete');
  const values = new Map(verification.checks.map(check => [check.field, check.rpc]));
  if (resolution.vault && verification.checks.length === 4
    && (values.get('asset') !== resolution.vault.asset
      || values.get('owner-shares') !== resolution.vault.sharesRaw
      || values.get('share-decimals') !== String(resolution.vault.decimals + resolution.vault.virtualSharesRaw.length - 1)
      || values.get('total-shares') !== resolution.vault.totalSupplyRaw)) {
    findings.push('position-accounting-mismatch');
  }
  return {
    reportType: 'position-share-composition' as const, schemaVersion: 1,
    sourceMode: 'recorded-composition' as const,
    status: findings.length ? 'incomplete' as const : verification.status,
    scope: 'vault-loan-exposure-and-share-ledger' as const,
    captureDigest: evidenceDigest(capture), capture, resolution, verification, findings,
    metric: { kind: 'unavailable' as const, reasons: ['lending-backing-unverified'] },
    limitations: ['unsigned-recording', 'not-a-fresh-source-check', 'share-ledger-match-is-not-backing-proof'],
  };
}

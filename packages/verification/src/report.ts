import { createHash } from 'node:crypto';
import { z } from 'zod/v4';
import { CheckSchema, FindingSchema, ShareVerificationCaptureSchema } from './capture.js';
import type { ShareVerificationCapture } from './capture.js';
import { compareShares } from './comparison.js';

const base = {
  schemaVersion: z.literal(1),
  reportType: z.literal('share-verification'),
  sourceMode: z.enum(['live-graph-rpc', 'recorded-graph-rpc']),
  verification: z.literal('share-ledger-cross-check-only'),
  metric: z.strictObject({
    kind: z.literal('unavailable'),
    reasons: z.tuple([z.literal('backing-not-verified'), z.literal('valuation-not-implemented')]),
  }),
  capture: ShareVerificationCaptureSchema,
  captureDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  checks: z.array(CheckSchema).max(4),
  findings: z.array(FindingSchema).max(30),
};

function digest(capture: ShareVerificationCapture): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(capture)).digest('hex')}`;
}

export const ShareVerificationReportSchema = z.strictObject({
  ...base,
  status: z.enum(['matched', 'mismatch', 'incomplete']),
}).superRefine((report, ctx) => {
  const expected = compareShares(report.capture);
  const consistent = report.captureDigest === digest(report.capture)
    && report.status === expected.status
    && JSON.stringify(report.checks) === JSON.stringify(expected.checks)
    && JSON.stringify(report.findings) === JSON.stringify(expected.findings);
  if (!consistent) {
    ctx.addIssue({ code: 'custom', message: 'Report does not match its captured evidence' });
  }
});
export type ShareVerificationReport = z.infer<typeof ShareVerificationReportSchema>;

export function createShareReport(capture: ShareVerificationCapture, sourceMode: ShareVerificationReport['sourceMode']): ShareVerificationReport {
  return ShareVerificationReportSchema.parse({
    schemaVersion: 1,
    reportType: 'share-verification',
    sourceMode,
    capture,
    captureDigest: digest(capture),
    ...compareShares(capture),
    verification: 'share-ledger-cross-check-only',
    metric: { kind: 'unavailable', reasons: ['backing-not-verified', 'valuation-not-implemented'] },
  });
}

export function replayShareVerification(input: unknown): ShareVerificationReport {
  return createShareReport(ShareVerificationCaptureSchema.parse(input), 'recorded-graph-rpc');
}

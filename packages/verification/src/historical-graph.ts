import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { DeploymentSchema } from '../../sources/src/the-graph.js';
import { evidenceDigest } from '../../sources/src/recorded.js';
import { AccountingCaptureSchema } from './accounting-capture.js';
import { AccountingOptionsSchema, replayAccounting, verifyAccounting } from './accounting.js';
import { ShareVerificationCaptureSchema, replayShareVerification, verifyShares } from './shares.js';

export const HISTORICAL_VAULT = '0xbeef01735c132ada46aa9aa4c54623caa92a64cb';
const SHARE_START = 18928285n;
const ACCOUNTING_START = 25937756n;

export const HistoricalGraphOptionsSchema = AccountingOptionsSchema.extend({
  owner: AddressSchema,
  vault: AddressSchema.refine(value => value === HISTORICAL_VAULT, 'Historical coverage is limited to Steakhouse USDC on Ethereum.'),
  expectedDeployment: DeploymentSchema,
});

export const HistoricalGraphCaptureSchema = z.strictObject({
  captureVersion: z.literal(1), scope: z.literal('historical-graph-verification'),
  owner: AddressSchema,
  accounting: AccountingCaptureSchema,
  shares: ShareVerificationCaptureSchema.nullable(),
});

/** Recompute each source result and the join; saved statuses are never trusted. */
export async function replayHistoricalGraph(input: unknown, sourceMode:
  'live-historical-graph-rpc' | 'recorded-historical-graph-rpc' = 'recorded-historical-graph-rpc') {
  const capture = HistoricalGraphCaptureSchema.parse(input);
  const accounting = await replayAccounting(capture.accounting);
  const shares = capture.shares ? replayShareVerification(capture.shares) : null;
  const block = capture.accounting.rpc.block;
  const shareBlock = capture.shares?.rpc.block;
  const findings: string[] = [];
  if (capture.accounting.vault !== HISTORICAL_VAULT) findings.push('unsupported-historical-vault');
  if (!capture.accounting.expectedDeployment) findings.push('deployment-unpinned');
  if (accounting.status !== 'matched') findings.push(`accounting-${accounting.status}`);
  if (!shares) findings.push('share-evidence-unavailable');
  else {
    if (shares.status !== 'matched') findings.push(`shares-${shares.status}`);
    if (shares.capture.owner !== capture.owner || shares.capture.vault !== capture.accounting.vault) {
      findings.push('position-identity-mismatch');
    }
    if (shares.capture.expectedDeployment !== capture.accounting.expectedDeployment) findings.push('deployment-mismatch');
    for (const call of shares.capture.rpc.calls) {
      const shared = capture.accounting.rpc.calls.find(item => item.to === call.to && item.data === call.data);
      if (shared && shared.result !== call.result) findings.push('shared-rpc-read-disagreement');
    }
    const indexedFrom = shares.capture.graph?.data.vault?.indexedFromBlock;
    if (indexedFrom === undefined || BigInt(indexedFrom) !== SHARE_START) findings.push('creation-block-coverage-unconfirmed');
  }
  if (!block || !shareBlock || block.hash !== shareBlock.hash
    || BigInt(block.number) !== BigInt(shareBlock.number)
    || BigInt(block.timestamp) !== BigInt(shareBlock.timestamp)) findings.push('shared-block-unconfirmed');
  if (!block || BigInt(block.number) < ACCOUNTING_START) findings.push('outside-accounting-coverage');
  const status = accounting.status === 'mismatch' || shares?.status === 'mismatch' ? 'mismatch' as const
    : findings.length ? 'incomplete' as const : 'matched' as const;
  return {
    schemaVersion: 1, reportType: 'historical-graph-verification' as const, sourceMode, status,
    chainId: 1, owner: capture.owner, vault: capture.accounting.vault,
    capture, captureDigest: evidenceDigest(capture), accounting, shares, findings,
    checkedBlock: block ? BigInt(block.number).toString() : null,
    checkedAt: block ? new Date(Number(BigInt(block.timestamp)) * 1000).toISOString() : null,
    coverage: { shareStartBlock: SHARE_START.toString(), accountingStartBlock: ACCOUNTING_START.toString(),
      throughBlock: block ? BigInt(block.number).toString() : null, currentStateVerified: false, executable: false },
    verification: 'historical-share-ledger-and-accounting-cross-check',
    metric: { kind: 'unavailable' as const, reasons: ['backing-not-verified'] },
    limitations: ['historical-block-only', 'not-current-wallet-state', 'not-executable-evidence',
      'accounting-agreement-is-not-solvency', ...(sourceMode.startsWith('recorded') ? ['unsigned-recording'] : [])],
  };
}

export async function verifyHistoricalGraph(input: z.input<typeof HistoricalGraphOptionsSchema>, apiKey?: string) {
  const options = HistoricalGraphOptionsSchema.parse(input);
  const { owner, ...accountingOptions } = options;
  // Use accounting from the historical deployment itself. The recent deployment
  // may start after this block and cannot fill missing historical coverage.
  const accounting = await verifyAccounting(accountingOptions, apiKey);
  const block = accounting.capture.rpc.block;
  const shares = block && accounting.capture.rpc.confirmed
    ? await verifyShares({ ...options, blockNumber: BigInt(block.number).toString() }, apiKey)
    : null;
  return replayHistoricalGraph({ captureVersion: 1, scope: 'historical-graph-verification', owner,
    accounting: accounting.capture, shares: shares?.capture ?? null }, 'live-historical-graph-rpc');
}

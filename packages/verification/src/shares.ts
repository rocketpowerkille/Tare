import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { PinnedRpc, settleReads, word } from '../../sources/src/evm.js';
import { DeploymentSchema, GraphShareClient } from '../../sources/src/the-graph.js';
import { SourceFailure, validateHttpUrl } from '../../sources/src/http.js';
import { SELECTOR } from '../../adapters/src/morpho-blue.js';
import { ShareVerificationCaptureSchema } from './capture.js';
import type { ShareVerificationCapture } from './capture.js';
import { createShareReport } from './report.js';
import type { ShareVerificationReport } from './report.js';

export { ShareVerificationCaptureSchema } from './capture.js';
export type { ShareVerificationCapture } from './capture.js';
export { ShareVerificationReportSchema, replayShareVerification } from './report.js';
export type { ShareVerificationReport } from './report.js';

export const ShareVerificationOptionsSchema = z.strictObject({
  chainId: z.literal(1).default(1),
  owner: AddressSchema,
  vault: AddressSchema,
  rpcUrl: z.string().min(1),
  graphUrl: z.string().min(1),
  expectedDeployment: DeploymentSchema.optional(),
  blockNumber: z.string().regex(/^(0|[1-9][0-9]{0,9})$/).refine(n => BigInt(n) <= 2147483647n).optional(),
  timeoutMs: z.number().int().min(100).max(60000).default(10000),
});
export async function verifyShares(input: z.input<typeof ShareVerificationOptionsSchema>, apiKey?: string): Promise<ShareVerificationReport> {
  const options = ShareVerificationOptionsSchema.parse(input);
  validateHttpUrl(options.rpcUrl);
  const graphql = new GraphShareClient(options.graphUrl, options.timeoutMs, apiKey);
  const rpc = new PinnedRpc(options.rpcUrl, options.timeoutMs, 7, options.timeoutMs * 7);
  const capture: ShareVerificationCapture = {
    captureVersion: 1,
    scope: 'erc4626-share-ledger',
    chainId: 1,
    owner: options.owner,
    vault: options.vault,
    capturedAt: new Date().toISOString(),
    expectedDeployment: options.expectedDeployment ?? null,
    rpc: { block: null, confirmed: false, calls: [], failedCalls: [], health: rpc.health },
    graph: null,
    graphHealth: graphql.health,
    failures: [],
  };
  const fail = (error: unknown, stage: 'rpc' | 'graph') => {
    if (!(error instanceof SourceFailure) && !(error instanceof z.ZodError)) throw error;
    capture.failures.push({ stage, code: error instanceof SourceFailure ? error.code : 'invalid-response' });
  };
  const observe = async (stage: 'rpc' | 'graph', read: () => Promise<void>) => {
    try {
      await read();
    } catch (error) {
      fail(error, stage);
    }
  };

  try {
    await rpc.pin(1, options.blockNumber);
    capture.rpc.block = rpc.block;
    const number = Number(BigInt(rpc.block.number));
    if (!Number.isSafeInteger(number) || number > 2147483647) {
      throw new SourceFailure('invalid-response', 'Block is outside Graph Int range');
    }
    await settleReads([
      observe('rpc', async () => {
        const calls = [SELECTOR.asset, SELECTOR.decimals, SELECTOR.supply, SELECTOR.balance + word(options.owner)];
        await settleReads(calls.map(data => rpc.call(options.vault, data)));
      }),
      observe('graph', async () => {
        capture.graph = await graphql.readAt(options.vault, options.owner, number);
      }),
    ]);
    await rpc.confirm();
    capture.rpc.confirmed = true;
  } catch (error) {
    fail(error, 'rpc');
  }
  capture.rpc.calls = rpc.observations;
  capture.rpc.failedCalls = rpc.failedCalls;
  return createShareReport(ShareVerificationCaptureSchema.parse(capture), 'live-graph-rpc');
}

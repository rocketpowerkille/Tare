import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { SELECTOR } from '../../adapters/src/morpho-blue.js';
import { decodeWords, HashSchema, PinnedRpc, settleReads, word } from '../../sources/src/evm.js';
import { SourceFailure } from '../../sources/src/http.js';
import { GraphTokenClient, GraphTokenObservationSchema } from '../../sources/src/graph-token-api.js';
import { evidenceDigest, RecordedReader, RpcEvidenceSchema } from '../../sources/src/recorded.js';
import { DeploymentSchema } from '../../sources/src/the-graph.js';
import { AccountingCaptureSchema } from './accounting-capture.js';
import { replayAccounting, verifyAccounting } from './accounting.js';

// The deadline-safe Studio deployment has one static data source. Other vaults
// can still use the Token API balance check, but they are outside this
// accounting subgraph's declared scope.
export const GRAPH_ACCOUNTING_VAULT = '0xbeef01735c132ada46aa9aa4c54623caa92a64cb';

export const GraphCompositionCaptureSchema = z.strictObject({
  captureVersion: z.literal(1),
  scope: z.literal('graph-product-composition'),
  chainId: z.literal(1),
  owner: AddressSchema,
  vault: AddressSchema,
  capturedAt: z.iso.datetime(),
  block: z.strictObject({
    number: z.string().regex(/^(0|[1-9][0-9]{0,15})$/),
    hash: HashSchema,
  }).nullable(),
  tokenApi: GraphTokenObservationSchema.nullable(),
  tokenApiFailure: z.string().max(80).nullable(),
  accounting: AccountingCaptureSchema,
  shareRpc: RpcEvidenceSchema,
  shareRpcFailure: z.string().max(80).nullable(),
});
export type GraphCompositionCapture = z.infer<typeof GraphCompositionCaptureSchema>;

export const GraphCompositionOptionsSchema = z.strictObject({
  owner: AddressSchema,
  vault: AddressSchema,
  rpcUrl: z.string().min(1),
  graphUrl: z.string().min(1),
  tokenApiUrl: z.string().min(1).default('https://api.pinax.network'),
  expectedDeployment: DeploymentSchema.optional(),
  timeoutMs: z.number().int().min(100).max(60000).default(10000),
});

function compare(capture: GraphCompositionCapture) {
  const accounting = replayAccounting(capture.accounting, 'recorded-graph-rpc');
  return accounting.then(async accountingReport => {
    const findings: string[] = [];
    const accountingApplicable = capture.vault === GRAPH_ACCOUNTING_VAULT;
    if (capture.tokenApiFailure) findings.push(`token-api-${capture.tokenApiFailure}`);
    if (capture.shareRpcFailure) findings.push(`share-rpc-${capture.shareRpcFailure}`);
    if (accountingApplicable && accountingReport.status !== 'matched') {
      findings.push(`subgraph-accounting-${accountingReport.status}`);
    }
    const balance = capture.tokenApi?.balance ?? null;
    if (!capture.tokenApi && !capture.tokenApiFailure) findings.push('token-api-observation-missing');
    if (capture.tokenApi && !balance) findings.push('token-balance-not-found');

    let rpcBalance: string | null = null;
    let rpcDecimals: number | null = null;
    if (capture.shareRpc.block && capture.shareRpc.confirmed) {
      try {
        const reader = new RecordedReader(capture.shareRpc);
        rpcBalance = (await decode(reader, capture.vault, SELECTOR.balance + word(capture.owner))).toString();
        rpcDecimals = Number(await decode(reader, capture.vault, SELECTOR.decimals));
      } catch (error) {
        if (!(error instanceof SourceFailure)) throw error;
        findings.push(`share-rpc-${error.code}`);
      }
    } else if (!capture.shareRpcFailure) findings.push('share-rpc-unconfirmed');

    const checkedBlock = capture.shareRpc.block ? Number(BigInt(capture.shareRpc.block.number)) : null;
    if (capture.shareRpc.block && capture.accounting.rpc.block
      && capture.shareRpc.block.hash !== capture.accounting.rpc.block.hash) findings.push('graph-rpc-block-mismatch');
    if (balance && checkedBlock !== null && balance.last_update_block_num > checkedBlock) findings.push('token-api-newer-than-checked-block');
    if (balance && rpcBalance !== null && balance.amount !== rpcBalance) findings.push('token-api-rpc-share-mismatch');
    if (balance && balance.decimals === null) findings.push('token-api-decimals-unavailable');
    if (balance && balance.decimals !== null && rpcDecimals !== null && balance.decimals !== rpcDecimals) {
      findings.push('token-api-rpc-decimals-mismatch');
    }
    const mismatch = (accountingApplicable && accountingReport.status === 'mismatch')
      || findings.some(item => item.endsWith('-mismatch'));
    const status = mismatch ? 'mismatch' as const : findings.length ? 'incomplete' as const : 'matched' as const;
    return { accountingReport, accountingApplicable, findings, status, balance, rpcBalance, rpcDecimals, checkedBlock };
  });
}

async function decode(reader: RecordedReader, to: string, data: string) {
  return decodeWords(await reader.call(to, data), 1)[0]!;
}

export async function replayGraphComposition(input: unknown, sourceMode:
  'live-graph-products-rpc' | 'recorded-graph-products-rpc' = 'recorded-graph-products-rpc') {
  const capture = GraphCompositionCaptureSchema.parse(input);
  const result = await compare(capture);
  return {
    schemaVersion: 1,
    reportType: 'graph-product-composition' as const,
    sourceMode,
    status: result.status,
    captureDigest: evidenceDigest(capture),
    capture,
    products: [
      { product: 'The Graph Token API', role: 'Wallet vault-share balance', live: Boolean(capture.tokenApi) },
      { product: 'Subgraph Studio', role: 'Normalized vault accounting checkpoint', live: Boolean(capture.accounting.graph),
        applicable: result.accountingApplicable,
        deployment: capture.accounting.graph?._meta.deployment ?? null },
    ],
    checks: {
      tokenApiAmountRaw: result.balance?.amount ?? null,
      rpcAmountRaw: result.rpcBalance,
      decimals: result.rpcDecimals,
      tokenApiLastUpdateBlock: result.balance?.last_update_block_num ?? null,
      checkedBlock: result.checkedBlock,
      accountingApplicable: result.accountingApplicable,
      accountingStatus: result.accountingReport.status,
      accountingReads: result.accountingReport.checks.length,
    },
    findings: result.findings,
    verification: result.accountingApplicable
      ? 'two-live-graph-products-with-rpc-cross-check' as const
      : 'token-api-with-rpc-cross-check' as const,
    metric: { kind: 'unavailable' as const, reasons: ['independent-backing-unverified', 'missing-valuation'] },
  };
}

export async function verifyGraphComposition(input: z.input<typeof GraphCompositionOptionsSchema>, token: string, graphApiKey?: string) {
  const options = GraphCompositionOptionsSchema.parse(input);
  const tokenClient = new GraphTokenClient(options.tokenApiUrl, token, options.timeoutMs);
  const [tokenResult, accountingResult] = await Promise.allSettled([
    tokenClient.balance(options.owner, options.vault),
    verifyAccounting({ vault: options.vault, rpcUrl: options.rpcUrl, graphUrl: options.graphUrl,
      ...(options.expectedDeployment ? { expectedDeployment: options.expectedDeployment } : {}), timeoutMs: options.timeoutMs }, graphApiKey),
  ]);
  if (accountingResult.status === 'rejected') throw accountingResult.reason;
  const accountingBlock = accountingResult.value.capture.rpc.block;
  const shareRpc = new PinnedRpc(options.rpcUrl, options.timeoutMs, 8, options.timeoutMs * 8);
  let shareRpcFailure: string | null = null;
  if (accountingBlock) {
    try {
      await shareRpc.pin(1, BigInt(accountingBlock.number).toString());
      await settleReads([
        shareRpc.call(options.vault, SELECTOR.balance + word(options.owner)),
        shareRpc.call(options.vault, SELECTOR.decimals),
      ]);
      await shareRpc.confirm();
    } catch (error) {
      if (!(error instanceof SourceFailure)) throw error;
      shareRpcFailure = error.code;
    }
  } else shareRpcFailure = 'missing-accounting-block';

  const capture = GraphCompositionCaptureSchema.parse({
    captureVersion: 1, scope: 'graph-product-composition', chainId: 1,
    owner: options.owner, vault: options.vault, capturedAt: new Date().toISOString(),
    block: accountingBlock ? { number: BigInt(accountingBlock.number).toString(), hash: accountingBlock.hash } : null,
    tokenApi: tokenResult.status === 'fulfilled' ? tokenResult.value : null,
    tokenApiFailure: tokenResult.status === 'rejected'
      ? tokenResult.reason instanceof SourceFailure ? tokenResult.reason.code : 'invalid-response'
      : null,
    accounting: accountingResult.value.capture,
    shareRpc: { block: shareRpc.block ?? null, confirmed: Boolean(shareRpc.block) && !shareRpcFailure,
      calls: shareRpc.observations, failedCalls: shareRpc.failedCalls },
    shareRpcFailure,
  });
  return replayGraphComposition(capture, 'live-graph-products-rpc');
}

import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { captureDigest, CaptureSchema, LiveReceiptSchema, UintSchema, VaultObservationSchema } from '../../domain/src/live.js';
import type { LiveCapture, LiveReceipt, MarketObservation } from '../../domain/src/live.js';
import { decodeAddress, decodeWords, PinnedRpc, settleReads, word } from '../../sources/src/evm.js';
import type { ContractReader, RpcBlock } from '../../sources/src/evm.js';
import { MorphoDiscovery } from '../../sources/src/morpho.js';
import type { Discovery } from '../../sources/src/morpho.js';
import { SourceFailure } from '../../sources/src/http.js';
import { MORPHO_BLUE_BY_CHAIN, readMarket, readUint, SELECTOR, vaultFeeShares } from '../../adapters/src/morpho-blue.js';

const LimitsSchema = z.strictObject({ maxMarkets: z.number().int().min(1).max(64).default(32) });
export const LiveOptionsSchema = z.strictObject({
  owner: AddressSchema, vault: AddressSchema, chainId: z.union([z.literal(1), z.literal(8453), z.literal(42161)]), rpcUrl: z.string().min(1),
  graphqlUrl: z.string().optional(), blockNumber: UintSchema.optional(),
  timeoutMs: z.number().int().min(100).max(60000).default(10000),
  maxMarkets: z.number().int().min(1).max(64).default(32), maxCalls: z.number().int().min(1).max(1000).default(250),
  deadlineMs: z.number().int().min(100).max(300000).default(120000),
});
export type LiveOptions = z.input<typeof LiveOptionsSchema>;
type Analysis = { vault: LiveReceipt['vault']; markets: MarketObservation[]; findings: LiveReceipt['findings'][number][]; unattributedAssetsRaw: string | null };
function failure(error: unknown, stage: string, marketId?: string): LiveReceipt['findings'][number] {
  if (error instanceof SourceFailure) return { stage, code: error.code, ...(marketId ? { marketId } : {}) };
  if (error instanceof z.ZodError) return { stage, code: 'invalid-response', ...(marketId ? { marketId } : {}) };
  throw error;
}
export async function analyzeMetaMorpho(reader: ContractReader, owner: string, vaultAddress: string, maxMarkets: number, expectedAsset: string, expectedMorpho: string): Promise<Analysis> {
  const result: Analysis = { vault: null, markets: [], findings: [], unattributedAssetsRaw: null };
  try {
    const [morpho, assetData] = await settleReads([reader.call(vaultAddress, SELECTOR.morpho), reader.call(vaultAddress, SELECTOR.asset)]);
    const asset = decodeAddress(assetData!);
    if (decodeAddress(morpho!) !== expectedMorpho || asset !== expectedAsset) throw new SourceFailure('invalid-response', 'Vault does not match the expected Morpho deployment or loan asset');
    const [supply, assets, shares, fee, lastAssets, offset, queueLength, decimals] = await settleReads([
      readUint(reader, vaultAddress, SELECTOR.supply), readUint(reader, vaultAddress, SELECTOR.assets),
      readUint(reader, vaultAddress, SELECTOR.balance, word(owner)), readUint(reader, vaultAddress, SELECTOR.fee),
      readUint(reader, vaultAddress, SELECTOR.lastAssets), readUint(reader, vaultAddress, SELECTOR.offset),
      readUint(reader, vaultAddress, SELECTOR.queueLength), readUint(reader, asset, SELECTOR.decimals),
    ]) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    const expectedOffset = BigInt(Math.max(0, 18 - Number(decimals)));
    if (shares > supply || decimals > 36n || offset !== expectedOffset || queueLength > 1000n) throw new SourceFailure('invalid-response', 'Vault ownership, decimals offset or allocation queue is unsupported');
    const quote = await readUint(reader, vaultAddress, SELECTOR.convert, word(shares));
    const fees = vaultFeeShares(assets, lastAssets, fee, supply, offset);
    const virtualShares = 10n ** offset;
    const expectedQuote = shares * (assets + 1n) / (supply + fees + virtualShares);
    if (quote !== expectedQuote) result.findings.push({ stage: 'vault-conversion', code: 'accounting-mismatch' });
    result.vault = VaultObservationSchema.parse({ address: vaultAddress, asset, decimals: Number(decimals), sharesRaw: shares.toString(),
      totalSupplyRaw: supply.toString(), totalAssetsRaw: assets.toString(), convertToAssetsRaw: quote.toString(),
      feeRaw: fee.toString(), feeSharesRaw: fees.toString(), virtualSharesRaw: virtualShares.toString(), queueLength: Number(queueLength) });
    if (queueLength > BigInt(maxMarkets)) result.findings.push({ stage: 'allocation-queue', code: 'market-limit' });
    const seen = new Set<string>();
    for (let index = 0; index < Math.min(Number(queueLength), maxMarkets); index++) {
      let marketId: string | undefined;
      try {
        const queueValue = await reader.call(vaultAddress, SELECTOR.queue + word(BigInt(index)));
        decodeWords(queueValue, 1); marketId = queueValue.toLowerCase();
        if (seen.has(marketId)) { result.findings.push({ stage: 'allocation-queue', code: 'duplicate-market', marketId }); continue; }
        seen.add(marketId);
        result.markets.push(await readMarket(reader, vaultAddress, marketId, asset, expectedMorpho));
      } catch (error) { result.findings.push(failure(error, `market-${index}`, marketId)); }
    }
    const observedAssets = result.markets.reduce((sum, market) => sum + BigInt(market.vaultAssetsRaw), 0n);
    const allObserved = result.markets.length === Number(queueLength);
    if (observedAssets > assets || (allObserved && observedAssets !== assets)) result.findings.push({ stage: 'allocation-reconciliation', code: 'accounting-mismatch' });
    if (!result.findings.some(finding => finding.code === 'accounting-mismatch') && assets > 0n) {
      let attributed = 0n;
      for (const market of result.markets) {
        const product = quote * BigInt(market.vaultAssetsRaw);
        market.attributedAssetsRaw = (product / assets).toString();
        market.attributionRemainder = (product % assets).toString();
        attributed += product / assets;
      }
      if (attributed > quote) throw new SourceFailure('invalid-response', 'Attributed exposure exceeds the account conversion quote');
      result.unattributedAssetsRaw = (quote - attributed).toString();
    } else if (assets === 0n && quote === 0n && allObserved) {
      for (const market of result.markets) { market.attributedAssetsRaw = '0'; market.attributionRemainder = '0'; }
      result.unattributedAssetsRaw = '0';
    } else if (assets === 0n) result.findings.push({ stage: 'vault-conversion', code: 'zero-accounting-assets' });
  } catch (error) { result.findings.push(failure(error, 'vault')); }
  return result;
}

function receipt(capture: LiveCapture, analysis: Analysis, sourceMode: 'live-rpc' | 'recorded-rpc'): LiveReceipt {
  const findings = [...capture.acquisitionFailures, ...analysis.findings];
  if (!capture.blockConfirmed) {
    findings.push({ stage: 'block-confirmation', code: 'unconfirmed-block' });
    for (const market of analysis.markets) { market.attributedAssetsRaw = null; market.attributionRemainder = null; }
    analysis.unattributedAssetsRaw = null;
  }
  return LiveReceiptSchema.parse({
    schemaVersion: 3, protocol: 'metamorpho-v1-blue-v1', sourceMode, chainId: capture.chainId, owner: capture.owner,
    scope: 'vault-to-blue-loan-receivables', captureDigest: captureDigest(capture),
    capture, ...analysis, kind: findings.length ? 'partial' : 'complete', findings,
    verification: 'not-independently-verified', metric: { kind: 'unavailable', reasons: ['missing-independent-backing-verification', 'missing-valuation'] },
    coverage: { expectedMarkets: analysis.vault?.queueLength ?? null, observedMarkets: analysis.markets.length, valueCoverage: null },
  });
}
export async function resolveLivePosition(input: LiveOptions, discovery: Discovery | null = null): Promise<LiveReceipt> {
  const options = LiveOptionsSchema.parse(input);
  const graphql = new MorphoDiscovery(options.graphqlUrl, options.timeoutMs);
  const rpc = new PinnedRpc(options.rpcUrl, options.timeoutMs, options.maxCalls, options.deadlineMs);
  const capture: LiveCapture = { captureVersion: 1, origin: 'rpc-observed', adapter: 'metamorpho-v1-blue-v1',
    chainId: options.chainId, owner: options.owner, vault: options.vault, capturedAt: new Date().toISOString(),
    block: null, blockConfirmed: false, metadata: null, discovery, observations: [], failedCalls: [], health: [], acquisitionFailures: [] };
  let analysis: Analysis = { vault: null, markets: [], findings: [], unattributedAssetsRaw: null };
  try {
    capture.metadata = await graphql.vault(options.vault, options.chainId);
  } catch (error) { capture.acquisitionFailures.push(failure(error, 'discovery')); }
  if (capture.metadata && capture.acquisitionFailures.length === 0) {
    try {
      const expectedMorpho = MORPHO_BLUE_BY_CHAIN[options.chainId];
      if (!expectedMorpho) throw new SourceFailure('invalid-response', 'This chain has no configured Morpho deployment');
      await rpc.pin(options.chainId, options.blockNumber); capture.block = rpc.block;
      analysis = await analyzeMetaMorpho(rpc, options.owner, options.vault, options.maxMarkets, capture.metadata.asset.address, expectedMorpho);
      await rpc.confirm(); capture.blockConfirmed = true;
    } catch (error) { capture.acquisitionFailures.push(failure(error, 'rpc')); }
  }
  capture.observations = rpc.observations; capture.failedCalls = rpc.failedCalls;
  capture.health = [graphql.health, rpc.health];
  if (capture.acquisitionFailures.some(f => f.stage === 'discovery')) graphql.health.status = 'unavailable';
  if (analysis.findings.length || capture.acquisitionFailures.some(f => f.stage === 'rpc')) rpc.health.status = rpc.observations.length ? 'degraded' : 'unavailable';
  return receipt(CaptureSchema.parse(capture), analysis, 'live-rpc');
}

class ReplayReader implements ContractReader {
  readonly block: RpcBlock;
  constructor(private readonly capture: LiveCapture) {
    if (!capture.block) throw new Error('Capture has no block'); this.block = capture.block;
  }
  async call(to: string, data: string): Promise<string> {
    const address = AddressSchema.parse(to); const calldata = data.toLowerCase();
    const found = this.capture.observations.find(item => item.to === address && item.data === calldata);
    if (found) return found.result;
    const failed = this.capture.failedCalls.find(item => item.to === address && item.data === calldata);
    throw new SourceFailure(failed?.code ?? 'invalid-response', 'Recorded contract call is unavailable');
  }
}
export async function replayLiveCapture(input: unknown, limits: { maxMarkets?: number } = {}): Promise<LiveReceipt> {
  const capture = CaptureSchema.parse(input); const { maxMarkets } = LimitsSchema.parse(limits);
  const analysis = capture.block && capture.metadata
    ? await analyzeMetaMorpho(new ReplayReader(capture), capture.owner, capture.vault, maxMarkets, capture.metadata.asset.address, MORPHO_BLUE_BY_CHAIN[capture.chainId]!)
    : { vault: null, markets: [], findings: [{ stage: 'capture', code: 'missing-root-evidence' }], unattributedAssetsRaw: null };
  return receipt(capture, analysis, 'recorded-rpc');
}

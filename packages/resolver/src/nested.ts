import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import type { MarketObservation } from '../../domain/src/live.js';
import { UintSchema } from '../../domain/src/live.js';
import { ETHEREUM_USDC, MORPHO_BLUE_ETHEREUM, readUint, SELECTOR } from '../../adapters/src/morpho-blue.js';
import { readV2Root, reconcileV2, V2 } from '../../adapters/src/morpho-v2.js';
import { decodeAddress, PinnedRpc, word } from '../../sources/src/evm.js';
import type { ContractReader } from '../../sources/src/evm.js';
import { SourceFailure } from '../../sources/src/http.js';
import { evidenceDigest, RecordedReader, RpcEvidenceSchema } from '../../sources/src/recorded.js';
import { analyzeMetaMorpho } from './live.js';
import { readUsdcPrice, valueUsdc } from '../../sources/src/chainlink.js';
import type { UsdcPrice } from '../../sources/src/chainlink.js';
import { assessLoanBacking } from '../../verification/src/backing.js';

export const NestedCaptureSchema = z.strictObject({
  captureVersion: z.literal(1), scope: z.literal('morpho-v2-v1-blue'), chainId: z.literal(1),
  owner: AddressSchema, vault: AddressSchema, capturedAt: z.iso.datetime(),
  rpc: RpcEvidenceSchema, failures: z.array(z.string().max(80)).max(100),
});
type NestedCapture = z.infer<typeof NestedCaptureSchema>;
interface Branch {
  adapter: string;
  vault: string | null;
  assetsRaw: string;
  attributedAssetsRaw: string | null;
  markets: MarketObservation[];
}
function sourceCode(error: unknown): string {
  if (error instanceof SourceFailure) return error.code;
  if (error instanceof z.ZodError) return 'invalid-response';
  throw error;
}

async function analyzeNested(reader: ContractReader, owner: string, vault: string) {
  const root = await readV2Root(reader, vault, owner);
  const idle = await readUint(reader, root.asset, SELECTOR.balance, word(vault));
  const branches: Branch[] = [];
  const findings: string[] = [];
  const adapters = new Set<string>();
  const childShares = new Map<string, bigint>();
  let realAssets = idle;
  for (let index = 0; index < root.count; index++) {
    const adapter = decodeAddress(await reader.call(vault, V2.adapters + word(BigInt(index))));
    if (adapters.has(adapter)) throw new SourceFailure('invalid-response', 'Duplicate V2 adapter');
    adapters.add(adapter);
    const assets = await readUint(reader, adapter, V2.realAssets);
    realAssets += assets;
    const branch: Branch = { adapter, vault: null, assetsRaw: assets.toString(), attributedAssetsRaw: null, markets: [] };
    branches.push(branch);
    // A zero-valued adapter adds no exposure. Its type remains unverified.
    if (assets === 0n) continue;
    try {
      const parent = decodeAddress(await reader.call(adapter, V2.parentVault));
      const child = decodeAddress(await reader.call(adapter, V2.morphoVaultV1));
      if (parent !== vault || child === vault || child === adapter) {
        throw new SourceFailure('invalid-response', 'Invalid or cyclic adapter ownership');
      }
      branch.vault = child;
      const allocation = await readUint(reader, adapter, V2.allocation);
      if (allocation === 0n) throw new SourceFailure('invalid-response', 'Positive adapter assets without allocation');
      const analysis = await analyzeMetaMorpho(reader, adapter, child, 64, ETHEREUM_USDC, MORPHO_BLUE_ETHEREUM);
      if (analysis.findings.length || !analysis.vault || BigInt(analysis.vault.convertToAssetsRaw) !== assets) {
        throw new SourceFailure('invalid-response', 'Nested V1 accounting did not reconcile');
      }
      const claimedShares = (childShares.get(child) ?? 0n) + BigInt(analysis.vault.sharesRaw);
      childShares.set(child, claimedShares);
      if (claimedShares > BigInt(analysis.vault.totalSupplyRaw)) {
        throw new SourceFailure('invalid-response', 'Combined adapter ownership exceeds child supply');
      }
      branch.markets = analysis.markets;
    } catch (error) {
      findings.push(`adapter-${index}:${sourceCode(error)}`);
    }
  }
  if (!reconcileV2(root, realAssets)) findings.push('v2-accounting-mismatch');
  let attributed = 0n;
  const idleQuote = realAssets === 0n ? 0n : root.quote * idle / realAssets;
  if (findings.length === 0) {
    attributed = idleQuote;
    for (const branch of branches) {
      const assets = BigInt(branch.assetsRaw);
      const quote = realAssets === 0n ? 0n : root.quote * assets / realAssets;
      branch.attributedAssetsRaw = quote.toString();
      // Allocate the root's branch claim using the child's already reconstructed claims.
      for (const market of branch.markets) {
        const product = quote * BigInt(market.attributedAssetsRaw!);
        market.attributedAssetsRaw = (assets === 0n ? 0n : product / assets).toString();
        market.attributionRemainder = (assets === 0n ? 0n : product % assets).toString();
        attributed += BigInt(market.attributedAssetsRaw);
      }
    }
  } else {
    for (const branch of branches) for (const market of branch.markets) {
      market.attributedAssetsRaw = null;
      market.attributionRemainder = null;
    }
  }
  return {
    findings, branches, quoteRaw: root.quote.toString(), totalAssetsRaw: root.assets.toString(),
    controlledAssetsRaw: realAssets.toString(), idleAssetsRaw: idle.toString(),
    attributedIdleRaw: findings.length ? null : idleQuote.toString(),
    unattributedAssetsRaw: findings.length ? null : (root.quote - attributed).toString(),
    economicLayers: branches.some(branch => branch.markets.some(market => BigInt(market.attributedAssetsRaw ?? '0') > 0n)) ? 3 : 1,
  };
}

export async function replayNestedCapture(input: unknown, sourceMode: 'live-rpc' | 'recorded-rpc' = 'recorded-rpc') {
  const capture = NestedCaptureSchema.parse(input);
  let analysis: Awaited<ReturnType<typeof analyzeNested>> | null = null;
  const findings = [...capture.failures];
  if (!capture.rpc.confirmed || !capture.rpc.block) findings.push('unconfirmed-block');
  if (findings.length === 0) {
    try { analysis = await analyzeNested(new RecordedReader(capture.rpc), capture.owner, capture.vault); }
    catch (error) { findings.push(sourceCode(error)); }
  }
  findings.push(...(analysis?.findings ?? []));
  let price: UsdcPrice | null = null;
  if (capture.rpc.confirmed && capture.rpc.block) {
    try { price = await readUsdcPrice(new RecordedReader(capture.rpc)); }
    catch (error) { sourceCode(error); }
  }
  return {
    reportType: 'nested-exposure' as const, schemaVersion: 1, sourceMode,
    status: findings.length ? 'partial' as const : 'complete' as const,
    captureDigest: evidenceDigest(capture), capture, analysis, findings,
    allocationBasis: 'pro-rata-controlled-assets' as const,
    verification: 'rpc-accounting-only' as const,
    backing: analysis ? assessLoanBacking(analysis.branches.flatMap(branch => branch.markets)) : null,
    valuation: price && analysis && findings.length === 0 ? { kind: 'observed' as const, price, rootClaim: valueUsdc(analysis.quoteRaw, price) }
      : { kind: 'unavailable' as const },
    metric: { kind: 'unavailable' as const, reasons: ['missing-approved-backing-adapter', ...(!price ? ['missing-valuation'] : [])] },
  };
}

export const NestedOptionsSchema = z.strictObject({
  owner: AddressSchema, vault: AddressSchema, rpcUrl: z.string().min(1), blockNumber: UintSchema.optional(),
  timeoutMs: z.number().int().min(100).max(60000).default(10000),
});
export async function resolveNestedPosition(input: z.input<typeof NestedOptionsSchema>) {
  const options = NestedOptionsSchema.parse(input);
  const rpc = new PinnedRpc(options.rpcUrl, options.timeoutMs, 1000, 300000);
  const capture: NestedCapture = {
    captureVersion: 1, scope: 'morpho-v2-v1-blue', chainId: 1,
    owner: options.owner, vault: options.vault, capturedAt: new Date().toISOString(),
    rpc: { block: null, confirmed: false, calls: rpc.observations, failedCalls: rpc.failedCalls }, failures: [],
  };
  try {
    await rpc.pin(1, options.blockNumber);
    capture.rpc.block = rpc.block;
    await analyzeNested(rpc, options.owner, options.vault);
    // Price failure does not erase an otherwise valid accounting exposure.
    try { await readUsdcPrice(rpc); } catch (error) { sourceCode(error); }
    await rpc.confirm();
    capture.rpc.confirmed = true;
  } catch (error) { capture.failures.push(sourceCode(error)); }
  return replayNestedCapture(capture, 'live-rpc');
}

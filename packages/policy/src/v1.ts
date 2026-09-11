import { z } from 'zod/v4';
import { Evidence } from './decision.js';

const Hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value => value.toLowerCase());
const Address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(value => value.toLowerCase());
const Raw = z.string().regex(/^(0|[1-9][0-9]{0,77})$/).refine(value => BigInt(value) < 2n ** 256n);
const Hex = z.string().regex(/^0x[0-9a-fA-F]{1,64}$/);
const Block = z.object({ number: Hex, hash: Hash, timestamp: Hex });
const V1 = z.object({
  schemaVersion: z.literal(3), protocol: z.literal('metamorpho-v1-blue-v1'),
  sourceMode: z.enum(['live-rpc', 'recorded-rpc']), kind: z.enum(['complete', 'partial']),
  chainId: z.literal(1), owner: Address, verification: z.literal('not-independently-verified'),
  capture: z.object({ chainId: z.literal(1), owner: Address, vault: Address, block: Block.nullable(), blockConfirmed: z.boolean() }),
  vault: z.object({ address: Address, sharesRaw: Raw, totalSupplyRaw: Raw, convertToAssetsRaw: Raw }).nullable(),
  markets: z.array(z.object({ marketId: Hash, attributedAssetsRaw: Raw.nullable() })).max(64),
  unattributedAssetsRaw: Raw.nullable(), findings: z.array(z.unknown()).max(1000),
});
const Shares = z.object({
  reportType: z.literal('share-verification'), sourceMode: z.enum(['live-graph-rpc', 'recorded-graph-rpc']),
  status: z.enum(['matched', 'mismatch', 'incomplete']),
  capture: z.object({ chainId: z.literal(1), owner: Address, vault: Address, expectedDeployment: z.string().nullable(),
    rpc: z.object({ block: Block.nullable(), confirmed: z.boolean() }),
    graph: z.object({ data: z.object({ _meta: z.object({ deployment: z.string() }) }) }).nullable(),
  }),
  checks: z.array(z.object({ field: z.string(), rpc: z.string(), graph: z.string(), status: z.enum(['matched', 'mismatch']) })).max(4),
  findings: z.array(z.unknown()).max(30),
});
const Accounting = z.object({
  reportType: z.literal('accounting-verification'),
  sourceMode: z.enum(['live-graph-rpc', 'recorded-graph-rpc']),
  status: z.enum(['matched', 'mismatch', 'incomplete']),
  capture: z.object({
    chainId: z.literal(1), vault: Address, expectedDeployment: z.string().nullable(),
    rpc: z.object({ block: Block.nullable(), confirmed: z.boolean() }),
    graph: z.object({
      _meta: z.object({ block: z.object({ number: z.number().int(), hash: Hash.nullable() }),
        deployment: z.string(), hasIndexingErrors: z.boolean() }),
      accountingState: z.object({ id: Address, chainId: z.literal(1), blockNumber: Raw,
        blockHash: Hash, timestamp: Raw,
        reads: z.array(z.object({ to: Address, data: z.string(), result: z.string() })).max(264),
      }).nullable(),
    }).nullable(),
  }),
  checks: z.array(z.object({ to: Address, data: z.string(), rpc: z.string(), graph: z.string().nullable(),
    status: z.enum(['matched', 'mismatch', 'missing']) })).max(264),
  findings: z.array(z.unknown()).max(100),
});

/** A projection of the configured Tare service's reports, not independent source authentication. */
export function v1Evidence(resolution: unknown, verification: unknown,
  expected: { owner: string; vault: string; deployment: string }): Evidence {
  const report = V1.parse(resolution);
  const shares = Shares.parse(verification);
  const block = report.capture.block;
  if (!block) throw new Error('Tare report has no block evidence');
  const aligned = [report.owner, report.capture.owner, shares.capture.owner].every(owner => owner === expected.owner.toLowerCase())
    && [report.capture.vault, shares.capture.vault, report.vault?.address].every(vault => vault === expected.vault.toLowerCase())
    && shares.capture.rpc.block?.hash === block.hash
    && BigInt(shares.capture.rpc.block.number) === BigInt(block.number)
    && BigInt(shares.capture.rpc.block.timestamp) === BigInt(block.timestamp)
    && shares.capture.expectedDeployment === expected.deployment
    && shares.capture.graph?.data._meta.deployment === expected.deployment;
  const fields = new Map(shares.checks.map(check => [check.field, check]));
  const checksMatch = fields.size === 4 && ['asset', 'share-decimals', 'owner-shares', 'total-shares'].every(field => fields.has(field))
    && shares.checks.every(check => check.status === 'matched' && check.rpc === check.graph)
    && fields.get('owner-shares')?.rpc === report.vault?.sharesRaw && fields.get('total-shares')?.rpc === report.vault?.totalSupplyRaw;
  const amounts = report.markets.map(market => BigInt(market.attributedAssetsRaw ?? '0'));
  const total = BigInt(report.vault?.convertToAssetsRaw ?? '0');
  const largest = amounts.reduce((max, value) => value > max ? value : max, 0n);
  const conserved = amounts.reduce((sum, value) => sum + value, 0n) + BigInt(report.unattributedAssetsRaw ?? '0') === total;
  const complete = aligned && checksMatch && conserved && report.kind === 'complete' && report.findings.length === 0
    && report.capture.blockConfirmed && shares.capture.rpc.confirmed && shares.status === 'matched' && shares.findings.length === 0
    && report.unattributedAssetsRaw !== null && report.markets.every(market => market.attributedAssetsRaw !== null)
    && new Set(report.markets.map(market => market.marketId)).size === report.markets.length;
  return Evidence.parse({ chainId: 1, owner: report.owner, vault: report.capture.vault,
    blockNumber: BigInt(block.number).toString(), blockHash: block.hash, blockTimestamp: BigInt(block.timestamp).toString(),
    live: report.sourceMode === 'live-rpc' && shares.sourceMode === 'live-graph-rpc', complete,
    backingVerified: false, multiple: null,
    largestMarketBps: total > 0n && largest <= total ? Number((largest * 10000n + total - 1n) / total) : null,
  });
}

/** Project a live accounting cross-check into non-executable confidential policy evidence. */
export function v1AccountingEvidence(resolution: unknown, verification: unknown,
  expected: { owner: string; vault: string; deployment: string }): Evidence {
  const report = V1.parse(resolution);
  const accounting = Accounting.parse(verification);
  const block = report.capture.block;
  if (!block) throw new Error('Tare report has no block evidence');
  const graph = accounting.capture.graph;
  const state = graph?.accountingState;
  const expectedOwner = expected.owner.toLowerCase();
  const expectedVault = expected.vault.toLowerCase();
  const aligned = report.owner === expectedOwner && report.capture.owner === expectedOwner
    && report.capture.vault === expectedVault && report.vault?.address === expectedVault
    && accounting.capture.vault === expectedVault && accounting.capture.expectedDeployment === expected.deployment
    && accounting.capture.rpc.block?.hash === block.hash
    && BigInt(accounting.capture.rpc.block?.number ?? '-1') === BigInt(block.number)
    && BigInt(accounting.capture.rpc.block?.timestamp ?? '-1') === BigInt(block.timestamp)
    && graph?._meta.deployment === expected.deployment && graph._meta.block.hash === block.hash
    && BigInt(graph._meta.block.number) === BigInt(block.number)
    && state?.id === expectedVault && state.blockHash === block.hash
    && BigInt(state.blockNumber) === BigInt(block.number) && BigInt(state.timestamp) === BigInt(block.timestamp);
  const indexed = new Map(state?.reads.map(read => [`${read.to}:${read.data}`, read.result]) ?? []);
  const keys = new Set(accounting.checks.map(check => `${check.to}:${check.data}`));
  const checksMatch = accounting.checks.length === 56 && keys.size === 56 && indexed.size === 56
    && accounting.checks.every(check => check.status === 'matched' && check.graph === check.rpc
      && indexed.get(`${check.to}:${check.data}`) === check.rpc);
  const amounts = report.markets.map(market => BigInt(market.attributedAssetsRaw ?? '0'));
  const total = BigInt(report.vault?.convertToAssetsRaw ?? '0');
  const largest = amounts.reduce((max, value) => value > max ? value : max, 0n);
  const conserved = amounts.reduce((sum, value) => sum + value, 0n)
    + BigInt(report.unattributedAssetsRaw ?? '0') === total;
  const complete = aligned && checksMatch && conserved && report.kind === 'complete' && report.findings.length === 0
    && report.capture.blockConfirmed && accounting.capture.rpc.confirmed && accounting.status === 'matched'
    && accounting.findings.length === 0 && graph?._meta.hasIndexingErrors === false
    && report.unattributedAssetsRaw !== null && report.markets.every(market => market.attributedAssetsRaw !== null)
    && new Set(report.markets.map(market => market.marketId)).size === report.markets.length;
  return Evidence.parse({ chainId: 1, owner: report.owner, vault: report.capture.vault,
    blockNumber: BigInt(block.number).toString(), blockHash: block.hash,
    blockTimestamp: BigInt(block.timestamp).toString(),
    live: report.sourceMode === 'live-rpc' && accounting.sourceMode === 'live-graph-rpc', complete,
    backingVerified: false, multiple: null,
    largestMarketBps: total > 0n && largest <= total
      ? Number((largest * 10000n + total - 1n) / total) : null,
  });
}

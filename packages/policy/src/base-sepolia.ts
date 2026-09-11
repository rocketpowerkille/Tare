import { z } from 'zod/v4';
import { Evidence, EXECUTION_CHAIN_ID } from './decision.js';

const Address = z.string().regex(/^0x[0-9a-f]{40}$/);
const Hash = z.string().regex(/^0x[0-9a-f]{64}$/);
const Raw = z.string().regex(/^(0|[1-9][0-9]{0,77})$/).refine(value => BigInt(value) < 2n ** 256n);
const Digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const Block = z.strictObject({ number: z.string().regex(/^0x[0-9a-f]{1,64}$/), hash: Hash,
  timestamp: z.string().regex(/^0x[0-9a-f]{1,64}$/) });
const Code = z.strictObject({ address: Address, code: z.string().regex(/^0x[0-9a-f]*$/),
  blockHash: Hash, observedAt: z.string() });
const Witness = z.object({ providerId: Digest,
  rpc: z.object({ block: Block.nullable(), confirmed: z.boolean() }), codes: z.array(Code).max(3) });
const BaseCustody = z.object({
  reportType: z.literal('base-sepolia-custody'), schemaVersion: z.literal(1),
  sourceMode: z.enum(['live-rpc', 'recorded-rpc']), status: z.enum(['matched', 'incomplete']),
  findings: z.array(z.string()).max(30),
  capture: z.object({
    chainId: z.literal(EXECUTION_CHAIN_ID), owner: Address,
    deployment: z.object({ outerVault: Address, innerVault: Address, terminalAsset: Address }),
    failures: z.array(z.string()).max(10), witnesses: z.tuple([Witness, Witness]),
  }),
  view: z.object({ ownerTerminalAssets: Raw }).nullable(),
  metric: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('available'), scope: z.literal('base-sepolia-two-layer-control'),
      terminalAsset: Address, numeratorRaw: Raw, denominatorRaw: Raw, multipleMillionths: z.literal('2000000') }),
    z.object({ kind: z.literal('unavailable'), reasons: z.array(z.string()) }),
  ]),
});

/** Convert the allowlisted two-provider Base Sepolia control into executable policy evidence. */
export function baseSepoliaCustodyEvidence(raw: unknown, expected: { owner: string; vault: string }): Evidence {
  const report = BaseCustody.parse(raw);
  const capture = report.capture;
  const [first, second] = capture.witnesses;
  const block = first.rpc.block;
  if (!block) throw new Error('Base Sepolia report has no block evidence');
  const addresses = new Set([
    capture.deployment.outerVault,
    capture.deployment.innerVault,
    capture.deployment.terminalAsset,
  ]);
  const codesMatch = capture.witnesses.every(witness => witness.codes.length === 3
    && new Set(witness.codes.map(code => code.address)).size === 3
    && witness.codes.every(code => addresses.has(code.address) && code.blockHash === block.hash));
  const blocksMatch = second.rpc.block !== null
    && JSON.stringify(first.rpc.block) === JSON.stringify(second.rpc.block);
  const metric = report.metric.kind === 'available' ? report.metric : null;
  const metricMatches = metric !== null && report.view !== null && metric.denominatorRaw !== '0'
    && metric.terminalAsset === capture.deployment.terminalAsset
    && metric.denominatorRaw === report.view.ownerTerminalAssets
    && BigInt(metric.numeratorRaw) === BigInt(metric.denominatorRaw) * 2n;
  const complete = report.sourceMode === 'live-rpc' && report.status === 'matched'
    && report.findings.length === 0 && capture.failures.length === 0
    && capture.owner === expected.owner.toLowerCase()
    && capture.deployment.outerVault === expected.vault.toLowerCase()
    && first.providerId !== second.providerId && first.rpc.confirmed && second.rpc.confirmed
    && blocksMatch && codesMatch && metricMatches;
  return Evidence.parse({
    chainId: EXECUTION_CHAIN_ID,
    owner: capture.owner,
    vault: capture.deployment.outerVault,
    blockNumber: BigInt(block.number).toString(),
    blockHash: block.hash,
    blockTimestamp: BigInt(block.timestamp).toString(),
    live: report.sourceMode === 'live-rpc',
    complete,
    backingVerified: complete,
    largestMarketBps: null,
    multiple: complete && metric ? { numerator: metric.numeratorRaw, denominator: metric.denominatorRaw } : null,
  });
}

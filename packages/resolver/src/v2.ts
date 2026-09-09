import { createHash } from 'node:crypto';
import { assetId, contractId, BudgetsV2Schema, ReceiptV2Schema, SnapshotV2Schema } from '../../domain/src/v2.js';
import type { BudgetsV2, FindingV2, ResolutionV2 } from '../../domain/src/v2.js';

export function resolveSnapshotV2(input: unknown, limits: Partial<BudgetsV2> = {}): ResolutionV2 {
  const snapshot = SnapshotV2Schema.parse(input);
  const budgets = BudgetsV2Schema.parse(limits);
  const nodes = new Map(snapshot.nodes.map(node => [node.address, node]));
  const evidence = new Map(snapshot.evidence.map(item => [item.id, item]));
  const sources = new Map(snapshot.sources.map(source => [source.id, source]));
  const id = (address: string) => assetId(snapshot.chainId, address);
  const findings: FindingV2[] = [];
  const steps: ResolutionV2['steps'] = [];
  const leaves = new Map<string, ResolutionV2['leaves'][number]>();
  const dependencies = new Map<string, ResolutionV2['dependencies'][number]>();
  const attributed = new Map<string, bigint>();
  let visits = 0;
  let edges = 0;
  let resolvedTerminals = 0;
  let exhausted = false;
  let contradictoryOwnership = false;
  function gap(reason: FindingV2['reason'], path: string[], evidenceId?: string): void {
    findings.push({ reason, path, ...(evidenceId ? { evidenceId } : {}) });
  }
  function checkEvidence(ref: string, path: string[]): boolean {
    const item = evidence.get(ref);
    if (!item) throw new Error('Missing validated evidence');
    if (item.chainId !== snapshot.chainId || item.block.number !== snapshot.block.number || item.block.hash !== snapshot.block.hash) {
      gap('block-mismatch', path, ref); return false;
    }
    if (sources.get(item.sourceId)?.status !== 'healthy') { gap('source-unavailable', path, ref); return false; }
    return true;
  }
  function visit(address: typeof snapshot.owner, amount: bigint, ancestors: string[], refs: string[]): void {
    if (exhausted) return;
    const key = id(address);
    const path = [...ancestors, key];
    if (visits >= budgets.maxVisits) { exhausted = true; gap('visit-limit', path); return; }
    visits++;
    if (ancestors.includes(key)) { gap('cycle', path); return; }
    const node = nodes.get(address);
    if (!node) { gap('missing-node', path); return; }
    if (!checkEvidence(node.evidenceId, path)) return;
    const provenance = [...new Set([...refs, node.evidenceId])];
    if (node.kind === 'opaque') { gap(node.reason, path, node.evidenceId); return; }
    if (node.kind === 'token') {
      const previous = leaves.get(key);
      leaves.set(key, { assetId: key, symbol: node.symbol, decimals: node.decimals,
        amountRaw: (BigInt(previous?.amountRaw ?? '0') + amount).toString(),
        evidenceIds: [...new Set([...(previous?.evidenceIds ?? []), ...provenance])].sort(), verification: 'unverified' });
      resolvedTerminals++; return;
    }
    if (ancestors.length >= budgets.maxDepth) { gap('depth-limit', path, node.evidenceId); return; }
    const supply = BigInt(node.totalSupplyRaw);
    if (supply === 0n) { gap('zero-supply', path, node.evidenceId); return; }
    const total = (attributed.get(key) ?? 0n) + amount;
    attributed.set(key, total);
    if (total > supply) {
      contradictoryOwnership = true; gap('ownership-exceeds-supply', path, node.evidenceId); return;
    }
    if (node.allocationCoverage === 'partial') gap('incomplete-allocation', path, node.evidenceId);
    // Inspect debts before attributing gross holdings to an owner.
    let unsupportedDebt = false;
    const holdings: Extract<typeof node.relationships[number], { kind: 'holding' }>[] = [];
    for (const edge of [...node.relationships].sort((a, b) => `${a.kind}:${a.target}`.localeCompare(`${b.kind}:${b.target}`))) {
      if (edges >= budgets.maxEdges) { exhausted = true; gap('edge-limit', path, node.evidenceId); break; }
      edges++;
      const targetId = edge.kind === 'risk-dependency' ? contractId(snapshot.chainId, edge.target) : id(edge.target);
      if (!checkEvidence(edge.evidenceId, [...path, targetId])) {
        if (edge.kind === 'debt') unsupportedDebt = true;
        continue;
      }
      if (edge.kind === 'debt') {
        if (BigInt(edge.balanceRaw) > 0n) { unsupportedDebt = true; gap('unsupported-debt', [...path, id(edge.target)], edge.evidenceId); }
      } else if (edge.kind === 'holding') holdings.push(edge);
      else dependencies.set(`${key}:${edge.kind}:${targetId}`, { from: key, to: targetId, kind: edge.kind, evidenceId: edge.evidenceId });
    }
    if (unsupportedDebt || exhausted) return;
    for (const edge of holdings) {
      if (exhausted) break;
      const product = amount * BigInt(edge.balanceRaw);
      const output = product / supply;
      steps.push({ from: key, to: id(edge.target), path, evidenceId: edge.evidenceId,
        inputRaw: amount.toString(), balanceRaw: edge.balanceRaw, totalSupplyRaw: node.totalSupplyRaw,
        outputRaw: output.toString(), remainderNumerator: (product % supply).toString() });
      visit(edge.target, output, path, [...provenance, edge.evidenceId]);
    }
  }
  for (const position of [...snapshot.positions].sort((a, b) => a.asset.localeCompare(b.asset))) {
    if (exhausted) break;
    if (checkEvidence(position.evidenceId, [id(position.asset)])) visit(position.asset, BigInt(position.sharesRaw), [], [position.evidenceId]);
  }
  // Contradictory ownership invalidates aggregation, regardless of traversal order.
  if (contradictoryOwnership) leaves.clear();
  return ReceiptV2Schema.parse({
    schemaVersion: 2, provenance: 'synthetic', name: snapshot.name, chainId: snapshot.chainId,
    snapshotDigest: `sha256:${createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')}`,
    block: snapshot.block, owner: snapshot.owner, positions: snapshot.positions,
    sources: snapshot.sources, evidence: snapshot.evidence, budgets,
    kind: findings.length ? 'partial' : 'complete', findings, steps,
    leaves: [...leaves.values()].sort((a, b) => a.assetId.localeCompare(b.assetId)),
    dependencies: [...dependencies.values()].sort((a, b) => `${a.from}:${a.kind}:${a.to}`.localeCompare(`${b.from}:${b.kind}:${b.to}`)),
    coverage: { visits, resolvedTerminals, unresolvedFindings: findings.length, valueCoverage: null },
    verification: { kind: 'unverified', reason: 'synthetic-evidence' },
    metric: { kind: 'unavailable', blockers: ['synthetic-evidence', 'missing-independent-verification', 'missing-valuation', ...(findings.length ? ['incomplete-resolution'] : [])] },
  });
}

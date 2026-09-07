import { BudgetsSchema, ReceiptSchema, SnapshotSchema } from '../../domain/src/index.js';
import type { Budgets, Gap, Resolution } from '../../domain/src/index.js';

// Offline proportional allocation model, not an ERC-4626 convertToAssets implementation.
export function resolveSnapshot(input: unknown, limits: Partial<Budgets> = {}): Resolution {
  const snapshot = SnapshotSchema.parse(input);
  const budgets = BudgetsSchema.parse(limits);
  const nodes = new Map(snapshot.nodes.map(node => [node.id, node]));
  const sources = new Map(snapshot.sources.map(source => [source.id, source]));
  const leaves = new Map<string, Resolution['leaves'][number]>();
  const steps: Resolution['steps'] = [];
  const gaps: Gap[] = [];
  let visits = 0;
  let resolvedTerminals = 0;
  let exhausted = false;
  const gap = (reason: Gap['reason'], path: string[], detail: string) => gaps.push({ reason, path, detail });

  function visit(id: string, amount: bigint, ancestors: string[]): void {
    if (exhausted) return;
    const path = [...ancestors, id];
    if (visits >= budgets.maxVisits) {
      exhausted = true;
      gap('visit-limit', path, 'Global traversal budget exhausted; remaining branches were not visited');
      return;
    }
    visits++;
    if (ancestors.includes(id)) { gap('cycle', path, 'Circular allocation path; cyclic backing is not valued'); return; }
    const node = nodes.get(id);
    if (!node) { gap('missing-node', path, 'Snapshot does not contain the referenced node'); return; }
    if (sources.get(node.sourceId)?.status !== 'healthy') { gap('source-unavailable', path, `Source ${node.sourceId} is unavailable in this snapshot`); return; }
    if (node.block.number !== snapshot.block.number || node.block.hash.toLowerCase() !== snapshot.block.hash.toLowerCase()) {
      gap('block-mismatch', path, 'Observation does not match the snapshot block'); return;
    }
    if (node.kind === 'opaque') { gap('unsupported-wrapper', path, node.reason); return; }
    if (node.kind === 'token') {
      resolvedTerminals++;
      const previous = leaves.get(id);
      leaves.set(id, { nodeId: id, symbol: node.symbol, decimals: node.decimals, amountRaw: (BigInt(previous?.amountRaw ?? '0') + amount).toString(), verification: 'unverified' });
      return;
    }
    // Depth counts vault layers, excluding the terminal token.
    if (ancestors.length >= budgets.maxDepth) { gap('depth-limit', path, 'Maximum vault depth reached'); return; }
    const supply = BigInt(node.totalSupplyRaw);
    if (amount > supply) { gap('ownership-exceeds-supply', path, 'Attributed shares exceed the observed total supply'); return; }
    for (const edge of node.allocations) {
      if (exhausted) break;
      const product = amount * BigInt(edge.balanceRaw);
      const output = product / supply;
      steps.push({ from: id, to: edge.target, sourceId: node.sourceId, path, inputRaw: amount.toString(), balanceRaw: edge.balanceRaw, totalSupplyRaw: node.totalSupplyRaw, outputRaw: output.toString(), remainderNumerator: (product % supply).toString() });
      visit(edge.target, output, path);
    }
  }
  visit(snapshot.root.nodeId, BigInt(snapshot.root.sharesRaw), []);
  const base = {
    schemaVersion: 1, provenance: snapshot.provenance, name: snapshot.name, chainId: snapshot.chainId,
    block: snapshot.block, root: snapshot.root, verification: 'unverified', budgets,
    coverage: { visits, resolvedTerminals, unresolvedBranches: gaps.length, valueCoverage: null },
    sources: snapshot.sources, leaves: [...leaves.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId)), steps,
    metric: { kind: 'unavailable', reasons: [
      'Synthetic snapshot; independent backing verification and common-unit valuation are not implemented',
      ...(gaps.length ? ['Traversal is incomplete'] : []),
    ] },
  };
  return ReceiptSchema.parse({ ...base, kind: gaps.length ? 'partial' : 'complete', gaps });
}

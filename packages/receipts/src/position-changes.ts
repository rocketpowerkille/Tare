import { positionSnapshot, type PositionSnapshot } from './position-snapshot.js';

export interface PositionChange {
  field: string;
  category: 'observed' | 'derived';
  marketId?: string | undefined;
  before?: string | undefined;
  after?: string | undefined;
  deltaRaw?: string;
  unit: string;
  status: 'changed' | 'unchanged' | 'unavailable' | 'only-before' | 'only-after';
}

/** Two explicit blocks, exact integers and market identities; never array-index matching. */
export function investigateChanges(current: unknown, previous: unknown) {
  const before = positionSnapshot(previous);
  const after = positionSnapshot(current);
  const issues: string[] = [];
  if (!before.supported || !after.supported) issues.push('unsupported-report');
  if (!before.owner || before.owner !== after.owner || !before.vault || before.vault !== after.vault
    || !before.chainId || before.chainId !== after.chainId || before.protocol !== after.protocol) issues.push('position-identity-mismatch');
  if (!before.asset || before.asset !== after.asset || before.decimals === undefined || before.decimals !== after.decimals) issues.push('asset-or-units-mismatch');
  if (!before.observedBlock || !after.observedBlock || !/^\d+$/.test(before.observedBlock) || !/^\d+$/.test(after.observedBlock)
    || BigInt(before.observedBlock) >= BigInt(after.observedBlock)) issues.push('blocks-not-increasing');
  if (!before.confirmed || !after.confirmed || !before.blockHash || !after.blockHash) issues.push('unconfirmed-block');
  if (before.blockHash && before.blockHash === after.blockHash) issues.push('same-block-hash');
  const comparable = issues.length === 0;
  const changes: PositionChange[] = [];
  function add(field: string, a: string | undefined, b: string | undefined, unit: string, category: PositionChange['category'] = 'observed', marketId?: string) {
    const status = a === undefined || b === undefined ? 'unavailable' : a === b ? 'unchanged' : 'changed';
    changes.push({ field, category, marketId, before: a, after: b, unit, status,
      ...(a !== undefined && b !== undefined && /^\d+$/.test(a) && /^\d+$/.test(b) ? { deltaRaw: (BigInt(b) - BigInt(a)).toString() } : {}) });
  }
  if (comparable) {
    for (const field of ['sharesRaw', 'totalSupplyRaw'] as const) add(field, before[field], after[field], 'vault share raw units');
    for (const field of ['totalAssetsRaw', 'conversionQuoteRaw'] as const) add(field, before[field], after[field], `${after.asset} raw units (${after.decimals} decimals)`);
    add('feeRaw', before.feeRaw, after.feeRaw, 'contract fee raw units (not a percentage)');
    const ids = [...new Set([...before.markets, ...after.markets].map(item => item.marketId!))].sort();
    for (const id of ids) {
      const a = before.markets.find(item => item.marketId === id);
      const b = after.markets.find(item => item.marketId === id);
      if (!a || !b) {
        changes.push({ field: 'market-presence', marketId: id, category: 'observed', unit: 'reported market membership',
          before: a ? 'observed' : before.completeMarkets ? 'not-in-complete-returned-set' : undefined,
          after: b ? 'observed' : after.completeMarkets ? 'not-in-complete-returned-set' : undefined,
          status: before.completeMarkets && after.completeMarkets ? a ? 'only-before' : 'only-after' : 'unavailable' });
        continue;
      }
      // Immutable Morpho market identity includes all five parameters. Conflicts forbid amount arithmetic.
      const parameters = ['loanToken', 'collateralToken', 'oracle', 'irm', 'lltvRaw'] as const;
      const matching = parameters.every(key => a[key] !== undefined && a[key] === b[key]) && a.loanToken === after.asset;
      for (const field of ['vaultAssetsRaw', 'attributedAssetsRaw'] as const) {
        add(field, matching ? a[field] : undefined, matching ? b[field] : undefined,
          `${after.asset} raw units (${after.decimals} decimals)`, 'derived', id);
      }
      if (!matching) issues.push(`market-parameters-unavailable-or-conflicting:${id}`);
    }
  }
  const endpoint = (snapshot: PositionSnapshot) => {
    const { markets: _markets, ...provenanceAndValues } = snapshot;
    return provenanceAndValues;
  };
  return { schemaVersion: 1, mode: 'bounded-two-block-comparison', comparable,
    status: !comparable ? 'unavailable' : before.graph.status === 'mismatch' || after.graph.status === 'mismatch' ? 'source-mismatch'
      : issues.length || !before.completeMarkets || !after.completeMarkets || changes.some(item => item.status === 'unavailable') ? 'partial'
        : before.graph.supportsAccounting && after.graph.supportsAccounting ? 'scoped-accounting-comparison' : 'rpc-only-comparison',
    before: endpoint(before), after: endpoint(after), changes, issues,
    changedFields: changes.filter(item => ['changed', 'only-before', 'only-after'].includes(item.status)).length,
    limitations: [
      'On-demand comparison of returned reports, not continuous monitoring or authenticated proof of uploaded source claims.',
      'Differences are derived from two observations, not proof of causation, a transaction, profit, loss, safety or backing.',
      'Missing markets or amounts are not zero. No change means no difference in comparable returned fields, not no intervening activity.',
      'Graph accounting supports only its checked scope at each aligned block. Missing history is not replaced with latest data.',
      'No market prices, withdrawal guarantees or complete historical ownership are established by this comparison.',
    ] };
}

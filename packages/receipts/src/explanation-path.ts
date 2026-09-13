import { address, array, metadata, object } from './explanation-data.js';
import type { EvidenceRecord } from './explanation-data.js';

export interface PathEntry {
  id: string;
  parentId: string | null;
  kind: string;
  identifier: string;
  classification: string;
}

/** Preserve branching, rather than presenting parallel allocations as one serial path. */
export function explanationPath(report: EvidenceRecord) {
  const entries: PathEntry[] = [];
  const provenance = metadata(report);
  function add(id: string, parentId: string | null, kind: string, identifier: string | undefined, classification: string) {
    if (identifier) entries.push({ id, parentId, kind, identifier, classification });
  }
  add('wallet', null, 'wallet', provenance.owner, 'requested identity, not proof of ownership');
  add('vault', provenance.owner ? 'wallet' : null, 'vault', provenance.vault, 'requested vault; inspect returned observations');
  function markets(items: unknown, parentId: string, prefix: string) {
    array(items).forEach((item, index) => {
      const market = object(item);
      const identifier = typeof market.marketId === 'string' && /^0x[\da-fA-F]{64}$/.test(market.marketId) ? market.marketId : undefined;
      if (!identifier) return;
      const id = `${prefix}-${index}`;
      add(id, parentId, 'market', identifier, 'reported market; allocation is derived');
      add(`${id}-asset`, id, 'loan asset', address(market.loanToken), 'observed identifier, not custody');
    });
  }
  if (provenance.vault) {
    const position = object(report.protocol === 'erc4626' ? report.position : report.vault);
    add('asset', 'vault', 'underlying asset', address(position.asset), 'observed identifier, not custody');
    markets(report.markets, 'vault', 'market');
    array(object(report.analysis).branches).forEach((item, index) => {
      const branch = object(item);
      const id = `branch-${index}`;
      const vault = address(branch.vault);
      add(id, 'vault', vault ? 'nested vault' : 'unresolved adapter', vault ?? address(branch.adapter), vault ? 'derived path' : 'not verified');
      if (vault) markets(branch.markets, id, `${id}-market`);
    });
  }
  return { entries: entries.slice(0, 16), omittedEntries: Math.max(0, entries.length - 16) };
}

import { array, object } from './explanation-data.js';
import { positionSnapshot } from './position-snapshot.js';

/** Morpho V1 leaf markets only. Never combines a nested parent with its child holdings. */
export function exposureOverlap(input: unknown) {
  const wallet = object(input);
  const results = array(wallet.results);
  const positions = results.slice(0, 3).map(object).map(item => positionSnapshot(item.report));
  const eligible = positions.filter(position => position.supported && position.protocol === 'metamorpho-v1-blue-v1' && position.confirmed
    && position.owner && position.owner === String(wallet.owner).toLowerCase() && position.vault && position.chainId && position.blockHash);
  const identities = eligible.map(position => `${position.chainId}:${position.vault}`);
  const unique = eligible.filter((_position, index) => identities.filter(identity => identity === identities[index]).length === 1);
  const keys = [...new Set(unique.flatMap(position => position.markets.map(market => `${position.chainId}:${market.marketId}`)))].sort();
  const overlaps = keys.flatMap(key => {
    const members = unique.flatMap(position => position.markets.filter(market => `${position.chainId}:${market.marketId}` === key).map(market => ({
      vault: position.vault!, owner: position.owner!, chainId: position.chainId!, market,
      asset: position.asset, decimals: position.decimals, observedBlock: position.observedBlock,
      blockHash: position.blockHash, sourceMode: position.sourceMode, capturedAt: position.capturedAt,
      evidenceId: position.evidenceId, reportStatus: position.status,
    })));
    if (members.length < 2) return [];
    const first = members[0]!;
    const sameBlock = members.every(member => member.observedBlock !== undefined && member.observedBlock === first.observedBlock && member.blockHash === first.blockHash);
    const compatible = first.asset !== undefined && first.decimals !== undefined && members.every(member => member.asset === first.asset
      && member.decimals === first.decimals && member.market.loanToken === first.asset
      && (['collateralToken', 'oracle', 'irm', 'lltvRaw'] as const).every(field => member.market[field] !== undefined && member.market[field] === first.market[field]));
    const amountsPresent = members.every(member => member.market.attributedAssetsRaw !== undefined);
    return [{ key, marketId: first.market.marketId!, chainId: first.chainId, members, sameBlock,
      status: !compatible ? 'conflicting-or-missing-parameters' : !sameBlock ? 'different-blocks' : !amountsPresent ? 'amount-unavailable' : 'derived-overlap',
      totalAttributedAssetsRaw: compatible && sameBlock && amountsPresent
        ? members.reduce((sum, member) => sum + BigInt(member.market.attributedAssetsRaw!), 0n).toString() : null,
    }];
  });
  return { schemaVersion: 1, scope: 'at-most-three-morpho-v1-positions', overlaps,
    inspectedPositions: positions.length, eligiblePositions: unique.length,
    excludedPositions: positions.length - unique.length, omittedPositions: Math.max(0, results.length - 3),
    coverageComplete: false,
    limitations: ['Bounded discovery is not a complete wallet inventory. No overlap found is not proof of diversification.',
      'Only confirmed Morpho V1 leaf-market reports are included. Nested parents and unsupported reports are excluded to avoid double-counting.',
      'Shared markets are derived allocation relationships, not proof of direct asset custody or predicted losses. Collateral and oracle addresses are dependencies, not holdings.',
      'Totals require matching chain, asset units, market parameters and block hash. Different-block amounts are shown separately, never summed.',
      'Repeated vault identities are excluded rather than choosing an arbitrary duplicate. Missing amounts are not zero; reported zero amounts do not establish positive exposure.'] };
}

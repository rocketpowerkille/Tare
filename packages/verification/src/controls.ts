import { evaluateClaimMultiple } from './metric.js';

export function metricControls() {
  const base = {
    scope: 'local-control' as const, complete: true, debt: 'zero-verified' as const,
    valuation: 'fresh-common-usd' as const,
    claims: [{ id: 'layer-one', usdRaw: '10000000000' }],
    backing: [{ id: 'custody', usdRaw: '10000000000', treatment: 'cash-custody' as const, verification: 'matched' as const }],
  };
  const cases = [
    { name: '1x-control', input: base },
    { name: '3x-shared-backing', input: { ...base, claims: [1, 2, 3].map(layer => ({ id: `layer-${layer}`, usdRaw: '10000000000' })) } },
    { name: 'partial', input: { ...base, complete: false } },
    { name: 'backing-mismatch', input: { ...base, backing: [{ ...base.backing[0]!, verification: 'mismatch' as const }] } },
  ];
  return cases.map(item => ({ name: item.name, origin: 'synthetic-methodology-control' as const, metric: evaluateClaimMultiple(item.input) }));
}

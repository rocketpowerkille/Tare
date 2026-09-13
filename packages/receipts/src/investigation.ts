import { explanationContext } from './explanation.js';
import { object, array, address, code } from './explanation-data.js';
import { investigateChanges } from './position-changes.js';
import { exposureOverlap } from './exposure-overlap.js';

export const answerSections = ['Short answer', 'What was directly observed', 'What was derived',
  'Which evidence sources were checked', 'What those checks support', 'What remains unknown',
  'Technical details and provenance'] as const;

/** Stable fact identities for links and Recipe citations, never an evidence score. */
export function investigationFacts(report: unknown, prefix = 'current') {
  const context = explanationContext(report);
  const facts: { id: string; category: string; field: string; value: unknown }[] = [];
  for (const [category, values] of Object.entries(context.evidenceCategories)) {
    values.forEach((value, index) => facts.push({ id: `${prefix}.${category}.${index}`, category, field: value.field, value }));
  }
  context.sourceSummary.forEach((value, index) => facts.push({ id: `${prefix}.source.${index}`, category: 'source', field: value.id, value }));
  context.positionPath.forEach((value, index) => facts.push({ id: `${prefix}.path.${index}`, category: 'path', field: 'Position path', value }));
  facts.push({ id: `${prefix}.provenance`, category: 'provenance', field: 'Report provenance', value: {
    network: context.network, chainId: context.chainId, observedBlock: context.observedBlock,
    capturedAt: context.capturedAt, evidenceId: context.evidenceId, sourceMode: context.sourceMode,
    freshness: context.freshness, sourceBlocksDiffer: context.sourceBlocksDiffer,
    owner: context.owner, vault: context.vault, summaryStatus: context.summaryStatus,
  } });
  facts.push({ id: `${prefix}.limitations`, category: 'notVerified', field: 'Limitations', value: {
    limitations: context.limitations, findings: context.findings, supportedConclusion: context.supportedConclusion,
    omittedFacts: context.omittedFacts, omittedNotes: context.omittedNotes, omittedPathEntries: context.omittedPathEntries,
    detailPolicy: context.detailPolicy,
  } });
  const wallet = object(report);
  if (wallet.reportType === 'wallet-investigation') {
    const overlap = exposureOverlap(wallet);
    facts.push({ id: `${prefix}.overlap.scope`, category: 'notVerified', field: 'Overlap coverage and limitations', value: {
      scope: overlap.scope, inspectedPositions: overlap.inspectedPositions, eligiblePositions: overlap.eligiblePositions,
      excludedPositions: overlap.excludedPositions, omittedPositions: overlap.omittedPositions, limitations: overlap.limitations,
    } });
    overlap.overlaps.forEach((value, index) => facts.push({ id: `${prefix}.overlap.${index}`, category: 'derived', field: 'Shared market dependencies', value }));
    const discovery = object(wallet.discovery);
    facts.push({ id: `${prefix}.discovery`, category: 'observed', field: 'Bounded wallet discovery', value: {
      owner: address(wallet.owner), complete: discovery.complete === true, source: code(discovery.source),
      scope: code(discovery.scope), candidates: array(discovery.positions).length,
      limitation: 'Discovery is not verification or a complete wallet inventory. At most three candidates are checked. No results does not mean no assets.',
    } });
    array(wallet.results).slice(0, 3).map(object).forEach((item, index) => {
      if (item.report) facts.push(...investigationFacts(item.report, `${prefix}.position${index}`).facts);
      else facts.push({ id: `${prefix}.position${index}.unavailable`, category: 'notVerified', field: 'Candidate check unavailable', value: { vault: address(item.vault), status: code(item.status) } });
    });
  }
  return { context, facts };
}

/** Compare exact same-identity facts. No arithmetic across units, networks or sources. */
export function compareInvestigationReports(current: unknown, previous: unknown) {
  const left = investigationFacts(previous, 'previous');
  const right = investigationFacts(current);
  const a = left.context;
  const b = right.context;
  const comparable = a.chainId !== undefined && a.chainId === b.chainId
    && a.owner !== undefined && a.owner === b.owner && a.vault !== undefined && a.vault === b.vault
    && a.operation === b.operation;
  const key = (fact: typeof left.facts[number]) => `${fact.category}:${fact.field}`;
  // Repeated allocation fields cannot be paired by array order.
  const unique = (facts: typeof left.facts) => new Map(facts.filter(fact => facts.filter(other => key(other) === key(fact)).length === 1).map(fact => [key(fact), fact]));
  const old = unique(left.facts);
  const changes = comparable ? [...unique(right.facts).values()].flatMap(fact => {
    const before = old.get(key(fact));
    if (!before || JSON.stringify(before.value) === JSON.stringify(fact.value)) return [];
    return [{ field: fact.field, before: before.id, after: fact.id }];
  }) : [];
  return { comparable, changes, positionChanges: investigateChanges(current, previous), limitation: comparable
    ? 'Differences in returned evidence, not proof of a transaction, profit, loss or changed backing. Repeated allocations are not paired by array order.'
    : 'Network, wallet, vault or operation is missing or differs. These reports cannot be treated as the same position.' };
}

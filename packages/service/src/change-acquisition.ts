import { object } from '../../receipts/src/explanation-data.js';
import { positionSnapshot } from '../../receipts/src/position-snapshot.js';

export interface ChangeInput { owner: string; vault: string; beforeBlock: string; afterBlock: string }
export type AcquisitionStage = { id: string; status: 'active' | 'complete' | 'warning' | 'unavailable'; detail: string };
export type AnalyzeAtBlock = (input: { operation: 'resolve-v1' | 'verify-accounting'; vault: string; owner?: string; blockNumber: string }) => Promise<Record<string, unknown>>;

export function validateChangeInput(input: ChangeInput) {
  if (![input.owner, input.vault].every(value => /^0x[0-9a-fA-F]{40}$/.test(value))) throw new Error('Enter a valid public wallet and vault address.');
  if (![input.beforeBlock, input.afterBlock].every(value => /^(0|[1-9][0-9]{0,9})$/.test(value) && BigInt(value) <= 2147483647n)) {
    throw new Error('Enter explicit decimal blocks between 0 and 2147483647.');
  }
  if (BigInt(input.beforeBlock) >= BigInt(input.afterBlock)) throw new Error('The previous block must be earlier than the current block.');
}

/** Four bounded requests through existing routes. Never substitute head/latest or retry. */
export async function acquireChangeReports(input: ChangeInput, analyze: AnalyzeAtBlock,
  notify: (stage: AcquisitionStage) => void, graphEnabled: boolean, active = () => true) {
  validateChangeInput(input);
  const reports: Record<string, unknown>[] = [];
  for (const [side, blockNumber] of [['previous', input.beforeBlock], ['current', input.afterBlock]] as const) {
    if (!active()) throw new Error('Investigation cancelled.');
    notify({ id: `${side}-rpc`, status: 'active', detail: `Reading Ethereum position at block ${blockNumber}.` });
    let primary: Record<string, unknown> = { reportType: 'unavailable-position' };
    try {
      primary = await analyze({ operation: 'resolve-v1', owner: input.owner, vault: input.vault, blockNumber });
      if (!active()) throw new Error('Investigation cancelled.');
      const snapshot = positionSnapshot(primary);
      if (snapshot.chainId !== 1 || snapshot.owner !== input.owner.toLowerCase() || snapshot.vault !== input.vault.toLowerCase()
        || snapshot.observedBlock !== blockNumber || !snapshot.confirmed || !snapshot.blockHash) throw new Error('Position identity or requested block was not confirmed.');
      notify({ id: `${side}-rpc`, status: snapshot.status === 'complete' ? 'complete' : 'warning', detail: `Position response at block ${blockNumber}: ${snapshot.status}.` });
    } catch (error) {
      if (!active() || object(error).status === 401 || object(error).status === 402) throw error;
      // Do not retain an unexpected latest/different-position response as the requested evidence.
      primary = { reportType: 'unavailable-position' };
      notify({ id: `${side}-rpc`, status: 'unavailable', detail: `No confirmed position response at block ${blockNumber}. Archive reads may be unavailable; no latest-block fallback was made.` });
    }
    const modules: Record<string, unknown>[] = [];
    if (graphEnabled && primary.reportType !== 'unavailable-position') {
      notify({ id: `${side}-graph`, status: 'active', detail: `Querying indexed accounting and RPC at block ${blockNumber}.` });
      try {
        if (!active()) throw new Error('Investigation cancelled.');
        const report = await analyze({ operation: 'verify-accounting', vault: input.vault, blockNumber });
        if (!active()) throw new Error('Investigation cancelled.');
        modules.push({ id: 'the-graph', eligible: true, status: report.status, report });
        const graph = positionSnapshot({ primary, modules }).graph;
        notify({ id: `${side}-graph`, status: graph.supportsAccounting ? 'complete' : 'warning',
          detail: `The Graph: ${graph.status}. ${graph.supportsAccounting ? 'Accounting comparison aligned to the position block.' : 'No complete aligned accounting agreement established.'}` });
      } catch (error) {
        if (!active() || object(error).status === 401 || object(error).status === 402) throw error;
        modules.push({ id: 'the-graph', eligible: true, status: 'unavailable' });
        notify({ id: `${side}-graph`, status: 'unavailable', detail: `Graph request could not complete at block ${blockNumber}. No latest-block fallback was made.` });
      }
    } else {
      modules.push({ id: 'the-graph', eligible: graphEnabled, status: 'unavailable' });
      notify({ id: `${side}-graph`, status: 'unavailable', detail: graphEnabled ? 'Not queried without a confirmed position block.' : 'Indexed accounting is not configured on this deployment.' });
    }
    reports.push({ reportType: 'comprehensive-position-check', status: modules.some(module => module.status === 'mismatch') ? 'mismatch' : 'incomplete', primary, modules });
  }
  return { previous: reports[0]!, current: reports[1]! };
}

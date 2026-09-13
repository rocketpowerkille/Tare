import { list, record, text, type JsonRecord } from './types';

export type StageStatus = 'waiting' | 'active' | 'complete' | 'warning' | 'unavailable';
export interface EvidenceStage {
  id: string;
  title: string;
  status: StageStatus;
  detail: string;
  receivedAt?: string;
}
export type ProgressObserver = (id: string, status: StageStatus, detail: string) => void;

export function initialStages(composed: boolean, replay = false): EvidenceStage[] {
  const stages: [string, string, string][] = composed ? [
    ['authorization', 'Analysis authorization', 'Waiting for the server to accept this request.'],
    ['position', 'Position located', 'Requesting the position. An address alone does not establish ownership of shares.'],
    ['layers', 'Vault layers traced', 'Trace details arrive together in the position response.'],
    ['allocations', 'Nested allocations', 'Waiting for the supported path and allocation evidence.'],
    ['the-graph', 'The Graph evidence', 'Eligibility depends on the check and network.'],
    ['chainlink', 'Chainlink reference price', 'Eligibility depends on the returned asset and network.'],
    ['coverage', 'Evidence coverage', 'Checking which conclusions the returned evidence supports.'],
    ['report', 'Report generated', 'Waiting for the eligible requests to settle.'],
  ] : [
    ['authorization', 'Analysis authorization', 'Waiting for the server to accept this request.'],
    ['request', replay ? 'Recorded evidence replay' : 'Requested evidence check', replay ? 'Recalculating saved evidence. No live blockchain query.' : 'Awaiting the configured source response.'],
    ['report', 'Report generated', 'The result will retain its source mode and limitations.'],
  ];
  return stages.map(([id, title, detail]) => ({ id, title, detail, status: id === 'authorization' || id === 'request' ? 'active' : 'waiting' }));
}

export function observePrimary(report: JsonRecord, notify: ProgressObserver) {
  const vault = record(report.vault);
  const position = record(report.position);
  const analysis = record(report.analysis);
  const shares = text(vault.sharesRaw) ?? text(position.sharesRaw);
  const hasQuote = text(vault.convertToAssetsRaw) !== undefined || text(position.assetsRaw) !== undefined || text(analysis.quoteRaw) !== undefined;
  const complete = ['complete', 'matched'].includes(text(report.status) ?? text(report.kind) ?? '');
  notify('authorization', 'complete', 'The API accepted the analysis credential. This is authorization evidence only.');
  notify('position', hasQuote ? (shares === '0' ? 'warning' : 'complete') : 'warning',
    shares === '0' ? 'The contract reports zero wallet shares at the checked block.' : hasQuote ? 'Position accounting returned. Inspect the observed shares and derived asset quote below.' : 'The response did not establish a usable position quote.');
  notify('layers', complete ? 'complete' : 'warning', complete ? 'The supported trace returned. This does not establish independent backing.' : 'The trace returned with missing or incomplete evidence.');
  const count = list(report.markets).length + list(analysis.branches).reduce<number>((sum, branch) => sum + list(record(branch).markets).length, 0);
  notify('allocations', count ? 'complete' : 'unavailable', count ? `${count} market entries returned, including any zero allocations. See the path for attribution.` : 'No downstream market entries were returned. This is not proof that none exist.');
}

export function observeModule(module: JsonRecord, notify: ProgressObserver) {
  const status = text(module.status);
  notify(String(module.id), ['verified', 'complete'].includes(status ?? '') ? 'complete'
    : ['not-eligible', 'not-used', 'unavailable'].includes(status ?? '') ? 'unavailable' : 'warning', text(module.summary) ?? 'No source explanation returned.');
}

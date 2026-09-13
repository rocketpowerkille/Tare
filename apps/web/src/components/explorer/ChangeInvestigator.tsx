import { useEffect, useId, useRef, useState } from 'react';
import { acquireChangeReports, validateChangeInput, type AcquisitionStage } from '../../../../../packages/service/src/change-acquisition';
import { api } from '../../lib/api';
import type { Capabilities, JsonRecord } from '../../lib/types';
import { ChangeReport } from './ChangeReport';
import { InvestigationAssistant } from './InvestigationAssistant';
import { useWalletAddress } from '../../lib/wallet-address';

export function ChangeInvestigator({ token, capabilities, disabled }: { token: string; capabilities: Capabilities; disabled: boolean }) {
  const id = useId();
  const [owner, setOwner] = useWalletAddress();
  const [fields, setFields] = useState({ vault: '', beforeBlock: '', afterBlock: '' });
  const input = { owner, ...fields };
  const [mode, setMode] = useState('live');
  const [reports, setReports] = useState<{ current?: JsonRecord; previous?: JsonRecord }>({});
  const [stages, setStages] = useState<AcquisitionStage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const locked = useRef(false);
  const uploads = useRef({ current: 0, previous: 0 });
  useEffect(() => {
    generation.current++; locked.current = false; setBusy(false); setReports({}); setStages([]); setError('');
    return () => { generation.current++; };
  }, [token, owner]);
  async function run() {
    if (locked.current || disabled) return;
    try { validateChangeInput(input); } catch (failure) { setError((failure as Error).message); return; }
    locked.current = true; setBusy(true); setError(''); setReports({}); setStages([]);
    const current = ++generation.current;
    try {
      const value = await acquireChangeReports(input, request => api.analyze(token, request), stage => {
        if (current === generation.current) setStages(previous => [...previous.filter(item => item.id !== stage.id), stage]);
      }, capabilities.live['verify-accounting'], () => current === generation.current);
      if (current === generation.current) setReports(value);
    } catch (failure) {
      if (current === generation.current) {
        setError(failure instanceof Error ? failure.message : 'The comparison could not complete.');
        setStages(previous => previous.map(stage => stage.status === 'active' ? { ...stage, status: 'unavailable', detail: 'Request stopped. No automatic retry was made.' } : stage));
      }
    } finally {
      if (current === generation.current) { locked.current = false; setBusy(false); }
    }
  }
  async function upload(side: 'current' | 'previous', file?: File) {
    if (!file) return;
    const current = generation.current;
    const uploadId = ++uploads.current[side];
    setReports(previous => { const next = { ...previous }; delete next[side]; return next; });
    try {
      if (file.size > 1_048_576) throw new Error('Choose a report JSON under 1 MiB.');
      const value = JSON.parse(await file.text());
      if (!value || typeof value !== 'object' || Array.isArray(value) || (!value.protocol && !value.reportType)) throw new Error('Choose a Tare report, not a capture.');
      if (current === generation.current && uploadId === uploads.current[side]) { setReports(previous => ({ ...previous, [side]: value })); setError(''); }
    } catch (failure) { if (current === generation.current && uploadId === uploads.current[side]) setError((failure as Error).message); }
  }
  return <section className="investigation-assistant change-investigator" aria-labelledby={`${id}-title`}>
    <p className="section-label">One position · Two observations</p>
    <h2 id={`${id}-title`}>See what changed.</h2>
    <p>Compare one Ethereum Morpho V1 wallet position at two explicit blocks. This is on-demand analysis, not continuous monitoring. It cannot explain why a change happened.</p>
    <label htmlFor={`${id}-mode`}>Evidence input</label><select id={`${id}-mode`} value={mode} disabled={busy} onChange={event => { setMode(event.target.value); setReports({}); setStages([]); setError(''); generation.current++; }}>
      <option value="live">Request two pinned blocks</option><option value="saved">Compare two saved reports</option>
    </select>
    {mode === 'saved' && <p className="source-caution">Saved reports only. No new blockchain requests are made. Source modes describe the original acquisition, not a fresh check; uploaded source claims are not authenticated.</p>}
    {mode === 'live' ? <form onSubmit={event => { event.preventDefault(); void run(); }}>
      <div className="change-inputs">{(['owner', 'vault', 'beforeBlock', 'afterBlock'] as const).map(field => <div key={field}>
        <label htmlFor={`${id}-${field}`}>{{ owner: 'Change investigation wallet', vault: 'Change investigation vault', beforeBlock: 'Previous block', afterBlock: 'Current block' }[field]}</label>
        <input id={`${id}-${field}`} value={input[field]} required disabled={busy || disabled} inputMode={field.endsWith('Block') ? 'numeric' : 'text'} onChange={event => {
          const value = event.target.value.trim();
          if (field === 'owner') setOwner(value);
          else setFields(previous => ({ ...previous, [field]: value }));
          setReports({}); setStages([]);
        }} />
      </div>)}</div>
      <p>Up to four API operations: two position reads and two indexed-accounting comparisons. Historical RPC and Graph coverage are required. A missing block stays unavailable; Tare never substitutes latest.</p>
      {!capabilities.live['resolve-v1'] && <p>Ethereum position reads are not configured. You can still compare saved reports.</p>}
      <button className="button secondary" disabled={busy || disabled || !capabilities.live['resolve-v1']} type="submit">{busy ? 'Reading the two blocks…' : 'Compare pinned blocks'}</button>
    </form> : <div className="change-inputs">{(['previous', 'current'] as const).map(side => <div key={side}>
      <label htmlFor={`${id}-${side}-file`}>{side === 'previous' ? 'Previous saved report' : 'Current saved report'}</label>
      <input id={`${id}-${side}-file`} type="file" accept=".json,application/json" onChange={event => void upload(side, event.target.files?.[0])} />
      {reports[side] && <p>Report loaded. Source claims remain browser-submitted, not independently authenticated.</p>}
    </div>)}</div>}
    {error && <p role="alert">{error}</p>}
    {stages.length > 0 && <ol className="change-progress" aria-live="polite">{['previous-rpc', 'previous-graph', 'current-rpc', 'current-graph'].map(key => {
      const stage = stages.find(item => item.id === key);
      return <li key={key}><strong>{key.replace('-', ' · ')}: {stage?.status ?? 'waiting'}</strong><p>{stage?.detail ?? 'Not requested yet.'}</p></li>;
    })}</ol>}
    {reports.current && reports.previous && <>
      <ChangeReport current={reports.current} previous={reports.previous} />
      <InvestigationAssistant report={reports.current} initialPrevious={reports.previous} token={token} />
    </>}
  </section>;
}

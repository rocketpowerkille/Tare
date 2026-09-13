import { AlertCircle, ArrowRight, FileSearch, LoaderCircle, Radio } from '../components/Icons';
import { useEffect, useState } from 'react';
import { AccessPanel } from '../components/explorer/AccessPanel';
import { ExamplePanel } from '../components/explorer/ExamplePanel';
import { OperationForm, type AnalyzeInput } from '../components/explorer/OperationForm';
import { ReplayPanel } from '../components/explorer/ReplayPanel';
import { ReportView } from '../components/explorer/ReportView';
import { ComprehensiveReportView } from '../components/explorer/ComprehensiveReportView';
import { api, ApiError } from '../lib/api';
import { runComprehensiveCheck } from '../lib/comprehensive';
import { initialStages, type EvidenceStage, type ProgressObserver } from '../lib/progress';
import { EvidenceTimeline } from '../components/explorer/EvidenceTimeline';
import { SessionEvidence } from '../components/explorer/SessionEvidence';
import type { AccessOptions, Capabilities, DiscoveryResult, JsonRecord, OperationId, PositionAnalyzeInput } from '../lib/types';

export function ExplorerPage() {
  const [token, setToken] = useState('');
  const [accessOptions, setAccessOptions] = useState<AccessOptions>();
  const [capabilities, setCapabilities] = useState<Capabilities>();
  const [authRequired, setAuthRequired] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<JsonRecord>();
  const [stages, setStages] = useState<EvidenceStage[]>([]);
  const [operation, setOperation] = useState<OperationId>('resolve-v1');
  const [activity, setActivity] = useState('Enter a wallet address to find supported vaults.');

  async function connect(nextToken: string) {
    setConnecting(true);
    setError('');
    try {
      const next = await api.capabilities(nextToken);
      setToken(nextToken);
      setCapabilities(next);
      setAuthRequired(false);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        setAuthRequired(true);
        if (nextToken) setError('That access code is invalid or expired. Paste a current code or start a new sandbox session.');
      }
      else setError(failure instanceof Error ? failure.message : 'The service could not be reached.');
    } finally { setConnecting(false); }
  }

  useEffect(() => {
    void api.accessOptions().then(setAccessOptions).catch(() => undefined);
    void connect('');
  }, []);
  useEffect(() => {
    const focusExamples = () => {
      if (window.location.hash === '#examples') document.getElementById('examples')?.focus();
    };
    focusExamples();
    window.addEventListener('popstate', focusExamples);
    return () => window.removeEventListener('popstate', focusExamples);
  }, [capabilities]);
  useEffect(() => {
    if (report && window.matchMedia('(max-width: 800px)').matches) document.getElementById('report-result')?.focus();
  }, [report]);

  async function run(label: string, task: (notify: ProgressObserver) => Promise<JsonRecord>, composed = false, replay = false) {
    if (busy) return;
    setBusy(true);
    setError('');
    setReport(undefined);
    setActivity(label);
    setStages(initialStages(composed, replay));
    let acceptingEvents = true;
    const notify: ProgressObserver = (id, status, detail) => {
      if (acceptingEvents) setStages(current => current.map(stage => stage.id === id
        ? { ...stage, status, detail, receivedAt: new Date().toISOString() } : stage));
    };
    try {
      const result = await task(notify);
      notify('authorization', 'complete', 'The server accepted this analysis request. Authorization does not verify asset backing.');
      notify('request', 'complete', replay ? 'Saved evidence was recalculated. This is not a fresh blockchain observation.' : 'The requested evidence response arrived. Review its findings and limitations.');
      notify('report', 'complete', 'Report generated with source data and explicit limitations. This is not a full-verification claim.');
      setReport(result);
      setActivity('Your result is ready. Start with the plain-language answer.');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) setAuthRequired(true);
      setError(failure instanceof Error ? failure.message : 'The request could not be completed.');
      setActivity('No result was produced.');
      setStages(current => current.map(stage => ['waiting', 'active'].includes(stage.status)
        ? { ...stage, status: 'unavailable', detail: 'Not completed. The request stopped; see the error details.' } : stage));
    } finally { acceptingEvents = false; setBusy(false); }
  }

  function analyze(input: AnalyzeInput) {
    const positionCheck = ['resolve-v1', 'resolve-v2', 'resolve-erc4626'].includes(input.operation)
      && input.owner !== undefined && input.vault !== undefined;
    void run('Running the position trace and eligible evidence checks.', notify => positionCheck && capabilities
      ? runComprehensiveCheck(token, capabilities, input as PositionAnalyzeInput, notify)
      : api.analyze(token, input), positionCheck);
  }

  function clearQueryResult() {
    setError('');
    setReport(undefined);
    setStages([]);
    setActivity('Enter a wallet address to find supported vaults.');
  }

  async function discover(owner: string): Promise<DiscoveryResult> {
    try {
      return await api.discover(token, owner);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) setAuthRequired(true);
      throw failure;
    }
  }

  if (connecting && !capabilities && !authRequired) return <div className="page-width skeleton-stack" role="status"><p>Connecting to the evidence service…</p><div className="skeleton" /><div className="skeleton short" /><div className="skeleton" /></div>;

  return <div className="explorer-page page-width">
    <header className="page-intro explorer-intro">
      <div><p className="kicker">Investigation workspace</p><h1>Start with a position.</h1><p className="lead">Trace its path. Inspect the evidence. Keep the unknowns in view.</p></div>
      <div className="service-state"><span className={capabilities ? 'network-dot' : 'network-dot offline'} /><div><strong>{capabilities ? 'Service ready' : 'Connection needed'}</strong><span>{capabilities ? `${Object.values(capabilities.live).filter(Boolean).length} live checks configured` : 'Connect to continue'}</span></div></div>
    </header>

    {authRequired && <AccessPanel options={accessOptions} onConnect={value => void connect(value)} error={error || undefined} />}
    {error && !authRequired && <div className="error-banner" role="alert"><AlertCircle size={20} /><div><strong>This check could not be completed.</strong><p>Review the input or try again. No new conclusion was produced.</p><details><summary>Technical details</summary><p>{error}</p></details>{!capabilities && <button className="button secondary" onClick={() => void connect(token)}>Retry connection</button>}</div></div>}

    {capabilities && <>
      {!authRequired && <SessionEvidence token={token} />}
      <div className="explorer-grid">
        <div className="control-stack">
          <OperationForm capabilities={capabilities} busy={busy} operation={operation} onOperationChange={setOperation} onQueryChange={clearQueryResult} onDiscover={discover} onRun={analyze} />
          <ExamplePanel examples={capabilities.examples} busy={busy} onRun={id => void run('Replaying saved evidence, with no live blockchain query.', () => api.example(token, id), false, true)} />
          <ReplayPanel operation={operation} busy={busy} onReplay={capture => void run('Recalculating the uploaded capture.', () => api.replay(token, operation, capture), false, true)} onError={setError} />
        </div>
        <section className="result-panel" id="report-result" tabIndex={-1} aria-label="Evidence result">
          <div className="activity-line" role="status" aria-live="polite">{busy ? <LoaderCircle className="spin" size={16} /> : <Radio size={16} />}<span>{activity}</span></div>
          <EvidenceTimeline stages={stages} busy={busy} />
          {report ? (report.reportType === 'comprehensive-position-check' ? <ComprehensiveReportView report={report} /> : <ReportView report={report} />) : busy ? <div className="skeleton-stack" aria-hidden="true"><div className="skeleton" /><div className="skeleton short" /><div className="skeleton" /></div> : <div className="result-empty"><div className="empty-symbol"><FileSearch size={31} /></div><p className="section-label">Your evidence report</p><h2>An answer you can inspect.</h2><p>Run a check to see the position path, observed amounts and missing evidence. Or begin with a saved report.</p><button className="text-button" type="button" onClick={() => document.getElementById('example')?.focus()}>Try a saved example <ArrowRight size={16} /></button></div>}
        </section>
      </div>
    </>}
  </div>;
}

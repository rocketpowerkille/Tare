import { AlertCircle, ArrowRight, FileSearch, LoaderCircle, Radio } from '../components/Icons';
import { useEffect, useState } from 'react';
import { AccessPanel } from '../components/explorer/AccessPanel';
import { ExamplePanel } from '../components/explorer/ExamplePanel';
import { OperationForm, type AnalyzeInput } from '../components/explorer/OperationForm';
import { ReplayPanel } from '../components/explorer/ReplayPanel';
import { ReportView } from '../components/explorer/ReportView';
import { api, ApiError } from '../lib/api';
import type { Capabilities, DiscoveryResult, JsonRecord, OperationId } from '../lib/types';

export function ExplorerPage() {
  const [token, setToken] = useState('');
  const [capabilities, setCapabilities] = useState<Capabilities>();
  const [authRequired, setAuthRequired] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<JsonRecord>();
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
      if (failure instanceof ApiError && failure.status === 401) setAuthRequired(true);
      else setError(failure instanceof Error ? failure.message : 'The service could not be reached.');
    } finally { setConnecting(false); }
  }

  useEffect(() => { void connect(''); }, []);

  async function run(label: string, task: () => Promise<JsonRecord>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setReport(undefined);
    setActivity(label);
    try {
      setReport(await task());
      setActivity('Your result is ready. Start with the plain-language answer.');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) setAuthRequired(true);
      setError(failure instanceof Error ? failure.message : 'The request could not be completed.');
      setActivity('No result was produced.');
    } finally { setBusy(false); }
  }

  function analyze(input: AnalyzeInput) {
    void run('Reading public evidence. Some live checks may take a few minutes.', () => api.analyze(token, input));
  }

  function clearQueryResult() {
    setError('');
    setReport(undefined);
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

  if (connecting && !capabilities && !authRequired) return <div className="page-width explorer-loading"><LoaderCircle className="spin" size={24} /><p>Checking the Tare service...</p></div>;

  return <div className="explorer-page page-width">
    <header className="page-intro explorer-intro">
      <div><p className="kicker">Position check</p><h1>Understand what is behind a vault position.</h1><p className="lead">Enter public addresses. Tare traces the supported position and explains what the evidence can and cannot prove.</p></div>
      <div className="service-state"><span className={capabilities ? 'network-dot' : 'network-dot offline'} /><div><strong>{capabilities ? 'Service ready' : 'Connection needed'}</strong><span>{capabilities ? `${Object.values(capabilities.live).filter(Boolean).length} live checks configured` : 'Connect to continue'}</span></div></div>
    </header>

    {authRequired && <AccessPanel onConnect={value => void connect(value)} error={error || undefined} />}
    {error && !authRequired && <div className="error-banner" role="alert"><AlertCircle size={20} /><div><strong>We could not complete that request.</strong><p>{error}</p></div></div>}

    {capabilities && <>
      <div className="explorer-grid">
        <div className="control-stack">
          <OperationForm capabilities={capabilities} busy={busy} operation={operation} onOperationChange={setOperation} onQueryChange={clearQueryResult} onDiscover={discover} onRun={analyze} />
          <ExamplePanel examples={capabilities.examples} busy={busy} onRun={id => void run('Replaying the saved evidence without a network request.', () => api.example(token, id))} />
          <ReplayPanel operation={operation} busy={busy} onReplay={capture => void run('Recalculating the uploaded capture.', () => api.replay(token, operation, capture))} onError={setError} />
        </div>
        <section className="result-panel" aria-label="Evidence result">
          <div className="activity-line" role="status" aria-live="polite">{busy ? <LoaderCircle className="spin" size={16} /> : <Radio size={16} />}<span>{activity}</span></div>
          {report ? <ReportView report={report} /> : <div className="result-empty"><div className="empty-symbol"><FileSearch size={31} /></div><h2>Your answer will appear here.</h2><p>Tare will explain what it found, what remains unknown, and what you should review next.</p><button className="text-button" type="button" onClick={() => document.getElementById('example')?.focus()}>Try a saved example <ArrowRight size={16} /></button></div>}
        </section>
      </div>
    </>}
  </div>;
}

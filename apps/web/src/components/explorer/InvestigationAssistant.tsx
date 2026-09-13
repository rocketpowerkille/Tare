import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { JsonRecord } from '../../lib/types';
import { record, text, list } from '../../lib/types';
import { ChangeReport } from './ChangeReport';

const questions = ['Explain my position', 'What remains unverified?', 'Why did these sources disagree?', 'What should I check next?'];

export function InvestigationAssistant({ report, token, initialPrevious }: { report: JsonRecord; token: string; initialPrevious?: JsonRecord }) {
  const prefix = useId();
  const [options, setOptions] = useState<JsonRecord>();
  const [question, setQuestion] = useState(initialPrevious ? 'What changed between these blocks? Cite the deterministic comparison and explain missing evidence without inventing causes.' : questions[0]!);
  const [previous, setPrevious] = useState<JsonRecord | undefined>(initialPrevious);
  const [snapshot, setSnapshot] = useState<JsonRecord>();
  const [run, setRun] = useState<JsonRecord>();
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const generation = useRef(0);
  const pending = useRef<{ requestId: string; reference: string; question: string } | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void api.investigationOptions(token).then(value => { if (active) setOptions(value); }).catch(() => { if (active) setError('Assistant availability could not be checked. Your report and copy-context option remain available.'); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    generation.current++;
    setSnapshot(undefined); setRun(undefined); setPrevious(initialPrevious); setError(''); setBusy(false);
    pending.current = undefined; lock.current = false;
    return () => { generation.current++; };
  }, [report, token, initialPrevious]);

  async function ask() {
    if (lock.current || !consent || !question.trim()) return;
    lock.current = true;
    setBusy(true); setError(''); setRun(undefined);
    const current = generation.current;
    try {
      const saved = snapshot ?? await api.investigationSnapshot(token, report, previous);
      if (current !== generation.current) return;
      setSnapshot(saved);
      const reference = String(saved.reference);
      const attempt = pending.current?.reference === reference && pending.current.question === question ? pending.current
        : { requestId: crypto.randomUUID(), reference, question };
      pending.current = attempt;
      let next = await api.investigationRun(token, { ...attempt, consent: true });
      if (current !== generation.current) return;
      setRun(next);
      const deadline = Date.now() + 135_000;
      while (next.status === 'running' && Date.now() < deadline) {
        await new Promise(resolve => window.setTimeout(resolve, 4000));
        if (current !== generation.current) return;
        next = await api.investigationRunStatus(token, String(next.id));
        if (current !== generation.current) return;
        setRun(next);
      }
      if (next.status === 'running') setError('Execution is still unresolved. Do not start another paid run. Check again using the same question.');
    } catch (failure) {
      if (current === generation.current) setError(failure instanceof Error ? failure.message : 'The assistant could not complete this request.');
    } finally {
      if (current === generation.current) { lock.current = false; setBusy(false); }
    }
  }

  async function upload(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1_048_576) throw new Error('Use a report JSON file under 1 MiB.');
      const value: unknown = JSON.parse(await file.text());
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Choose a Tare report JSON object, not a capture or another file.');
      const data = value as JsonRecord;
      if (!data.reportType && !data.protocol) throw new Error('This file does not identify a supported report.');
      setPrevious(data); setSnapshot(undefined); setRun(undefined); setQuestion('Compare this report with my previous report. Explain changes and comparability limits.');
      setError(''); pending.current = undefined;
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not read the report.'); }
  }

  const facts = list(snapshot?.facts).map(record);
  const sections = list(run?.sections).map(record);
  const factLink = (id: string) => `#${prefix}-${id}`;
  return <section className="investigation-assistant" aria-label="Ask about this report">
    <p className="section-label">Bazantic investigation assistant</p><h3>Ask about this report</h3>
    <p>Explain the evidence already on screen, including source gaps. A Recipe answer adds interpretation, not verification.</p>
    {options?.enabled !== true ? <p role="status">{options ? 'In-page Recipe execution is not enabled on this deployment. Copy context or use the external Recipe below.' : 'Checking assistant availability…'}</p> : <>
      <div className="assistant-presets">{questions.map(value => <button key={value} type="button" className="button quiet" disabled={busy} onClick={() => setQuestion(value)}>{value}</button>)}</div>
      <label htmlFor={`${prefix}-question`}>Your question</label>
      <textarea id={`${prefix}-question`} value={question} maxLength={1500} disabled={busy} onChange={event => setQuestion(event.target.value)} />
      <details><summary>Compare with a previous report</summary><p>Upload a report, not a capture. Tare compares matching position identities and exact facts; a difference is not proof of profit or loss.</p>
        <input aria-label="Previous report JSON" type="file" accept="application/json,.json" disabled={busy} onChange={event => void upload(event.target.files?.[0])} />
        {previous && <p>Previous report selected. It will be labeled separately from the current report. <button type="button" disabled={busy} onClick={() => { setPrevious(undefined); setSnapshot(undefined); setRun(undefined); pending.current = undefined; }}>Remove</button></p>}
        {previous && !initialPrevious && <ChangeReport current={report} previous={previous} />}
      </details>
      <label className="assistant-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />
        Send this report’s classified facts and my question to Bazantic. Do not include secrets. Temporary context expires after 10 minutes; Bazantic may retain execution data.</label>
      <p className="muted">Maximum authorized spend: 0 USDC. Payment challenges stop the request. Explorer authorization is separate from Recipe execution.</p>
      <button className="button primary" type="button" disabled={busy || !consent || !question.trim()} onClick={() => void ask()}>{busy ? 'Recipe running…' : 'Ask with Bazantic'}</button>
    </>}
    {error && <p role="alert">{error}</p>}
    {run && <div className="assistant-answer" aria-live="polite">
      <p className="section-label">{run.status === 'complete' ? 'AI explanation based on Tare evidence' : `Recipe: ${run.status}`}</p>
      {run.status === 'running' && <p>Waiting for the Recipe to read the pinned context and return its answer. This is not a new vault check.</p>}
      {text(run.warning) && <p className="source-caution">{text(run.warning)}</p>}
      {sections.map((section, index) => <section key={index}><h4>{text(section.title)}</h4><p className="assistant-prose">{text(section.text)}</p>
        <div className="assistant-citations">{list(section.citations).filter((id): id is string => typeof id === 'string').map(id => <a key={id} href={factLink(id)} onClick={() => { const element = document.getElementById(factLink(id).slice(1)); const details = element?.closest('details'); if (details) details.open = true; element?.focus(); }}>{id}</a>)}</div>
      </section>)}
      <details><summary>Recipe execution record</summary><p>Settlement and cost are not confirmed. This record is not a payment receipt or vault evidence.</p><pre tabIndex={0}>{JSON.stringify(run, null, 2)}</pre></details>
    </div>}
    {snapshot && <details className="assistant-facts"><summary>Inspect the exact facts sent to the Recipe</summary>
      <p>{text(snapshot.provenanceNotice)}</p><p>{text(snapshot.omissionNotice)}</p>
      {Boolean(snapshot.comparison) && <pre tabIndex={0}>{JSON.stringify(snapshot.comparison, null, 2)}</pre>}
      {facts.map(fact => <section id={`${prefix}-${fact.id}`} key={String(fact.id)} tabIndex={-1}><h4>{text(fact.id)} · {text(fact.field)}</h4><pre tabIndex={0}>{JSON.stringify(fact.value, null, 2)}</pre></section>)}
    </details>}
  </section>;
}

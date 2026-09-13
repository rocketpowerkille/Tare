import { useState } from 'react';
import { explanationContext, explanationPrompt } from '../../../../../packages/receipts/src/explanation';
import type { JsonRecord } from '../../lib/types';
import type { ReportAccess } from '../../lib/agent-handoff';
import { BazanticHandoff } from './BazanticHandoff';

export function ExplainReport({ report, modules, access }: { report: JsonRecord; modules: JsonRecord[]; access?: ReportAccess }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const evidence = modules.length ? {
    reportType: 'comprehensive-position-check',
    status: modules.some(module => module.status === 'mismatch') ? 'mismatch'
      : modules.some(module => module.eligible && ['incomplete', 'unavailable'].includes(String(module.status))) ? 'incomplete' : report.status ?? report.kind,
    primary: report, modules,
  } : report;
  const context = explanationContext(evidence);
  async function copy() {
    try {
      await navigator.clipboard.writeText(explanationPrompt(evidence));
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { setCopyError(true); }
  }
  return <details className="explain-report">
    <summary>Explain this report <span className="explanation-path-label">AI assistant or Bazantic Recipe</span></summary>
    <p>Tare has prepared evidence-grounded context for an AI explanation. Choose how you want to continue. No explanation has been generated here by Tare or Bazantic.</p>
    <p>This explanation summarizes the returned evidence. It does not add new verification.</p>
    {context.freshness === 'saved-evidence' && <p className="source-caution">This explanation is based on saved evidence, not a fresh blockchain check.</p>}
    <div className="explanation-status-grid">
      <section>
        <p className="section-label">Evidence source</p><strong>Tare evidence</strong>
        <p>{context.sourceMode}<br />{context.network} · Block: {context.observedBlock ?? 'Not included'}</p>
      </section>
      <section>
        <p className="section-label">Agent access</p><strong>Bazantic gateway + MCP</strong>
        <p>Public gateway documented. Availability not checked by this page.<br />Payment mode: Base Sepolia sandbox.</p>
      </section>
      <section>
        <p className="section-label">Current report access</p>
        <strong>{access?.authorization === 'bazantic-session' ? 'Bazantic session authorized this request' : access ? 'Direct Tare API' : 'Authorization not recorded'}</strong>
        <p>{access ? 'This report was generated through Tare’s direct API, not a Bazantic Recipe run.' : 'Request authorization was not recorded in this view.'}</p>
        {access?.authorization === 'bazantic-session' && <p>
          Authorization network: Base Sepolia sandbox.<br />
          Session: {access.sessionId ?? 'ID not included'}<br />
          Issued: {access.issuedAt ?? 'Not included'}<br />
          Expires: {access.expiresAt ?? 'Not included'}<br />
          Settlement receipt not included. Authorization is not vault evidence.
        </p>}
        {access?.authorization === 'unknown' && <p>Session verification details unavailable.</p>}
        {access?.authorization !== 'bazantic-session' && <p>Bazantic agent access is available as a separate workflow.</p>}
      </section>
    </div>
    <div className="explanation-modes">
      <section className="explanation-mode" aria-label="External AI assistant workflow">
        <p className="section-label">For users with an AI assistant</p><h3>Explain with an AI assistant</h3>
        <p>Copy the structured evidence into ChatGPT, Claude, Cursor or another assistant. This convenience path does not call Bazantic or an AI service.</p>
        <button className="button secondary" type="button" aria-label="Copy explanation context" onClick={() => void copy()}>
          <span role="status">{copied ? 'Copied explanation context' : 'Copy explanation context'}</span>
        </button>
        {copyError && <p role="alert">Clipboard unavailable. Select and copy the context below.</p>}
        <details className="context-inspector">
          <summary>Inspect explanation context</summary>
          <pre tabIndex={0} aria-label="Explanation context, scrollable text">{explanationPrompt(evidence)}</pre>
        </details>
      </section>
      <BazanticHandoff context={context} access={access} />
    </div>
  </details>;
}

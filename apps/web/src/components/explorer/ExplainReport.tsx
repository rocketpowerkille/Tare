import { useState } from 'react';
import { explanationContext, explanationPrompt } from '../../../../../packages/receipts/src/explanation';
import type { JsonRecord } from '../../lib/types';

export function ExplainReport({ report, modules }: { report: JsonRecord; modules: JsonRecord[] }) {
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
    <summary>Explain this report</summary>
    <h3>AI explanation based on Tare evidence</h3>
    <p>Copy this context into your AI assistant. Tare prepares structured facts and guidance; no AI service is called here.</p>
    <p>This explanation summarizes the returned evidence. It does not add new verification.</p>
    {context.freshness === 'saved-evidence' && <p className="source-caution">This explanation is based on saved evidence, not a fresh blockchain check.</p>}
    <button className="button secondary" type="button" aria-label="Copy explanation context" onClick={() => void copy()}><span role="status">{copied ? 'Copied explanation context' : 'Copy explanation context'}</span></button>
    {copyError && <p role="alert">Clipboard unavailable. Select and copy the context below.</p>}
    <details><summary>Inspect explanation context</summary><pre tabIndex={0} aria-label="Explanation context, scrollable text">{explanationPrompt(evidence)}</pre></details>
  </details>;
}

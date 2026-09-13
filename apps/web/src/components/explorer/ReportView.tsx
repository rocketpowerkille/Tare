import { AlertCircle, CheckCircle2, ChevronDown, Clock3, Download, FileJson, Radio, ShieldAlert } from '../Icons';
import { StatusBadge } from '../StatusBadge';
import { list, record, text, type JsonRecord } from '../../lib/types';
import { PositionOverview } from './PositionOverview';
import { CopyValue } from '../CopyValue';
import { PositionDiagram } from './PositionDiagram';
import { ValueConversion } from './ValueConversion';
import { EvidenceSources } from './EvidenceSources';
import { displayBlock } from '../../lib/report-display';
import { useId } from 'react';
import { ExplainReport } from './ExplainReport';
import type { ReportAccess } from '../../lib/agent-handoff';

function readable(value: string) {
  return value.replaceAll('-', ' ').replaceAll('_', ' ');
}

function address(value: unknown) {
  const full = text(value);
  return full && full.length > 18 ? `${full.slice(0, 8)}...${full.slice(-6)}` : full;
}

function verdict(status: string, sourceMode: string) {
  if (status === 'matched') return {
    title: 'The records agree for this check.',
    meaning: 'The compared evidence sources agreed within the scope of this check. Review the source records and their blocks before extending that conclusion.',
    next: 'You can use this as supporting evidence, but it does not prove that every borrower, collateral asset, or price is safe.',
    tone: 'success' as const, icon: CheckCircle2,
  };
  if (status === 'complete') return {
    title: 'Tare traced the supported position.',
    meaning: 'Tare followed the supported vault path and did not find a missing step in that trace.',
    next: 'Review the limits below before treating the result as proof of backing or safety.',
    tone: 'success' as const, icon: CheckCircle2,
  };
  if (status === 'mismatch') return {
    title: 'The records do not agree.',
    meaning: 'Two sources reported different values for the same check. The result should not be relied on until the difference is understood.',
    next: 'Review the failed checks below and retry later if a data source may be behind.',
    tone: 'danger' as const, icon: ShieldAlert,
  };
  if (status === 'partial' || status === 'incomplete') return {
    title: 'Tare could not verify the whole position.',
    meaning: 'Some required evidence was missing, unsupported, or could not be confirmed. Tare has kept the known facts without guessing the rest.',
    next: 'Treat this result as unfinished. Review the unknown items below before making a decision.',
    tone: 'warning' as const, icon: AlertCircle,
  };
  return {
    title: sourceMode.startsWith('recorded') ? 'The saved example was recalculated.' : 'The check finished.',
    meaning: sourceMode.startsWith('recorded') ? 'This result demonstrates how Tare works using saved evidence. It is not a fresh check of the blockchain.' : 'Tare completed the requested public-data check.',
    next: 'Review the evidence limits below before using the result.',
    tone: 'info' as const, icon: CheckCircle2,
  };
}

const reasonCopy: Record<string, string> = {
  'missing-independent-verification': 'Independent backing verification is not available for this result.',
  'missing-independent-backing-verification': 'Independent backing verification is not available for this result.',
  'missing-valuation': 'The primary backing calculation has no qualifying valuation. A separate market price does not remove this limit.',
  'recorded-evidence': 'This uses saved evidence rather than a fresh network check.',
  'incomplete-resolution': 'Part of the position could not be traced.',
  'source-unavailable': 'A required data source was unavailable.',
  'unsupported-debt': 'Debt is present in a form Tare does not yet evaluate.',
  'invalid-record': 'A source returned data that did not pass Tare\'s checks.',
  cycle: 'The position contains a circular path that Tare will not count as backing.',
};

function friendlyReason(value: unknown) {
  if (typeof value === 'string') return reasonCopy[value] ?? readable(value);
  const item = record(value);
  const code = text(item.code) ?? text(item.kind) ?? text(item.reason);
  const message = text(item.message) ?? text(item.detail) ?? text(item.description);
  return message ?? (code ? reasonCopy[code] ?? readable(code) : 'A technical evidence limit was reported. Open the full report for details.');
}

function download(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportView({ report, modules = [], access }: { report: JsonRecord; modules?: JsonRecord[]; access?: ReportAccess }) {
  const sectionId = useId();
  const capture = record(report.capture);
  const metric = record(report.metric);
  const block = displayBlock(report);
  const sourceMode = text(report.sourceMode) ?? 'unknown source';
  const status = text(report.status) ?? text(report.kind) ?? 'unknown';
  const reportType = text(report.reportType) ?? text(report.protocol) ?? 'Position evidence';
  const capturedAt = text(capture.capturedAt) ?? text(report.capturedAt);
  const chainId = capture.chainId ?? report.chainId;
  const network = chainId === 84532 ? 'Base Sepolia' : chainId === 8453 ? 'Base' : chainId === 42161 ? 'Arbitrum' : chainId === 1 ? 'Ethereum' : 'Network unavailable';
  const result = verdict(status, sourceMode);
  const VerdictIcon = result.icon;
  const findings = [...list(report.findings), ...list(report.limitations)];
  const metricReasons = [...list(metric.reasons), ...list(metric.blockers)];
  const view = record(report.view);
  const facts = [
    ['Network', network],
    ['Wallet', text(capture.owner) ?? text(report.owner)],
    ['Vault', text(capture.vault ?? record(capture.deployment).outerVault)],
    ['Observed at block', block],
    ['Capture timestamp', capturedAt],
    ['Evidence ID', text(report.captureDigest) ?? 'Not included in this report'],
    ['Evidence', sourceMode.startsWith('live') ? 'Fresh public data' : sourceMode.startsWith('recorded') ? 'Recorded evidence' : readable(sourceMode)],
  ].filter((item): item is [string, string] => item[1] !== undefined);
  const technicalFacts = [
    ['Report type', readable(reportType)],
    ['Source mode', readable(sourceMode)],
    ['Verification', text(report.verification) ? readable(text(report.verification)!) : undefined],
    ['Evidence ID', address(report.captureDigest)],
  ].filter((item): item is [string, string] => item[1] !== undefined);
  const uniqueReasons = [...findings, ...metricReasons]
    .filter((item, index, all) => all.findIndex(other => JSON.stringify(other) === JSON.stringify(item)) === index);

  return <article className="report-view">
    <header className="report-header">
      <div><p className="section-label">Evidence report</p><div className="report-meta"><StatusBadge tone={sourceMode.startsWith('live') ? 'success' : 'info'}>{sourceMode.startsWith('live') ? 'Fresh check' : 'Saved example'}</StatusBadge><span>{readable(reportType)}</span></div><h2>{result.title}</h2></div>
      <span className={`verdict-icon verdict-${result.tone}`}><VerdictIcon size={25} /></span>
    </header>
    <nav className="report-sections" aria-label="Report sections">{['Summary', 'Evidence path', ...(modules.length ? ['Source checks'] : []), 'Limitations', 'Raw JSON'].map(label => <a key={label} href={`#${sectionId}-${label.replaceAll(' ', '-')}`}>{label}</a>)}</nav>
    <section id={`${sectionId}-Summary`} className={`plain-summary summary-${result.tone}`}>
      <div><p className="section-label">Executive summary</p><p>{result.meaning}</p></div>
      <div><p className="section-label">What this report does not establish</p><p>{result.next}</p></div>
      {metric.kind !== 'available' && <div><StatusBadge tone="warning">Backing not established</StatusBadge><p>Position accounting and market prices are not independent proof of the assets behind this claim.</p></div>}
    </section>
    <dl className="fact-grid">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{['Wallet', 'Vault', 'Observed at block', 'Evidence ID'].includes(label) && value !== 'Not included in this report' ? <CopyValue value={value} label={label} /> : value}</dd></div>)}</dl>
    <ValueConversion report={report} modules={modules} />
    <ExplainReport report={report} modules={modules} access={access} />
    <PositionOverview report={report} />
    <div id={`${sectionId}-Evidence-path`}><PositionDiagram report={report} /></div>
    {modules.length > 0 && <div id={`${sectionId}-Source-checks`}><EvidenceSources report={report} modules={modules} /></div>}

    <section className="report-section metric-section">
      <div><p className="section-label">Measured result</p><h3>{metric.kind === 'available' ? formatMetric(metric) : 'No reliable backing measure yet'}</h3></div>
      <p>{metric.kind === 'available' ? 'This number covers only the assets and checks named in this report.' : 'Tare did not have enough independently verified evidence to calculate a safe backing measure.'}</p>
      {metricReasons.length > 0 && <div className="reason-list">{metricReasons.map((item, index) => <span key={`${String(item)}-${index}`}>{friendlyReason(item)}</span>)}</div>}
    </section>

    {Object.keys(view).length > 0 && <section className="report-section"><p className="section-label">Observed position</p><div className="position-grid">
      {Object.entries(view).filter(([, value]) => typeof value === 'string').map(([key, value]) => <div key={key}><span>{readable(key)}</span><strong title={String(value)}>{address(value)}</strong></div>)}
    </div></section>}

    <section className="report-section" id={`${sectionId}-Limitations`}>
      <div className="section-title-row"><div><p className="section-label">What remains unknown</p><h3>{uniqueReasons.length ? 'These limits matter' : 'No missing evidence was reported for this check'}</h3></div><ShieldAlert size={20} /></div>
      <ul className="finding-list">
        {uniqueReasons.map((item, index) => <li key={index}>{friendlyReason(item)}</li>)}
        {!uniqueReasons.length && <li>The supported checks completed without a reported evidence gap.</li>}
      </ul>
    </section>

    <details className="technical-details"><summary><span><FileJson size={18} />Technical details</span><ChevronDown size={18} /></summary><div className="technical-facts">{technicalFacts.map(([label, value]) => <div key={label}><span>{label}</span><strong title={value}>{value}</strong></div>)}</div></details>
    <details className="raw-report" id={`${sectionId}-Raw-JSON`}><summary><span><FileJson size={18} />Full JSON report</span><ChevronDown size={18} /></summary><pre>{JSON.stringify(report, null, 2)}</pre></details>
    <div className="report-actions"><button className="button secondary" type="button" onClick={() => download(report, 'tare-report.json')}><Download size={16} />Download report</button>{Object.keys(capture).length > 0 && <button className="button quiet" type="button" onClick={() => download(capture, 'tare-capture.json')}><Download size={16} />Download capture</button>}</div>
    <footer className="report-foot"><span><Radio size={15} />{sourceMode.startsWith('live') ? 'Requested from configured providers' : 'Recalculated without a network request'}</span>{capturedAt && <span><Clock3 size={15} />Captured {new Date(capturedAt).toLocaleString()}</span>}</footer>
  </article>;
}

function formatMetric(metric: JsonRecord) {
  const millionths = text(metric.multipleMillionths);
  if (millionths) return `${(Number(millionths) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })}x backing within the checked scope`;
  return 'A measured result is available';
}

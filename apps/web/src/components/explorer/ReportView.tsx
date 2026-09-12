import { AlertCircle, CheckCircle2, ChevronDown, Clock3, Download, FileJson, Radio, ShieldAlert } from '../Icons';
import { StatusBadge } from '../StatusBadge';
import { isRecord, list, record, text, type JsonRecord } from '../../lib/types';

function readable(value: string) {
  return value.replaceAll('-', ' ').replaceAll('_', ' ');
}

function address(value: unknown) {
  const full = text(value);
  return full && full.length > 18 ? `${full.slice(0, 8)}...${full.slice(-6)}` : full;
}

function blockFrom(capture: JsonRecord) {
  const direct = record(capture.block);
  if (Object.keys(direct).length) return direct;
  const rpc = record(capture.rpc);
  if (isRecord(rpc.block)) return rpc.block;
  const witness = list(capture.witnesses).find(isRecord);
  return witness ? record(record(witness.rpc).block) : {};
}

function verdict(status: string, sourceMode: string) {
  if (status === 'matched') return { title: 'The check matched within its stated scope.', tone: 'success' as const, icon: CheckCircle2 };
  if (status === 'complete') return { title: 'The supported position path was fully traced.', tone: 'success' as const, icon: CheckCircle2 };
  if (status === 'mismatch') return { title: 'The compared evidence does not match.', tone: 'danger' as const, icon: ShieldAlert };
  if (status === 'partial' || status === 'incomplete') return { title: 'The available evidence is incomplete.', tone: 'warning' as const, icon: AlertCircle };
  return { title: sourceMode.startsWith('recorded') ? 'The recorded evidence was replayed.' : 'The check completed.', tone: 'info' as const, icon: CheckCircle2 };
}

function download(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportView({ report }: { report: JsonRecord }) {
  const capture = record(report.capture);
  const metric = record(report.metric);
  const block = blockFrom(capture);
  const sourceMode = text(report.sourceMode) ?? 'unknown source';
  const status = text(report.status) ?? text(report.kind) ?? 'complete';
  const reportType = text(report.reportType) ?? text(report.protocol) ?? 'Evidence report';
  const capturedAt = text(capture.capturedAt);
  const chainId = capture.chainId ?? report.chainId;
  const network = chainId === 84532 ? 'Base Sepolia' : chainId === 1 ? 'Ethereum' : 'Network unavailable';
  const result = verdict(status, sourceMode);
  const VerdictIcon = result.icon;
  const findings = [...list(report.findings), ...list(report.limitations)];
  const metricReasons = [...list(metric.reasons), ...list(metric.blockers)];
  const view = record(report.view);
  const facts = [
    ['Network', network],
    ['Owner', address(capture.owner)],
    ['Vault', address(capture.vault ?? record(capture.deployment).outerVault)],
    ['Block', block.number ? BigInt(String(block.number)).toString() : undefined],
    ['Source', readable(sourceMode)],
    ['Verification', text(report.verification) ? readable(text(report.verification)!) : undefined],
    ['Evidence ID', address(report.captureDigest)],
  ].filter((item): item is [string, string] => item[1] !== undefined);

  return <article className="report-view">
    <header className="report-header">
      <div><div className="report-meta"><StatusBadge tone={sourceMode.startsWith('live') ? 'success' : 'info'}>{sourceMode.startsWith('live') ? 'Live evidence' : 'Recorded evidence'}</StatusBadge><span>{readable(reportType)}</span></div><h2>{result.title}</h2></div>
      <span className={`verdict-icon verdict-${result.tone}`}><VerdictIcon size={25} /></span>
    </header>
    <div className="fact-grid">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd title={String(value)}>{value}</dd></div>)}</div>

    <section className="report-section metric-section">
      <div><p className="section-label">Scoped result</p><h3>{metric.kind === 'available' ? formatMetric(metric) : 'No defensible metric is available'}</h3></div>
      <p>{metric.kind === 'available' ? 'The value applies only to the scope named in this report.' : 'Tare did not have enough verified evidence to calculate a safe value.'}</p>
      {metricReasons.length > 0 && <div className="reason-list">{metricReasons.map((item, index) => <span key={`${String(item)}-${index}`}>{readable(String(item))}</span>)}</div>}
    </section>

    {Object.keys(view).length > 0 && <section className="report-section"><p className="section-label">Observed position</p><div className="position-grid">
      {Object.entries(view).filter(([, value]) => typeof value === 'string').map(([key, value]) => <div key={key}><span>{readable(key)}</span><strong title={String(value)}>{address(value)}</strong></div>)}
    </div></section>}

    <section className="report-section">
      <div className="section-title-row"><div><p className="section-label">Evidence notes</p><h3>{findings.length || metricReasons.length ? 'Review these limits before using the result' : 'No findings within the reported scope'}</h3></div><ShieldAlert size={20} /></div>
      <ul className="finding-list">
        {[...findings, ...metricReasons].filter((item, index, all) => all.findIndex(other => JSON.stringify(other) === JSON.stringify(item)) === index).map((item, index) => <li key={index}>{typeof item === 'string' ? readable(item) : JSON.stringify(item)}</li>)}
        {!findings.length && !metricReasons.length && <li>The supported checks completed without a reported finding.</li>}
      </ul>
    </section>

    <details className="raw-report"><summary><span><FileJson size={18} />Full technical report</span><ChevronDown size={18} /></summary><pre>{JSON.stringify(report, null, 2)}</pre></details>
    <div className="report-actions"><button className="button secondary" type="button" onClick={() => download(report, 'tare-report.json')}><Download size={16} />Download report</button>{Object.keys(capture).length > 0 && <button className="button quiet" type="button" onClick={() => download(capture, 'tare-capture.json')}><Download size={16} />Download capture</button>}</div>
    <footer className="report-foot"><span><Radio size={15} />{sourceMode.startsWith('live') ? 'Requested from configured providers' : 'Recalculated without a network request'}</span>{capturedAt && <span><Clock3 size={15} />Captured {new Date(capturedAt).toLocaleString()}</span>}</footer>
  </article>;
}

function formatMetric(metric: JsonRecord) {
  const millionths = text(metric.multipleMillionths);
  if (millionths) return `${(Number(millionths) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })}x within scope`;
  return 'Metric available within scope';
}

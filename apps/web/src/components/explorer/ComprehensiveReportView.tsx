import { AlertCircle, CheckCircle2, ChevronDown, Download, FileJson, ShieldAlert } from '../Icons';
import { StatusBadge } from '../StatusBadge';
import { isRecord, list, record, text, type JsonRecord } from '../../lib/types';
import { ReportView } from './ReportView';

function readable(value: string) {
  return value.replaceAll('-', ' ').replaceAll('_', ' ');
}

function tone(status: string) {
  if (status === 'complete' || status === 'verified') return 'success' as const;
  if (status === 'mismatch') return 'danger' as const;
  if (status === 'incomplete' || status === 'unavailable') return 'warning' as const;
  return 'neutral' as const;
}

function decimal(raw: string, decimals: number) {
  const padded = raw.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals) || '0';
  const fraction = decimals ? padded.slice(-decimals).replace(/0+$/, '').slice(0, 4) : '';
  return fraction ? `${whole}.${fraction}` : whole;
}

function usdValue(module: JsonRecord) {
  if (module.id !== 'chainlink') return undefined;
  const report = record(module.report);
  const directValue = record(report.value);
  const nestedValue = record(report.rootClaim);
  const value = Object.keys(directValue).length ? directValue : nestedValue;
  const raw = text(value.valueRaw);
  const decimals = Number(value.decimals ?? record(report.price).decimals);
  return raw && Number.isInteger(decimals) ? `$${decimal(raw, decimals)}` : undefined;
}

function download(value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tare-comprehensive-report.json';
  link.click();
  URL.revokeObjectURL(url);
}

export function ComprehensiveReportView({ report }: { report: JsonRecord }) {
  const status = text(report.status) ?? 'incomplete';
  const modules = list(report.modules).filter(isRecord);
  const primary = record(report.primary);
  const successful = modules.filter(module => ['complete', 'verified'].includes(text(module.status) ?? '')).length;
  const VerdictIcon = status === 'complete' ? CheckCircle2 : status === 'mismatch' ? ShieldAlert : AlertCircle;

  return <div className="comprehensive-view">
    <header className="comprehensive-header">
      <div>
        <div className="report-meta"><StatusBadge tone={tone(status)}>Composed check</StatusBadge><span>Eligible evidence services</span></div>
        <h2>{status === 'complete' ? 'The available checks completed.' : status === 'mismatch' ? 'One evidence source disagreed.' : 'The position was checked with evidence gaps.'}</h2>
        <p>{successful} of {modules.length} modules completed or verified. Modules that do not apply are clearly marked and do not weaken the primary position result.</p>
      </div>
      <span className={`verdict-icon verdict-${tone(status)}`}><VerdictIcon size={25} /></span>
    </header>

    <section className="module-section">
      <div className="section-title-row"><div><p className="section-label">Evidence services</p><h3>What ran for this position</h3></div></div>
      <div className="module-grid">{modules.map(module => {
        const id = text(module.id) ?? 'module';
        const moduleStatus = text(module.status) ?? 'unavailable';
        const value = usdValue(module);
        return <article className="module-card" key={id}>
          <div className="module-card-head"><div><span>{text(module.partner) ?? 'Tare'}</span><h4>{text(module.name) ?? readable(id)}</h4></div><StatusBadge tone={tone(moduleStatus)}>{readable(moduleStatus)}</StatusBadge></div>
          <p>{text(module.summary)}</p>
          {value && <strong className="module-value">{value} estimated position value</strong>}
        </article>;
      })}</div>
    </section>

    <details className="partner-details"><summary><span><FileJson size={18} />Partner evidence details</span><ChevronDown size={18} /></summary>
      <div>{modules.filter(module => module.id !== 'position').map(module => <section key={String(module.id)}><h4>{text(module.partner) ?? text(module.name)}</h4><pre>{JSON.stringify(module.report ?? { status: module.status, summary: module.summary }, null, 2)}</pre></section>)}</div>
    </details>

    <div className="comprehensive-actions"><button className="button secondary" type="button" onClick={() => download(report)}><Download size={16} />Download combined report</button></div>
    <section className="primary-report"><div className="primary-report-heading"><p className="section-label">Primary evidence</p><h3>Position and exposure details</h3></div><ReportView report={primary} /></section>
  </div>;
}

import { Download } from '../Icons';
import { StatusBadge } from '../StatusBadge';
import { isRecord, list, record, text, type JsonRecord } from '../../lib/types';
import { ReportView } from './ReportView';
import type { ReportAccess } from '../../lib/agent-handoff';

function download(value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tare-comprehensive-report.json';
  link.click();
  URL.revokeObjectURL(url);
}

export function ComprehensiveReportView({ report, access }: { report: JsonRecord; access?: ReportAccess }) {
  const status = text(report.status) ?? 'incomplete';
  const modules = list(report.modules).filter(isRecord);
  return <div className="composed-report">
    <div className="composed-status">
      <StatusBadge tone={status === 'mismatch' ? 'danger' : status === 'complete' ? 'success' : 'warning'}>
        {status === 'mismatch' ? 'Source disagreement' : status === 'complete' ? 'Eligible checks completed' : 'Evidence gaps'}
      </StatusBadge>
      <span>Combined position and source report. Completion is not proof of backing.</span>
    </div>
    <ReportView report={record(report.primary)} modules={modules} access={access} />
    <div className="combined-download"><button className="button secondary" type="button" onClick={() => download(report)}><Download size={16} />Download combined report</button><p>Includes the primary position, source responses, statuses and limitations.</p></div>
  </div>;
}

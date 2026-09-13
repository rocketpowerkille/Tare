import { Check, Clock3, LoaderCircle, AlertCircle } from '../Icons';
import type { EvidenceStage } from '../../lib/progress';

export function EvidenceTimeline({ stages, busy }: { stages: EvidenceStage[]; busy: boolean }) {
  if (!stages.length) return null;
  const latest = [...stages].filter(stage => stage.receivedAt).sort((a, b) => b.receivedAt!.localeCompare(a.receivedAt!))[0];
  return <details className="evidence-timeline" open={busy || undefined}>
    <summary>Trace → Check → Explain <span>{busy ? 'Check in progress' : 'Request timeline'}</span></summary>
    <p className="timeline-note">Updates reflect actual request events. The API returns tracing steps together, not as a live stream.</p>
    <span className="sr-only" role="status">{latest ? `${latest.title}: ${latest.status}. ${latest.detail}` : 'Waiting for evidence responses.'}</span>
    <ol>{stages.map(stage => <li key={stage.id} className={`stage stage-${stage.status}`}>
      <span className="stage-icon" aria-hidden="true">{stage.status === 'active' ? <LoaderCircle className="spin" size={15} /> : stage.status === 'complete' ? <Check size={15} /> : ['warning', 'error'].includes(stage.status) ? <AlertCircle size={15} /> : <Clock3 size={15} />}</span>
      <div><div className="stage-heading"><strong>{stage.title}</strong><span>{stage.status}</span></div><p>{stage.detail}</p>{stage.receivedAt && <small>Response event · {new Date(stage.receivedAt).toLocaleTimeString()}</small>}</div>
    </li>)}</ol>
  </details>;
}

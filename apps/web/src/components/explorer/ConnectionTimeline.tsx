import type { StageStatus } from '../../lib/progress';

export function ConnectionTimeline({ optionsState, sessionState, ready }: {
  optionsState: StageStatus;
  sessionState: StageStatus;
  ready: boolean;
}) {
  const steps = [
    { title: 'Checking gateway availability', status: optionsState, detail: optionsState === 'unavailable' ? 'Access configuration unavailable. An existing code can still be validated with Tare.' : 'Reads Tare’s access configuration. This does not test payment settlement or the Bazantic gateway’s health.' },
    { title: 'Preparing the investigation workspace', status: ready ? 'complete' : 'waiting', detail: ready ? 'Supported checks and examples received from Tare.' : 'Waiting for the service to return the available checks.' },
    { title: 'Validating the access session', status: sessionState, detail: sessionState === 'complete' ? 'The service accepted this request. A credential is required only on protected deployments.' : sessionState === 'waiting' ? 'Paste an access code to continue.' : sessionState === 'error' ? 'Access could not be confirmed. Review the error details below.' : 'Checking access with the Tare API.' },
  ];
  return <details className="connection-timeline" aria-label="Connection progress" open={sessionState === 'active' || sessionState === 'error'}>
    <summary>Connection status <span>{sessionState === 'waiting' ? 'Access code needed' : sessionState === 'error' ? 'Connection needs attention' : 'Checking service access'}</span></summary>
    <ol>{steps.map(step => <li key={step.title} className={`stage-${step.status}`}><strong>{step.title}</strong><span>{step.status}</span><p>{step.detail}</p></li>)}</ol>
  </details>;
}

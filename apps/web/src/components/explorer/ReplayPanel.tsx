import { Upload } from 'lucide-react';
import type { OperationId } from '../../lib/types';

export function ReplayPanel({ operation, busy, onReplay, onError }: { operation: OperationId; busy: boolean; onReplay: (capture: unknown) => void; onError: (message: string) => void }) {
  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { onError('Capture exceeds the 5 MiB limit.'); return; }
    try { onReplay(JSON.parse(await file.text()) as unknown); }
    catch { onError('Choose a valid JSON capture file.'); }
  }
  return <section className="secondary-panel replay-panel">
    <div className="secondary-panel-heading"><Upload size={20} /><div><h2>Replay your own capture</h2><p>Select a compatible JSON capture for <code>{operation}</code>.</p></div></div>
    <label className={busy ? 'file-button disabled' : 'file-button'}>
      <Upload size={16} />Choose capture
      <input type="file" accept="application/json,.json" disabled={busy} onChange={event => void choose(event)} />
    </label>
  </section>;
}

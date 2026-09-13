import { useEffect, useState } from 'react';
import { Copy, Check } from './Icons';

export function CopyValue({ value, label = 'value' }: { value: string; label?: string }) {
  const [status, setStatus] = useState('');
  useEffect(() => setStatus(''), [value]);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setStatus('Copied'); }
    catch { setStatus('Select text to copy'); }
  }
  return <span className="copy-value"><code>{value}</code><button className="copy-button" type="button" aria-label={`Copy ${label}`} title={`Copy ${label}`} onClick={() => void copy()}>{status === 'Copied' ? <Check size={13} /> : <Copy size={13} />}<span role="status">{status}</span></button></span>;
}

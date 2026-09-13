import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { list, record, text, type JsonRecord } from '../../lib/types';
import { InvestigationAssistant } from './InvestigationAssistant';

export function WalletInvestigation({ token, disabled }: { token: string; disabled: boolean }) {
  const [owner, setOwner] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<JsonRecord>();
  const [error, setError] = useState('');
  const lock = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++; setResult(undefined); setError(''); setBusy(false); lock.current = false;
    return () => { generation.current++; };
  }, [token]);
  async function investigate() {
    if (lock.current || !/^0x[0-9a-fA-F]{40}$/.test(owner)) return;
    lock.current = true; setBusy(true); setError(''); setResult(undefined);
    const current = generation.current;
    try { const value = await api.investigateWallet(token, owner); if (current === generation.current) setResult(value); }
    catch (failure) { if (current === generation.current) setError(failure instanceof Error ? failure.message : 'Wallet investigation was unavailable.'); }
    finally { if (current === generation.current) { lock.current = false; setBusy(false); } }
  }
  return <details className="wallet-investigation investigation-assistant"><summary>Investigate a wallet across supported vaults</summary>
    <p>Discover up to 10 candidates and check at most 3 supported positions, plus eligible Graph and Chainlink evidence. This makes new read-only requests. You can then ask Bazantic to explain the results.</p>
    <label htmlFor="investigation-wallet">Public wallet address</label>
    <input id="investigation-wallet" placeholder="0x…" value={owner} disabled={busy || disabled} onChange={event => { setOwner(event.target.value.trim()); setResult(undefined); }} />
    <button className="button secondary" type="button" disabled={disabled || busy || !/^0x[0-9a-fA-F]{40}$/.test(owner)} onClick={() => void investigate()}>{busy ? 'Discovering and checking supported positions…' : 'Investigate wallet'}</button>
    {error && <p role="alert">{error}</p>}
    {result && <div><p className="source-caution">This is a bounded investigation, not a complete wallet inventory or proof of backing.</p>
      {list(result.results).length === 0 && <p>No analyzable position was returned within discovery coverage. This does not mean the wallet has no assets.</p>}
      {list(result.results).map(record).map((item, index) => <p key={index}>{text(item.vault)} · {text(item.status)}{text(item.reason) ? ` · ${text(item.reason)}` : ''}</p>)}
      <InvestigationAssistant report={result} token={token} />
      <details><summary>Full wallet investigation JSON</summary><pre tabIndex={0}>{JSON.stringify(result, null, 2)}</pre></details>
    </div>}
  </details>;
}

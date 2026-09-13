import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { list, record, text, type JsonRecord } from '../../lib/types';
import { InvestigationAssistant } from './InvestigationAssistant';
import { ExposureOverlap } from './ExposureOverlap';

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
    if (disabled || lock.current || !/^0x[0-9a-fA-F]{40}$/.test(owner)) return;
    lock.current = true; setBusy(true); setError(''); setResult(undefined);
    const current = generation.current;
    try { const value = await api.investigateWallet(token, owner); if (current === generation.current) setResult(value); }
    catch (failure) { if (current === generation.current) setError(failure instanceof Error ? failure.message : 'Wallet investigation was unavailable.'); }
    finally { if (current === generation.current) { lock.current = false; setBusy(false); } }
  }
  return <section className="wallet-investigation investigation-assistant" aria-labelledby="wallet-investigation-title">
    <p className="section-label">Across supported vaults · Read-only</p>
    <h2 id="wallet-investigation-title">Start with a wallet.</h2>
    <p>See supported positions together and uncover the markets, collateral and oracles they share.</p>
    <div className="wallet-investigation-start">
      <form onSubmit={event => { event.preventDefault(); void investigate(); }}>
        <label htmlFor="investigation-wallet">Public wallet address</label>
        <input id="investigation-wallet" placeholder="0x…" value={owner} disabled={busy || disabled} aria-describedby="wallet-investigation-hint" onChange={event => { setOwner(event.target.value.trim()); setResult(undefined); }} />
        <p id="wallet-investigation-hint">Only a public address is needed. Your wallet stays disconnected.</p>
        <button className="button primary" type="submit" disabled={disabled || busy || !/^0x[0-9a-fA-F]{40}$/.test(owner)}>{busy ? 'Discovering and checking supported positions…' : 'Investigate wallet'}</button>
      </form>
      <aside className="investigation-preview" aria-label="What this investigation checks">
        <h3>What you’ll get</h3>
        <ol>
          <li><strong>Find positions</strong><span>Discover up to 10 candidates; check at most 3 supported positions.</span></li>
          <li><strong>Inspect shared exposure</strong><span>Compare dependencies with eligible Graph and Chainlink evidence.</span></li>
          <li><strong>Ask about the findings</strong><span>Use Bazantic to explain the returned evidence after your consent.</span></li>
        </ol>
      </aside>
    </div>
    {error && <p role="alert">{error}</p>}
    {result && <div><p className="source-caution">This is a bounded investigation, not a complete wallet inventory or proof of backing.</p>
      {list(result.results).length === 0 && <p>No analyzable position was returned within discovery coverage. This does not mean the wallet has no assets.</p>}
      {list(result.results).map(record).map((item, index) => <p key={index}>{text(item.vault)} · {text(item.status)}{text(item.reason) ? ` · ${text(item.reason)}` : ''}</p>)}
      <ExposureOverlap report={result} />
      <InvestigationAssistant report={result} token={token} />
      <details><summary>Full wallet investigation JSON</summary><pre tabIndex={0}>{JSON.stringify(result, null, 2)}</pre></details>
    </div>}
  </section>;
}

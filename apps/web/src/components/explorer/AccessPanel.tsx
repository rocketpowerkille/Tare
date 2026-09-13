import { KeyRound, LockKeyhole } from '../Icons';
import { useState } from 'react';
import type { AccessOptions } from '../../lib/types';
import { BazanticAccessGuide } from '../BazanticAccessGuide';

export function AccessPanel({ options, onConnect, error, connecting = false }: {
  options?: AccessOptions;
  onConnect: (token: string) => void;
  error?: string;
  connecting?: boolean;
}) {
  const [token, setToken] = useState('');
  return <section className="access-panel" aria-labelledby="access-title">
    <div className="panel-icon"><LockKeyhole size={22} /></div>
    <div className="access-copy"><p className="section-label">Investigation access</p><h2 id="access-title">{options?.bazanticSandbox ? 'Testnet access required' : 'Access code required'}</h2><p>Tare uses a short-lived Bazantic session to authorize this analysis. No wallet connection or private key is required.</p><p>A configured Tare access code also works. Your credential stays in this tab.</p></div>
    <div className="access-methods">
      <form onSubmit={event => { event.preventDefault(); if (!token.trim() || connecting) return; onConnect(token.trim()); setToken(''); }}>
        <h3>Paste access code</h3>
        <label htmlFor="access-token">Access code or sandbox session</label>
        <div className="access-form-row"><div className="input-with-icon"><KeyRound size={17} /><input id="access-token" type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" spellCheck={false} disabled={connecting} aria-invalid={Boolean(error)} aria-describedby="access-help" required placeholder="Paste code or session token" /></div><button className="button primary" type="submit" disabled={connecting || !token.trim()}>{connecting ? 'Validating session…' : 'Connect'}</button></div>
        {error && <div className="field-error" role="alert"><p>Access could not be confirmed. Check your code or obtain a new session.</p><details><summary>Technical details</summary><p>{error}</p></details></div>}
        <p id="access-help" className="access-privacy">Paste only the access code, not the full JSON response. Never paste a wallet key or seed phrase.</p>
        <p className="access-privacy">The value stays in this browser tab and is cleared when you reload.</p>
      </form>
      {options?.bazanticSandbox && <details className="sandbox-access developer-access">
        <summary>Developer / testnet access <span>Set up Bazantic</span></summary>
        <BazanticAccessGuide gatewayUrl={options.bazanticSandbox.gatewayUrl} sessionPath={options.bazanticSandbox.sessionPath} />
      </details>}
    </div>
  </section>;
}

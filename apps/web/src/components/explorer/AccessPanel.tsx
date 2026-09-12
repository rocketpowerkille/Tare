import { KeyRound, LockKeyhole } from '../Icons';
import { useState } from 'react';
import type { AccessOptions } from '../../lib/types';
import { BazanticAccessGuide } from '../BazanticAccessGuide';

export function AccessPanel({ options, onConnect, error }: {
  options?: AccessOptions;
  onConnect: (token: string) => void;
  error?: string;
}) {
  const [token, setToken] = useState('');
  return <section className="access-panel" aria-labelledby="access-title">
    <div className="panel-icon"><LockKeyhole size={22} /></div>
    <div className="access-copy"><h2 id="access-title">Choose how to access Tare</h2><p>Use an existing access code, or start a short testnet session through Bazantic.</p></div>
    <div className="access-methods">
      {options?.bazanticSandbox && <div className="sandbox-access">
        <BazanticAccessGuide
          gatewayUrl={options.bazanticSandbox.gatewayUrl}
          sessionPath={options.bazanticSandbox.sessionPath}
        />
      </div>}
      <form onSubmit={event => { event.preventDefault(); onConnect(token.trim()); setToken(''); }}>
        <label htmlFor="access-token">Access code or sandbox session</label>
        <div className="access-form-row"><div className="input-with-icon"><KeyRound size={17} /><input id="access-token" type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" required placeholder="Paste code or session token" /></div><button className="button primary" type="submit">Connect</button></div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <p className="access-privacy">The value stays in this browser tab and is cleared when you reload.</p>
      </form>
    </div>
  </section>;
}

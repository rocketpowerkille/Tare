import { KeyRound, LockKeyhole } from '../Icons';
import { useState } from 'react';

export function AccessPanel({ onConnect, error }: { onConnect: (token: string) => void; error?: string }) {
  const [token, setToken] = useState('');
  return <section className="access-panel" aria-labelledby="access-title">
    <div className="panel-icon"><LockKeyhole size={22} /></div>
    <div className="access-copy"><h2 id="access-title">Enter your Tare access code</h2><p>Tare is currently in private beta. Your code stays in this browser tab and is cleared when you reload.</p></div>
    <form onSubmit={event => { event.preventDefault(); onConnect(token.trim()); setToken(''); }}>
      <label htmlFor="access-token">Access code</label>
      <div className="input-with-icon"><KeyRound size={17} /><input id="access-token" type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" required placeholder="Paste access code" /></div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="button primary" type="submit">Connect</button>
    </form>
  </section>;
}

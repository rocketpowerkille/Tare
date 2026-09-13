import { useState } from 'react';
import { Check, Copy, ExternalLink } from './Icons';
import {
  BAZANTIC_CLI_DOCS,
  BAZANTIC_GRANT_DOCS,
  BAZANTIC_PRICE_USDC,
  CIRCLE_TESTNET_FAUCET,
  bazanticGrantCommand,
  bazanticSessionCommand,
  bazanticSessionUrl,
} from '../lib/bazantic';

export function BazanticAccessGuide({ gatewayUrl, sessionPath }: {
  gatewayUrl: string;
  sessionPath: string;
}) {
  const grantCommand = bazanticGrantCommand();
  const sessionCommand = bazanticSessionCommand(gatewayUrl, sessionPath);
  const endpoint = bazanticSessionUrl(gatewayUrl, sessionPath);
  const [completed, setCompleted] = useState<number[]>([]);
  const stepNames = ['Prepare Bazantic', 'Create grant', 'Call gateway', 'Paste access code'];
  const current = stepNames.findIndex((_, index) => !completed.includes(index));

  return <div className="bazantic-guide">
    <div>
      <span className="testnet-label">Base Sepolia testnet</span>
      <h3>Get a 15-minute access code</h3>
    </div>
    <p>Use the public Tare gateway with the Bazantic command line tool. Bazantic Playground only lists gateways owned by your account.</p>
    <p className="setup-note">Mark steps as you finish them. This checklist is your progress, not server-verified payment evidence.</p>
    <ol className="access-tracker">{stepNames.map((name, index) => <li key={name} aria-current={index === current ? 'step' : undefined} className={completed.includes(index) ? 'done' : ''}><label><input type="checkbox" checked={completed.includes(index)} onChange={event => setCompleted(previous => event.target.checked ? [...previous, index] : previous.filter(step => step !== index))} /><span>{index + 1}. {name}</span></label></li>)}</ol>
    <ol className="bazantic-steps">
      <li><span>1</span><div><strong>Prepare Bazantic</strong><p>Install <code>@bazantic/cli</code>, sign in, and fund your Bazantic receiving address with Base Sepolia test USDC.</p></div></li>
      <li><span>2</span><div><strong>Create a testnet grant</strong><CopyCommand command={grantCommand} label="Copy grant command" /></div></li>
      <li><span>3</span><div><strong>Call the public Tare gateway</strong><CopyCommand command={sessionCommand} label="Copy paid call" /></div></li>
      <li><span>4</span><div><strong>Paste the returned code</strong><p>Copy <code>body.accessToken</code> from the response into the access-code field. The session costs {BAZANTIC_PRICE_USDC} test USDC.</p></div></li>
    </ol>
    <div className="bazantic-endpoint"><span>Public paid endpoint</span><code>{endpoint}</code></div>
    <div className="bazantic-guide-links">
      <a href={CIRCLE_TESTNET_FAUCET} target="_blank" rel="noreferrer">Circle testnet faucet <ExternalLink size={14} /></a>
      <a href={BAZANTIC_GRANT_DOCS} target="_blank" rel="noreferrer">Grant setup <ExternalLink size={14} /></a>
      <a href={BAZANTIC_CLI_DOCS} target="_blank" rel="noreferrer">Bazantic CLI guide <ExternalLink size={14} /></a>
    </div>
    <p className="sandbox-note">This payment uses test USDC. Tare never asks for your wallet key or seed phrase.</p>
  </div>;
}

function CopyCommand({ command, label }: { command: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setError(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { setError(true); }
  }

  return <div className="copy-command">
    <code>{command}</code>
    <button type="button" onClick={() => void copy()} aria-label={label}>
      {copied ? <Check size={15} /> : <Copy size={15} />}
      <span role="status">{copied ? 'Copied' : label}</span>
    </button>
    {error && <p role="alert">Clipboard unavailable. Select and copy the command manually.</p>}
  </div>;
}

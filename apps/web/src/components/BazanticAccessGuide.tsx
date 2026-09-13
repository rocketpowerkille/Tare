import { useState } from 'react';
import { Check, Copy, ExternalLink } from './Icons';
import {
  BAZANTIC_CLI_DOCS,
  BAZANTIC_GRANT_DOCS,
  BAZANTIC_PRICE_USDC,
  CIRCLE_TESTNET_FAUCET,
  TERMINALS,
  type Terminal,
  bazanticGrantCommand,
  bazanticSessionCommand,
  bazanticSessionUrl,
  bazanticTokenCommand,
} from '../lib/bazantic';

export function BazanticAccessGuide({ gatewayUrl, sessionPath }: {
  gatewayUrl: string;
  sessionPath: string;
}) {
  const [terminal, setTerminal] = useState<Terminal>('powershell');
  const grantCommand = bazanticGrantCommand();
  const sessionCommand = bazanticSessionCommand(gatewayUrl, sessionPath, terminal);
  const endpoint = bazanticSessionUrl(gatewayUrl, sessionPath);

  return <div className="bazantic-guide">
    <div>
      <span className="testnet-label">Base Sepolia testnet</span>
      <h3>Get a 15-minute access code</h3>
    </div>
    <p>Use the public Tare gateway with the Bazantic command line tool. Bazantic Playground only lists gateways owned by your account.</p>
    <ol className="bazantic-steps">
      <li><span>1</span><div>
        <strong>Prepare Bazantic</strong>
        <p>Run this in your terminal to install or update the Bazantic CLI. Node.js and npm are required.</p>
        <CopyCommand command="npm i -g @bazantic/cli@latest" label="Copy install command" />
        <p>Then sign in through your browser:</p>
        <CopyCommand command="baz login" label="Copy login command" />
        <p>Fund your Bazantic receiving address with Base Sepolia test USDC.</p>
      </div></li>
      <li><span>2</span><div><strong>Create a testnet grant</strong><CopyCommand command={grantCommand} label="Copy grant command" /></div></li>
      <li><span>3</span><div>
        <strong>Call the public Tare gateway</strong>
        <div className="terminal-selector" role="group" aria-label="Choose your terminal">
          {TERMINALS.map(option => <button
            key={option.id}
            type="button"
            aria-pressed={terminal === option.id}
            onClick={() => setTerminal(option.id)}
          >{option.label}</button>)}
        </div>
        <CopyCommand key={terminal} command={sessionCommand} label="Copy paid call" />
        <p>Copy the whole command; keep each continuation character at the end of its line.</p>
        <details>
          <summary>Git Bash: print only the access code</summary>
          <p>Use this instead of the command above. It makes one session request and uses Node.js to print only your code in the terminal. It does not use your clipboard. Running either command again requests another paid session.</p>
          <CopyCommand command={bazanticTokenCommand(gatewayUrl, sessionPath)} label="Copy token-only command" />
        </details>
      </div></li>
      <li><span>4</span><div>
        <strong>Paste the returned code</strong>
        <p>Copy <code>body.accessToken</code> from the JSON response, or the single code printed by the Git Bash option. Paste the entire code without quotation marks into the access-code field. The session costs {BAZANTIC_PRICE_USDC} test USDC.</p>
        <div className="access-token-example">
          <span>Example format only, not a working access code</span>
          <code onCopy={event => event.preventDefault()}>tare_sandbox_v1.[session data].[signature]</code>
        </div>
        <p>Your real code is longer. Keep it private and copy all of it, not this example.</p>
      </div></li>
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

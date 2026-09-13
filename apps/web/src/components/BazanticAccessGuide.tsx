import { useState } from 'react';
import { Check, Copy, ExternalLink } from './Icons';
import {
  BAZANTIC_CLI_DOCS,
  BAZANTIC_GRANT_DOCS,
  BAZANTIC_PRICE_USDC,
  CIRCLE_TESTNET_FAUCET,
  bazanticGrantCommand,
  bazanticSessionUrl,
  bazanticTokenCommand,
} from '../lib/bazantic';

export function BazanticAccessGuide({ gatewayUrl, sessionPath }: {
  gatewayUrl: string;
  sessionPath: string;
}) {
  const grantCommand = bazanticGrantCommand();
  const sessionCommand = bazanticTokenCommand(gatewayUrl, sessionPath);
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
      <li><span>2</span><div>
        <strong>Create a testnet grant</strong><CopyCommand command={grantCommand} label="Copy grant command" />
        <p><code>--cap 0.01</code> is the grant's total spending limit, not a deposit or a per-call price. At {BAZANTIC_PRICE_USDC} test USDC per session, an unused grant covers at most 10 session purchases if the price stays the same and no other calls consume its budget. Previous spending can leave fewer.</p>
        <p>One access code can authorize multiple analyses until it expires, subject to API limits—not just one check. Reuse your current code rather than purchasing one for every analysis. The default session lasts 15 minutes; refreshing does not extend it.</p>
        <p>If <code>tare-demo</code> already exists, choose a new grant name and use that same name in <code>--account</code>. A new grant still needs an available test USDC balance; it does not provide funds.</p>
      </div></li>
      <li><span>3</span><div>
        <strong>Get your access code</strong>
        <p>Run in Git Bash on Windows, or a Bash / Zsh terminal on macOS or Linux—not PowerShell or Command Prompt. This makes one session request and uses Node.js to print only your access code.</p>
        <CopyCommand command={sessionCommand} label="Copy token-only command" />
        <p>Copy the whole command; keep each backslash at the end of its line. Running it approves a request capped at {BAZANTIC_PRICE_USDC} test USDC. Running it again requests another paid session. It does not use a clipboard utility.</p>
      </div></li>
      <li><span>4</span><div>
        <strong>Paste the returned code</strong>
        <p>Copy the single code printed in your terminal and paste it into the access-code field, without quotation marks. The session costs {BAZANTIC_PRICE_USDC} test USDC. If the command reports “No access code returned,” resolve the error first—do not paste the error as a code.</p>
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

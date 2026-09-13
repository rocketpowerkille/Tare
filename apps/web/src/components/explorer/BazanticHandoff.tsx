import { useState } from 'react';
import { BAZANTIC_GATEWAY_URL, BAZANTIC_CLI_DOCS } from '../../lib/bazantic';
import { agentHandoff, EXPLANATION_RECIPE, RECIPE_TOOLS, BAZANTIC_RECIPE_URL, RECIPE_SPEC_URL } from '../../lib/agent-handoff';
import type { HandoffContext, ReportAccess } from '../../lib/agent-handoff';

export function BazanticHandoff({ context, access }: { context: HandoffContext; access?: ReportAccess }) {
  const handoff = agentHandoff(context, access);
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState(false);
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return <section className="explanation-mode bazantic-mode" aria-label="Bazantic agent workflow">
    <p className="section-label">For agents and developers</p>
    <h3>Use Tare through Bazantic</h3>
    <p>The gateway exposes Tare's tools. The Recipe guides an external agent to retrieve evidence and explain its limits. This is separate from copying context.</p>
    <p><strong>{EXPLANATION_RECIPE}</strong><br /><span className="recipe-state">Published Recipe</span></p>
    <a className="button secondary" href={BAZANTIC_RECIPE_URL} target="_blank" rel="noreferrer">Open Bazantic Recipe</a>
    <details className="bazantic-demo">
      <summary>Try this report with the Bazantic Recipe</summary>
      <p>Open the published Recipe using the button above, then use the task below. Opening the link does not run the Recipe or authorize a payment from Tare.</p>
      <div className="handoff-links"><a href={RECIPE_SPEC_URL} target="_blank" rel="noreferrer">Recipe specification</a><a href="/developers">View MCP/API details</a></div>
      <h4>Task for this report</h4>
      <pre tabIndex={0} aria-label="Bazantic task text">{handoff.task}</pre>
      <button type="button" className="button secondary" onClick={() => void copy(handoff.task, 'task')}>Copy Bazantic task</button>
      <dl className="handoff-facts">
        <div><dt>Gateway</dt><dd>Tare <a href={BAZANTIC_GATEWAY_URL} target="_blank" rel="noreferrer">{BAZANTIC_GATEWAY_URL}</a></dd></div>
        <div><dt>Agent tools in the Recipe</dt><dd>{RECIPE_TOOLS.map(tool => <code key={tool}>{tool}</code>)}</dd></div>
      </dl>
      <p><strong>Expected answer:</strong> Short answer; observations; derived values; source checks; supported conclusions; unknowns; technical provenance. No confidence score.</p>
      <h4>{handoff.commandPurpose}</h4>
      <p>This CLI command returns evidence, not a Recipe-generated explanation. Attach the Recipe in your agent separately. {handoff.replaySupported ? '' : 'It does not rerun this report.'}</p>
      <pre tabIndex={0} aria-label="Bazantic gateway command">{handoff.command}</pre>
      <button type="button" className="button secondary" onClick={() => void copy(handoff.command, 'command')}>Copy gateway command</button>
      <p><code>tare-demo</code> is a local grant name, not an account supplied by Tare. Set up your own Base Sepolia grant first. Running the command may spend test USDC; verify the network and quote before authorizing. Copying does not execute it.</p>
      <div className="handoff-links"><a href="/developers#bazantic-sandbox">Grant and testnet setup</a><a href={BAZANTIC_CLI_DOCS} target="_blank" rel="noreferrer">Bazantic CLI documentation</a></div>
      <p role="status">{copied === 'task' ? 'Copied Bazantic task' : copied === 'command' ? 'Copied gateway command' : ''}</p>
      {copyError && <p role="alert">Clipboard unavailable. Select and copy the text above.</p>}
    </details>
  </section>;
}

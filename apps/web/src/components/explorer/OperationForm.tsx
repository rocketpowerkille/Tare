import { ArrowRight, LoaderCircle, ScanSearch } from '../Icons';
import { useMemo, useState } from 'react';
import { operationById, operations } from '../../lib/catalog';
import type { Capabilities, DiscoveryResult, OperationId } from '../../lib/types';
import { StatusBadge } from '../StatusBadge';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export interface AnalyzeInput {
  operation: OperationId;
  owner?: string;
  vault?: string;
  blockNumber?: string;
}

export function OperationForm({ capabilities, busy, operation, onOperationChange, onQueryChange, onDiscover, onRun }: {
  capabilities: Capabilities;
  busy: boolean;
  operation: OperationId;
  onOperationChange: (operation: OperationId) => void;
  onQueryChange: () => void;
  onDiscover: (owner: string) => Promise<DiscoveryResult>;
  onRun: (input: AnalyzeInput) => void;
}) {
  const [owner, setOwner] = useState('');
  const [vault, setVault] = useState('');
  const [blockNumber, setBlockNumber] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryResult>();
  const [discoveryError, setDiscoveryError] = useState('');
  const definition = useMemo(() => operationById.get(operation)!, [operation]);
  const configured = capabilities.live[operation];
  const canSubmit = configured
    && (!definition.owner || ADDRESS.test(owner.trim()))
    && (!definition.vault || ADDRESS.test(vault.trim()));

  function updateOwner(value: string) {
    setOwner(value);
    setVault('');
    setDiscovery(undefined);
    setDiscoveryError('');
    onQueryChange();
  }

  function updateVault(value: string) {
    setVault(value);
    onQueryChange();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onRun({
      operation,
      ...(definition.owner ? { owner: owner.trim() } : {}),
      ...(definition.vault ? { vault: vault.trim() } : {}),
      ...(blockNumber ? { blockNumber } : {}),
    });
  }

  async function discoverVaults() {
    const normalizedOwner = owner.trim();
    if (!ADDRESS.test(normalizedOwner)) {
      setDiscoveryError('Enter a complete public wallet address first.');
      return;
    }
    setDiscovering(true);
    setDiscoveryError('');
    setDiscovery(undefined);
    try {
      const result = await onDiscover(normalizedOwner);
      setDiscovery(result);
      if (result.positions.length === 1) updateVault(result.positions[0]!.vault);
    } catch (failure) {
      setDiscoveryError(failure instanceof Error ? failure.message : 'Vault search could not be completed.');
    } finally {
      setDiscovering(false);
    }
  }

  return <section className="query-panel">
    <div className="panel-heading"><div><p className="section-label">Live public data</p><h2>Check a wallet and vault</h2></div><StatusBadge tone={configured ? 'success' : 'neutral'}>{configured ? 'Ready' : 'Unavailable'}</StatusBadge></div>
    <form onSubmit={submit}>
      <p className="form-intro">Start with your public wallet address. Tare can find supported V1 vaults, or you can paste a vault address yourself.</p>
      {definition.owner && <><label htmlFor="owner">Wallet address</label><input id="owner" value={owner} onChange={event => updateOwner(event.target.value)} placeholder="0x0000..." pattern={ADDRESS.source} required autoComplete="off" spellCheck={false} /><p className="field-help">The public address that owns the vault shares.</p></>}
      {operation === 'resolve-v1' && <div className="vault-discovery">
        <button className="button secondary full-button" type="button" disabled={busy || discovering} onClick={() => void discoverVaults()}>{discovering ? <><LoaderCircle className="spin" size={16} />Finding supported vaults</> : <><ScanSearch size={16} />Find my vaults</>}</button>
        {discoveryError && <p className="discovery-error" role="alert">{discoveryError}</p>}
        {discovery && <div className="discovery-results" aria-live="polite">
          <div className="discovery-heading"><strong>{discovery.positions.length ? `${discovery.positions.length} supported vault${discovery.positions.length === 1 ? '' : 's'} found` : 'No supported V1 vaults found'}</strong><span>Candidate results from Morpho's index</span></div>
          {discovery.positions.map(position => <button className={vault === position.vault ? 'vault-option selected' : 'vault-option'} type="button" key={position.vault} onClick={() => updateVault(position.vault)}><span>{position.name || 'Unnamed vault'}</span><code>{position.vault.slice(0, 8)}...{position.vault.slice(-6)}</code></button>)}
          <p>{discovery.positions.length ? 'Choose a vault. Tare will confirm the selected position with direct blockchain reads.' : 'This does not prove the wallet has no positions. You can still paste a vault address below.'}</p>
          {!discovery.complete && <p>The index reported incomplete coverage, so some supported positions may be missing.</p>}
        </div>}
      </div>}
      {definition.vault && <><label htmlFor="vault">Vault address</label><input id="vault" value={vault} onChange={event => updateVault(event.target.value)} placeholder="0x0000..." pattern={ADDRESS.source} required autoComplete="off" spellCheck={false} /><p className="field-help">The contract address shown by the vault app or block explorer. It starts with 0x.</p></>}

      <details className="advanced-options">
        <summary>Advanced options</summary>
        <div className="advanced-options-body">
          <label htmlFor="operation">Type of check</label>
          <select id="operation" value={operation} onChange={event => { onOperationChange(event.target.value as OperationId); onQueryChange(); }}>
            {operations.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <div className="operation-context"><span>{definition.network}</span><p>{definition.description}</p></div>
          <label htmlFor="block">Block number <span className="optional">Optional</span></label>
          <input id="block" value={blockNumber} onChange={event => { setBlockNumber(event.target.value); onQueryChange(); }} placeholder="Use the latest available block" inputMode="numeric" pattern="0|[1-9][0-9]*" />
        </div>
      </details>

      <div className="privacy-note"><strong>Safe to check</strong><span>Tare reads public data only. It cannot move funds or ask your wallet to sign.</span></div>
      <p className="form-note">Wallet search currently covers indexed MetaMorpho V1 positions. Other checks still need a vault entered manually.</p>
      <button className="button primary full-button" type="submit" disabled={busy || discovering || !canSubmit}>{busy ? <><LoaderCircle className="spin" size={17} />Checking this position</> : <>Check this position <ArrowRight size={17} /></>}</button>
    </form>
  </section>;
}

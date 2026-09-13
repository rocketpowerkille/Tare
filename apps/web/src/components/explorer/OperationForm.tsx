import { ArrowRight, LoaderCircle, ScanSearch } from '../Icons';
import { useEffect, useMemo, useState } from 'react';
import { operationById, operations } from '../../lib/catalog';
import type { Capabilities, DiscoveryResult, OperationId } from '../../lib/types';
import { StatusBadge } from '../StatusBadge';
import { Term } from '../Term';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export interface AnalyzeInput {
  operation: OperationId;
  owner?: string;
  vault?: string;
  blockNumber?: string;
  chainId?: number;
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
  const [chainId, setChainId] = useState(1);
  const [discovering, setDiscovering] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryResult>();
  const [discoveryError, setDiscoveryError] = useState('');
  const definition = useMemo(() => operationById.get(operation)!, [operation]);
  const configured = capabilities.live[operation];
  useEffect(() => {
    if (!['resolve-v1', 'resolve-erc4626'].includes(operation)) return;
    const networks = capabilities.networks.filter(network => operation === 'resolve-v1' ? network.resolveV1 : network.erc4626);
    if (networks.length && !networks.some(network => network.chainId === chainId)) setChainId(networks[0]!.chainId);
  }, [operation, capabilities, chainId]);
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
    if (!canSubmit || busy || discovering) return;
    onRun({
      operation,
      ...(definition.owner ? { owner: owner.trim() } : {}),
      ...(definition.vault ? { vault: vault.trim() } : {}),
      ...(blockNumber ? { blockNumber } : {}),
      ...(['resolve-v1', 'resolve-erc4626'].includes(operation) ? { chainId } : {}),
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
      if (result.positions.length === 1 && result.positions[0]!.support.status === 'supported') selectPosition(result.positions[0]!);
    } catch (failure) {
      setDiscoveryError(failure instanceof Error ? failure.message : 'Vault search could not be completed.');
    } finally {
      setDiscovering(false);
    }
  }

  function selectPosition(position: DiscoveryResult['positions'][number]) {
    if (position.support.status !== 'supported') return;
    setVault(position.vault);
    setChainId(position.chainId);
    onOperationChange(position.support.operation);
    onQueryChange();
  }

  return <section className="query-panel">
    <div className="panel-heading"><div><p className="section-label">Live public data</p><h2>Check a wallet and vault</h2></div><StatusBadge tone={configured ? 'success' : 'neutral'}>{configured ? 'Ready' : 'Unavailable'}</StatusBadge></div>
    <form onSubmit={submit}>
      <fieldset disabled={busy || discovering} className="query-fields">
      <p className="form-intro">Find indexed <Term name="Morpho" /> positions, or enter a vault directly for an eligible <Term name="ERC-4626" /> check.</p>
      {definition.owner && <><label htmlFor="owner">Wallet address</label><input id="owner" value={owner} onChange={event => updateOwner(event.target.value)} placeholder="0x0000..." pattern={ADDRESS.source} required autoComplete="off" spellCheck={false} /><p className="field-help">The public address that owns the vault shares.</p></>}
      {['resolve-v1', 'resolve-v2', 'resolve-erc4626'].includes(operation) && <div className="vault-discovery">
        <button className="button secondary full-button" type="button" disabled={busy || discovering} onClick={() => void discoverVaults()}>{discovering ? <><LoaderCircle className="spin" size={16} />Finding supported vaults</> : <><ScanSearch size={16} />Find my vaults</>}</button>
        <p className="field-help">Discovery searches supported networks automatically. Selecting a result sets the network and check type.</p>
        {discoveryError && <div className="discovery-error" role="alert"><p>Vault discovery could not complete.</p><details><summary>Details and next step</summary><p>{discoveryError}</p></details></div>}
        {discovery && <div className="discovery-results" aria-live="polite">
          <div className="discovery-heading"><strong>{discovery.positions.length ? `${discovery.positions.length} position candidate${discovery.positions.length === 1 ? '' : 's'} found` : 'No indexed or registered positions found'}</strong><span>Discovery is not verification. Tare confirms a supported candidate with direct blockchain reads.</span></div>
          {discovery.positions.map(position => <button
            className={`${vault === position.vault && chainId === position.chainId ? 'vault-option selected' : 'vault-option'} ${position.support.status === 'unsupported' ? 'unsupported' : ''}`}
            type="button" key={`${position.chainId}:${position.vault}`} disabled={position.support.status === 'unsupported'} onClick={() => selectPosition(position)}>
            <span className="vault-option-main"><strong>{position.name || 'Unnamed vault'}</strong><small>{position.network} · {position.asset.symbol} · {position.version.toUpperCase()}</small></span>
            <span className={`support-label ${position.support.status}`}><strong>{position.support.status === 'supported' ? 'Supported now' : 'Position found, analysis not supported yet'}</strong><small>{position.support.status === 'supported' ? position.support.checkType : position.support.reason}</small></span>
            <code>{position.vault.slice(0, 8)}...{position.vault.slice(-6)}</code>
          </button>)}
          <p>{discovery.positions.length ? 'Choose a supported result to fill the network, vault, and check type automatically.' : 'This does not prove the wallet has no positions. You can still paste a vault address below.'}</p>
          {!discovery.complete && <p>The index reported incomplete coverage, so some supported positions may be missing.</p>}
        </div>}
      </div>}
      {definition.vault && <><label htmlFor="vault">Vault address</label><input id="vault" value={vault} onChange={event => updateVault(event.target.value)} placeholder="0x0000..." pattern={ADDRESS.source} required autoComplete="off" spellCheck={false} /><p className="field-help">The contract address shown by the vault app or block explorer. It starts with 0x.</p></>}

      <details className="advanced-options">
        <summary>Advanced options</summary>
        <div className="advanced-options-body">
          {['resolve-v1', 'resolve-erc4626'].includes(operation) && <><label htmlFor="chain">Check network</label><select id="chain" value={chainId} onChange={event => { setChainId(Number(event.target.value)); setVault(''); onQueryChange(); }}>
            {!capabilities.networks.some(network => operation === 'resolve-v1' ? network.resolveV1 : network.erc4626) && <option value={chainId}>No live network configured</option>}
            {capabilities.networks.filter(network => operation === 'resolve-v1' ? network.resolveV1 : network.erc4626).map(network => <option key={network.chainId} value={network.chainId}>{network.name}</option>)}
          </select><p className="field-help">For manually entered vaults. Discovery selects this automatically.</p></>}
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
      <p className="form-note">Morpho discovery covers indexed V1 and V2 positions on Ethereum, Base, and Arbitrum. Other ERC-4626 protocols are discovered from the deployment registry or checked by a manually entered vault address.</p>
      <button className="button primary full-button" type="submit" disabled={busy || discovering || !canSubmit}>{busy ? <><LoaderCircle className="spin" size={17} />Checking this position</> : <>Run evidence check <ArrowRight size={17} /></>}</button>
      </fieldset>
    </form>
  </section>;
}

import { ArrowRight, LoaderCircle } from '../Icons';
import { useMemo, useState } from 'react';
import { operationById, operations } from '../../lib/catalog';
import type { Capabilities, OperationId } from '../../lib/types';
import { StatusBadge } from '../StatusBadge';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export interface AnalyzeInput {
  operation: OperationId;
  owner?: string;
  vault?: string;
  blockNumber?: string;
}

export function OperationForm({ capabilities, busy, operation, onOperationChange, onRun }: {
  capabilities: Capabilities;
  busy: boolean;
  operation: OperationId;
  onOperationChange: (operation: OperationId) => void;
  onRun: (input: AnalyzeInput) => void;
}) {
  const [owner, setOwner] = useState('');
  const [vault, setVault] = useState('');
  const [blockNumber, setBlockNumber] = useState('');
  const definition = useMemo(() => operationById.get(operation)!, [operation]);
  const configured = capabilities.live[operation];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onRun({
      operation,
      ...(definition.owner ? { owner: owner.trim() } : {}),
      ...(definition.vault ? { vault: vault.trim() } : {}),
      ...(blockNumber ? { blockNumber } : {}),
    });
  }

  return <section className="query-panel">
    <div className="panel-heading"><div><p className="section-label">Live evidence</p><h2>Choose what to check</h2></div><StatusBadge tone={configured ? 'success' : 'neutral'}>{configured ? 'Available' : 'Not configured'}</StatusBadge></div>
    <form onSubmit={submit}>
      <label htmlFor="operation">Check</label>
      <select id="operation" value={operation} onChange={event => onOperationChange(event.target.value as OperationId)}>
        {operations.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <div className="operation-context"><span>{definition.network}</span><p>{definition.description}</p></div>
      {definition.owner && <><label htmlFor="owner">Public owner address</label><input id="owner" value={owner} onChange={event => setOwner(event.target.value)} placeholder="0x0000..." pattern={ADDRESS.source} required autoComplete="off" spellCheck={false} /></>}
      {definition.vault && <><label htmlFor="vault">Vault contract address</label><input id="vault" value={vault} onChange={event => setVault(event.target.value)} placeholder="0x0000..." pattern={ADDRESS.source} required autoComplete="off" spellCheck={false} /></>}
      <label htmlFor="block">Block number <span className="optional">Optional</span></label>
      <input id="block" value={blockNumber} onChange={event => setBlockNumber(event.target.value)} placeholder="Use the latest available block" inputMode="numeric" pattern="0|[1-9][0-9]*" />
      <p className="form-note">Tare only reads public data. It never asks your wallet to sign.</p>
      <button className="button primary full-button" type="submit" disabled={busy || !configured}>{busy ? <><LoaderCircle className="spin" size={17} />Checking evidence</> : <>Run check <ArrowRight size={17} /></>}</button>
    </form>
  </section>;
}

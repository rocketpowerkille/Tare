import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { Capabilities, JsonRecord } from '../../lib/types';
import { ReportView } from './ReportView';
import { useWalletAddress } from '../../lib/wallet-address';

const vault = '0xbeef01735c132ada46aa9aa4c54623caa92a64cb';

export function HistoricalInvestigation({ token, capabilities, disabled }: { token: string; capabilities: Capabilities; disabled: boolean }) {
  const id = useId();
  const [owner, setOwner] = useWalletAddress();
  const [block, setBlock] = useState('');
  const [report, setReport] = useState<JsonRecord>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const locked = useRef(false);
  const enabled = capabilities.live['verify-historical-graph'];
  useEffect(() => {
    generation.current++; locked.current = false; setBusy(false); setReport(undefined); setError('');
    return () => { generation.current++; };
  }, [token, owner]);

  async function run() {
    if (locked.current || disabled || !enabled) return;
    locked.current = true; setBusy(true); setReport(undefined); setError('');
    const current = ++generation.current;
    try {
      const result = await api.analyze(token, { operation: 'verify-historical-graph', owner, vault,
        ...(block ? { blockNumber: block } : {}) });
      if (current === generation.current) setReport(result);
    } catch (failure) {
      if (current === generation.current) setError(failure instanceof Error ? failure.message : 'Historical verification could not complete.');
    } finally {
      if (current === generation.current) { locked.current = false; setBusy(false); }
    }
  }

  return <section className="investigation-assistant historical-investigator" aria-labelledby={`${id}-title`}>
    <p className="section-label">The Graph · Historical evidence</p>
    <h2 id={`${id}-title`}>Check ownership and accounting together.</h2>
    <p>For Steakhouse USDC on Ethereum, compare transfer-derived wallet shares and vault supply with direct RPC reads, alongside vault and market accounting at the same block.</p>
    <p>Leave the block empty to use the latest indexed historical block. Syncing can continue in the background. This check does not establish the wallet’s current state or authorize transactions.</p>
    <form onSubmit={event => { event.preventDefault(); void run(); }}>
      <div className="change-inputs">
        <div><label htmlFor={`${id}-owner`}>Historical wallet address</label><input id={`${id}-owner`} required pattern="0x[0-9a-fA-F]{40}" value={owner} disabled={busy || disabled}
          onChange={event => { setOwner(event.target.value.trim()); setReport(undefined); }} /></div>
        <div><label htmlFor={`${id}-block`}>Historical block (optional)</label><input id={`${id}-block`} inputMode="numeric" pattern="[0-9]+" value={block} placeholder="Latest indexed block" disabled={busy || disabled}
          onChange={event => { setBlock(event.target.value.trim()); setReport(undefined); }} /></div>
      </div>
      <p>Combined coverage begins at block 25,937,756. Historical RPC access is required; missing evidence remains incomplete.</p>
      {!enabled && <p role="status">Historical verification is not configured on this server yet.</p>}
      <button className="button secondary" type="submit" disabled={busy || disabled || !enabled}>{busy ? 'Comparing historical evidence…' : 'Verify historical position'}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {report && <ReportView report={report} />}
  </section>;
}

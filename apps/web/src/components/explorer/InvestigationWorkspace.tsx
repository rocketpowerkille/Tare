import { useId, useRef, useState } from 'react';
import { ArrowRight, FileClock, ScanSearch } from '../Icons';
import type { Capabilities } from '../../lib/types';
import { ChangeInvestigator } from './ChangeInvestigator';
import { WalletInvestigation } from './WalletInvestigation';
import { HistoricalInvestigation } from './HistoricalInvestigation';

const tools = [
  { title: 'Wallet overview', description: 'Find supported positions and the dependencies they share.', Icon: ScanSearch },
  { title: 'Changes over time', description: 'Compare a position at two blocks or use saved reports.', Icon: FileClock },
  { title: 'Historical verification', description: 'Compare indexed shares and accounting at one block.', Icon: FileClock },
];

export function InvestigationWorkspace({ token, capabilities, disabled }: { token: string; capabilities: Capabilities; disabled: boolean }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  return <section className="investigation-workspace" aria-label="Investigation tools">
    <div className="investigation-tools" role="tablist" aria-label="Choose an investigation">
      {tools.map(({ title, description, Icon }, index) => <button key={title} type="button" role="tab"
        id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={active === index}
        tabIndex={active === index ? 0 : -1} ref={element => { buttons.current[index] = element; }}
        onClick={() => setActive(index)} onKeyDown={event => {
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tools.length - 1
            : event.key === 'ArrowRight' ? (index + 1) % tools.length
              : event.key === 'ArrowLeft' ? (index + tools.length - 1) % tools.length : undefined;
          if (next === undefined) return;
          event.preventDefault();
          setActive(next);
          buttons.current[next]?.focus();
        }}>
        <span className="investigation-tool-icon"><Icon size={24} /></span>
        <span><strong>{title}</strong><span>{description}</span></span>
        <ArrowRight size={18} />
      </button>)}
    </div>
    {/* Keep tools mounted so switching preserves inputs and completed work. */}
    <div role="tabpanel" id={`${id}-panel-0`} aria-labelledby={`${id}-tab-0`} hidden={active !== 0}>
      <WalletInvestigation token={token} disabled={disabled} />
    </div>
    <div role="tabpanel" id={`${id}-panel-1`} aria-labelledby={`${id}-tab-1`} hidden={active !== 1}>
      <ChangeInvestigator token={token} capabilities={capabilities} disabled={disabled} />
    </div>
    <div role="tabpanel" id={`${id}-panel-2`} aria-labelledby={`${id}-tab-2`} hidden={active !== 2}>
      <HistoricalInvestigation token={token} capabilities={capabilities} disabled={disabled} />
    </div>
  </section>;
}

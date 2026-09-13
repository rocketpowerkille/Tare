import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

export function ReportTabs({ sections }: { sections: { label: string; content: ReactNode }[] }) {
  const id = useId();
  const [selected, setSelected] = useState('Summary');
  const active = sections.some(section => section.label === selected) ? selected : sections[0]!.label;

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % sections.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + sections.length - 1) % sections.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = sections.length - 1;
    else return;
    event.preventDefault();
    setSelected(sections[next]!.label);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  return <div className="report-workspace">
    <div className="report-sidebar" role="tablist" aria-label="Report sections" aria-orientation="vertical">
      {sections.map((section, index) => <button key={section.label} type="button" role="tab"
        id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={active === section.label}
        tabIndex={active === section.label ? 0 : -1} onClick={() => setSelected(section.label)} onKeyDown={event => move(event, index)}>
        {section.label}
      </button>)}
    </div>
    <div className="report-panels">
      {sections.map((section, index) => <section key={section.label} role="tabpanel" tabIndex={0}
        id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={active !== section.label}>
        {section.content}
      </section>)}
    </div>
  </div>;
}

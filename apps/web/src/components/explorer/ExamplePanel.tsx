import { FileClock, Play } from '../Icons';
import { useState } from 'react';
import type { ExampleCapability } from '../../lib/types';

export function ExamplePanel({ examples, busy, onRun }: { examples: ExampleCapability[]; busy: boolean; onRun: (id: string) => void }) {
  const [example, setExample] = useState(examples[0]?.id ?? '');
  return <section className="secondary-panel">
    <div className="secondary-panel-heading"><FileClock size={20} /><div><h2>Learn from a recorded example</h2><p>No live network request is made.</p></div></div>
    <label htmlFor="example">Example</label>
    <select id="example" value={example} onChange={event => setExample(event.target.value)}>
      {examples.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
    <button className="button quiet full-button" type="button" disabled={busy || !example} onClick={() => onRun(example)}><Play size={16} />Replay example</button>
  </section>;
}

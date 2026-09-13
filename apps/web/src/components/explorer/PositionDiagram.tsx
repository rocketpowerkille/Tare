import { useState } from 'react';
import { Layers3 } from '../Icons';
import { CopyValue } from '../CopyValue';
import { displayBlock, positionTree, type PathNode } from '../../lib/report-display';
import { record, text, type JsonRecord } from '../../lib/types';

export function PositionDiagram({ report }: { report: JsonRecord }) {
  const tree = positionTree(report);
  const [selected, setSelected] = useState<PathNode>();
  if (!tree) return null;
  const node = selected ?? tree;
  const block = displayBlock(report);
  return <section className="report-section path-section" aria-label="Position path">
    <p className="section-label">Position path</p><h3>Follow each layer</h3>
    <p className="path-help">Select a node to inspect its evidence. Branch amounts are derived allocations, not cash held by the wallet.</p>
    <div className="path-workspace">
      <ol className="vault-tree" aria-label="Accessible position hierarchy"><Node node={tree} selected={node.id} onSelect={setSelected} /></ol>
      <div className="node-inspector" aria-label="Selected path evidence" aria-live="polite">
        <p className="section-label">{node.kind} details</p><h4>{node.label}</h4>
        <CopyValue value={node.reference} label={`${node.kind} address or ID`} />
        <p className="node-status">{node.status}</p>
        <dl>{node.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value.startsWith('0x') ? <CopyValue value={value} label={label} /> : value}</dd></div>)}
          <div><dt>Source mode</dt><dd>{text(report.sourceMode) ?? 'Unavailable'}</dd></div>
          <div><dt>Observed at block</dt><dd>{block ?? 'Unavailable'}</dd></div>
          <div><dt>Capture timestamp</dt><dd>{text(record(report.capture).capturedAt) ?? 'Unavailable'}</dd></div>
        </dl>
        <details key={node.id}><summary>Node technical details</summary><pre>{JSON.stringify(node.raw, null, 2)}</pre></details>
      </div>
    </div>
    <details className="text-path"><summary>Read the path as a text outline</summary>
      <p className="path-help">Source: {text(report.sourceMode) ?? 'Unavailable'} · Block: {block ?? 'Unavailable'}. The same returned data, without the interactive diagram.</p>
      <ol><TextNode node={tree} /></ol>
    </details>
  </section>;
}

function TextNode({ node }: { node: PathNode }) {
  return <li><strong>{node.label}</strong><p><code>{node.reference}</code><br />{node.status}</p>
    <dl>{node.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {node.children.length > 0 && <ol>{node.children.map(child => <TextNode key={child.id} node={child} />)}</ol>}
  </li>;
}

function Node({ node, selected, onSelect }: { node: PathNode; selected: string; onSelect: (node: PathNode) => void }) {
  const descendants = <ol>{node.children.map(child => <Node key={child.id} node={child} selected={selected} onSelect={onSelect} />)}</ol>;
  return <li>
    <button type="button" className={`path-node ${selected === node.id ? 'selected' : ''}`} aria-pressed={selected === node.id} onClick={() => onSelect(node)}>
      <Layers3 size={16} /><span><strong>{node.label}</strong><small>{node.reference.slice(0, 8)}…{node.reference.slice(-6)}</small></span>
    </button>
    {node.children.length > 2 ? <details className="path-branches"><summary>{node.children.length} allocations</summary>{descendants}</details> : node.children.length > 0 && descendants}
  </li>;
}

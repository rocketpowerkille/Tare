import { useId } from 'react';

const definitions = {
  'ERC-4626': 'A standard interface for tokenized vault shares. A conversion quote is not proof of redeemability.',
  Morpho: 'A lending protocol. Supported vault checks trace allocations into Morpho Blue markets.',
  custody: 'Evidence of who holds or controls an asset, within the scope of a particular check.',
  backing: 'Qualifying evidence supporting an asset claim. Balances and prices alone do not establish it.',
  'evidence coverage': 'Which parts of a position the available sources and adapters can check. Not a confidence score.',
};
export function Term({ name }: { name: keyof typeof definitions }) {
  const id = useId();
  return <span className="term"><button type="button" aria-describedby={id}>{name}</button><span role="tooltip" id={id} className="term-tip">{definitions[name]}</span></span>;
}

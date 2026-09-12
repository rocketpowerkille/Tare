import type { OperationDefinition, OperationId } from './types';

export const operations: OperationDefinition[] = [
  {
    id: 'verify-base-custody',
    label: 'Check Base Sepolia custody',
    shortLabel: 'Base custody',
    description: 'Check an approved two-layer test vault through two RPC providers.',
    network: 'Base Sepolia',
    owner: true,
    vault: false,
  },
  {
    id: 'resolve-v1',
    label: 'Trace a V1 vault position',
    shortLabel: 'V1 exposure',
    description: 'Follow a wallet position from a MetaMorpho V1 vault into its markets.',
    network: 'Ethereum',
    owner: true,
    vault: true,
  },
  {
    id: 'resolve-v2',
    label: 'Trace a nested V2 position',
    shortLabel: 'V2 exposure',
    description: 'Follow a V2 vault through V1 allocations and into Morpho Blue markets.',
    network: 'Ethereum',
    owner: true,
    vault: true,
  },
  {
    id: 'verify-shares',
    label: 'Compare wallet shares',
    shortLabel: 'Share check',
    description: 'Compare Graph share records with the same-block onchain reading.',
    network: 'Ethereum',
    owner: true,
    vault: true,
  },
  {
    id: 'verify-accounting',
    label: 'Compare vault accounting',
    shortLabel: 'Accounting',
    description: 'Compare indexed vault accounting with direct onchain reads.',
    network: 'Ethereum',
    owner: false,
    vault: true,
  },
  {
    id: 'verify-weth',
    label: 'Check WETH wrapper custody',
    shortLabel: 'WETH custody',
    description: 'Check wrapper-level ETH custody across two RPC providers.',
    network: 'Ethereum',
    owner: true,
    vault: false,
  },
];

export const operationById = new Map<OperationId, OperationDefinition>(
  operations.map(operation => [operation.id, operation]),
);

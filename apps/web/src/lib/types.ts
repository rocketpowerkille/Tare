export type JsonRecord = Record<string, unknown>;

export interface ExampleCapability {
  id: string;
  operation: OperationId;
  label: string;
}

export interface Capabilities {
  name: string;
  apiVersion: number;
  chainId: number;
  readOnly: boolean;
  examples: ExampleCapability[];
  live: Record<OperationId, boolean>;
  limits: { maxInputBytes: number; concurrentOperations: number };
  limitations: string[];
}

export interface DiscoveredPosition {
  owner: string;
  vault: string;
  name: string;
  reportedSharesRaw: string | null;
}

export interface DiscoveryResult {
  source: 'morpho-graphql';
  scope: 'indexed-morpho-v1-only';
  observedAt: string;
  blockAligned: false;
  complete: boolean;
  issues: Array<'limit' | 'index-changed' | 'missing-state'>;
  positions: DiscoveredPosition[];
}

export type OperationId =
  | 'resolve-v1'
  | 'resolve-v2'
  | 'verify-shares'
  | 'verify-accounting'
  | 'verify-weth'
  | 'verify-base-custody';

export interface OperationDefinition {
  id: OperationId;
  label: string;
  shortLabel: string;
  description: string;
  network: 'Ethereum' | 'Base Sepolia';
  owner: boolean;
  vault: boolean;
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function record(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

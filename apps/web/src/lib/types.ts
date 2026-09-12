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
  networks: Array<{ chainId: number; name: string; resolveV1: boolean; erc4626: boolean }>;
}

export interface DiscoveredPosition {
  owner: string;
  vault: string;
  name: string;
  reportedSharesRaw: string | null;
  reportedAssetsRaw: string | null;
  protocol: string;
  version: 'v1' | 'v2' | 'erc4626';
  chainId: 1 | 8453 | 42161 | 84532;
  network: string;
  asset: { address: string; symbol: string; decimals: number };
  support: { status: 'supported'; operation: 'resolve-v1' | 'resolve-v2' | 'resolve-erc4626'; checkType: string }
    | { status: 'unsupported'; reason: string };
}

export interface DiscoveryResult {
  source: 'morpho-graphql' | 'morpho-graphql+erc4626-registry';
  scope: 'indexed-morpho-v1-and-v2' | 'indexed-morpho-and-configured-erc4626';
  observedAt: string;
  blockAligned: false;
  complete: boolean;
  issues: Array<'limit' | 'chain-unavailable' | 'missing-state' | 'registry-read-failed'>;
  positions: DiscoveredPosition[];
}

export interface AccessOptions {
  privateBeta: boolean;
  bazanticSandbox: null | {
    enabled: true;
    network: 'base-sepolia';
    gatewayUrl: string;
    sessionPath: string;
    sessionSeconds: number;
  };
}

export interface PositionAnalyzeInput {
  operation: 'resolve-v1' | 'resolve-v2' | 'resolve-erc4626';
  owner: string;
  vault: string;
  blockNumber?: string;
  chainId?: number;
}

export type OperationId =
  | 'resolve-v1'
  | 'resolve-v2'
  | 'resolve-erc4626'
  | 'verify-shares'
  | 'verify-accounting'
  | 'verify-graph-composition'
  | 'verify-weth'
  | 'verify-base-custody';

export interface OperationDefinition {
  id: OperationId;
  label: string;
  shortLabel: string;
  description: string;
  network: 'Ethereum' | 'Base Sepolia' | 'Multi-chain';
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

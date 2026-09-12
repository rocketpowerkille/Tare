import type { AccessOptions, Capabilities, DiscoveryResult, JsonRecord, OperationId } from './types';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, token: string, input?: unknown): Promise<T> {
  const response = await fetch(path, {
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(input === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(input === undefined ? {} : { method: 'POST', body: JSON.stringify(input) }),
  });
  const value = await response.json() as JsonRecord;
  if (!response.ok) {
    const error = value.error as JsonRecord | undefined;
    throw new ApiError(response.status, typeof error?.message === 'string' ? error.message : 'The request could not be completed.');
  }
  return value as T;
}

export const api = {
  accessOptions: () => request<AccessOptions>('/api/access-options', ''),
  capabilities: (token: string) => request<Capabilities>('/api/status', token),
  discover: (token: string, owner: string) => request<DiscoveryResult>('/api/discover', token, { owner, maxPositions: 25 }),
  analyze: (token: string, input: { operation: OperationId; owner?: string; vault?: string; blockNumber?: string }) =>
    request<JsonRecord>('/api/analyze', token, input),
  valuePosition: (token: string, input: { chainId: 1; asset: string; amountRaw: string; assetDecimals: number; blockNumber?: string }) =>
    request<JsonRecord>('/api/analyze', token, { operation: 'value-position', ...input }),
  example: (token: string, id: string) => request<JsonRecord>('/api/example', token, { id }),
  replay: (token: string, operation: OperationId, capture: unknown) =>
    request<JsonRecord>('/api/replay', token, { operation, capture }),
};

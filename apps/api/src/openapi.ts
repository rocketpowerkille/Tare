const address = {
  type: 'string',
  pattern: '^0x[0-9a-fA-F]{40}$',
  description: 'A 20-byte EVM address encoded with a 0x prefix.',
} as const;
const blockNumber = {
  type: 'string',
  pattern: '^(0|[1-9][0-9]{0,77})$',
  description: 'Optional decimal block number. Graph-backed operations accept signed 32-bit heights only.',
} as const;
const operations = [
  'resolve-v1', 'resolve-v2', 'resolve-erc4626', 'verify-shares', 'verify-accounting',
  'verify-graph-composition', 'verify-weth', 'verify-base-custody',
] as const;
const genericObject = { type: 'object', additionalProperties: true } as const;
const emptyObject = { type: 'object', additionalProperties: false, properties: {} } as const;

const analyzeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['operation'],
  description: 'Acquire fresh read-only evidence. Resolution and share checks require owner and vault; accounting requires vault; custody checks require owner.',
  properties: {
    operation: { type: 'string', enum: operations },
    owner: address,
    vault: address,
    blockNumber,
    chainId: { type: 'integer', enum: [1, 8453, 42161, 84532], default: 1 },
  },
} as const;
const discoverSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['owner'],
  description: 'Find indexed Morpho V1 and V2 positions across Ethereum, Base and Arbitrum, plus positions in configured ERC-4626 registries. Results are discovery hints and are confirmed by a separate live analysis.',
  properties: {
    owner: address,
    maxPositions: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  },
} as const;
const replaySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['operation', 'capture'],
  properties: {
    operation: { type: 'string', enum: operations },
    capture: { ...genericObject, description: 'A Tare evidence capture previously returned by a compatible report.' },
  },
} as const;
const exampleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'string', enum: ['steakhouse-usdc', 'ov-usdc-v2', 'weth-custody'] },
  },
} as const;
const composeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['resolutionCapture', 'shareCapture', 'graphResponse'],
  description: 'Recompute and join a V1 resolution capture, share-verification capture and direct Graph response from the same position and block.',
  properties: {
    resolutionCapture: genericObject,
    shareCapture: genericObject,
    graphResponse: genericObject,
  },
} as const;

const postOperation = (operationId: string, summary: string, schema: object) => ({
  operationId,
  summary,
  requestBody: {
    required: true,
    content: { 'application/json': { schema } },
  },
  responses: {
    '200': {
      description: 'A Tare report. Incomplete and mismatch reports are valid responses, not proof of backing.',
      content: { 'application/json': { schema: genericObject } },
    },
    '400': { description: 'Input does not match the operation requirements.' },
    '401': { description: 'The hosted bearer token is missing or invalid.' },
    '403': { description: 'The request uses an untrusted Host or Origin.' },
    '413': { description: 'The request exceeds the five MiB input limit.' },
    '415': { description: 'The request must use application/json.' },
    '429': { description: 'The concurrency or per-client quota was reached.' },
    '500': { description: 'The operation failed without exposing private provider diagnostics.' },
    '503': { description: 'A provider required by the requested operation is not configured.' },
  },
});

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Tare read-only evidence API',
    version: '1.0.0',
    description: 'Trace nested-vault exposure and verification gaps. Raw integers are decimal strings; inspect status, sourceMode, findings and metric scope.',
  },
  paths: {
    '/healthz': { get: { operationId: 'tare_health', summary: 'Check whether the API process is accepting requests.',
      security: [], responses: { '200': { description: 'The API process is healthy.' } } } },
    '/api/access-options': { get: {
      operationId: 'tare_access_options',
      summary: 'List the access methods available for this Tare deployment.',
      security: [],
      responses: { '200': { description: 'Public access configuration with no credentials or secrets.',
        content: { 'application/json': { schema: genericObject } } } },
    } },
    '/api/status': { get: { operationId: 'tare_status', summary: 'List configured capabilities, limits and retained evidence examples.',
      responses: { '200': { description: 'Capability flags; configured does not mean independently verified.',
        content: { 'application/json': { schema: genericObject } } } } } },
    '/api/bazantic/session': { post: postOperation(
      'tare_start_bazantic_sandbox_session',
      'Start a short-lived Tare session after a Bazantic Base Sepolia sandbox payment.',
      emptyObject,
    ) },
    '/api/discover': { post: postOperation('tare_discover', 'Find multi-chain Morpho and registered ERC-4626 positions for a wallet.', discoverSchema) },
    '/api/analyze': { post: postOperation('tare_analyze', 'Acquire fresh read-only Ethereum, Base, Arbitrum or Base Sepolia evidence.', analyzeSchema) },
    '/api/agent-analyze': { post: postOperation('tare_analyze_compact', 'Acquire a compact agent report from fresh read-only evidence.', analyzeSchema) },
    '/api/replay': { post: postOperation('tare_replay', 'Recalculate an unsigned evidence capture without making network requests.', replaySchema) },
    '/api/example': { post: postOperation('tare_example', 'Replay one retained public evidence example without network requests.', exampleSchema) },
    '/api/agent-example': { post: postOperation('tare_example_compact', 'Replay a retained example as a compact agent report.', exampleSchema) },
    '/api/compose': { post: postOperation('tare_compose', 'Recompute and join V1 exposure and Graph share evidence.', composeSchema) },
  },
};

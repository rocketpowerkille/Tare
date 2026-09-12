const address = {
  type: 'string',
  description: 'A 20-byte EVM address with a 0x prefix.',
} as const;

const success = { description: 'Successful Tare JSON response.' } as const;

// Bazantic uses this deliberately small OpenAPI surface to generate MCP tools.
// The canonical OpenAPI document remains the complete API description.
export const mcpOpenapi = {
  openapi: '3.0.0',
  info: {
    title: 'Tare agent tools',
    version: '1.0.0',
    description: 'Read-only tools for finding supported vaults, acquiring evidence and replaying retained examples.',
  },
  paths: {
    '/api/status': {
      get: {
        operationId: 'tare_status',
        summary: 'Inspect available Tare evidence capabilities.',
        responses: { '200': success },
      },
    },
    '/api/bazantic/session': {
      post: {
        operationId: 'tare_start_bazantic_sandbox_session',
        summary: 'Start a short-lived Tare Explorer session after a Bazantic Base Sepolia sandbox payment.',
        description: 'This access path is testnet only. Mainnet payment access is not enabled.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: false, properties: {} },
            },
          },
        },
        responses: { '200': success },
      },
    },
    '/api/discover': {
      post: {
        operationId: 'tare_discover_vaults',
        summary: 'Find indexed MetaMorpho V1 vault candidates for a public wallet address.',
        description: 'Candidate discovery uses Morpho indexed current state. Confirm a selected vault with tare_analyze_compact.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['owner'],
                properties: {
                  owner: address,
                  vault: { ...address, description: 'Optional MetaMorpho V1 vault filter.' },
                  maxPositions: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
                },
              },
            },
          },
        },
        responses: { '200': success },
      },
    },
    '/api/agent-analyze': {
      post: {
        operationId: 'tare_analyze_compact',
        summary: 'Acquire a compact, read-only Ethereum or Base Sepolia evidence report for an agent.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['operation'],
                properties: {
                  operation: {
                    type: 'string',
                    enum: ['resolve-v1', 'resolve-v2', 'verify-shares', 'verify-accounting', 'verify-weth', 'verify-base-custody'],
                  },
                  owner: address,
                  vault: address,
                  blockNumber: { type: 'string', description: 'Optional decimal block number.' },
                },
              },
            },
          },
        },
        responses: { '200': success },
      },
    },
    '/api/agent-example': {
      post: {
        operationId: 'tare_example_compact',
        summary: 'Replay a retained public evidence example and return a compact agent report.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['id'],
                properties: {
                  id: { type: 'string', enum: ['steakhouse-usdc', 'ov-usdc-v2', 'weth-custody'] },
                },
              },
            },
          },
        },
        responses: { '200': success },
      },
    },
  },
};

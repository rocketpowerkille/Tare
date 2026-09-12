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
        summary: 'Find multi-chain Morpho and registered ERC-4626 positions for a public wallet address.',
        description: 'Morpho discovery covers V1 and V2 on Ethereum, Base and Arbitrum. Configured registries add other ERC-4626 protocols and Base Sepolia. Confirm a supported result with tare_analyze_compact.',
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
        summary: 'Acquire a compact, read-only multi-chain evidence report for an agent.',
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
                    enum: ['resolve-v1', 'resolve-v2', 'resolve-erc4626', 'verify-shares', 'verify-accounting', 'verify-graph-composition', 'verify-weth', 'verify-base-custody'],
                  },
                  owner: address,
                  vault: address,
                  blockNumber: { type: 'string', description: 'Optional decimal block number.' },
                  chainId: { type: 'integer', enum: [1, 8453, 42161, 84532], default: 1 },
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

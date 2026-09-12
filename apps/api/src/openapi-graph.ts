const accountingHeadQuery = 'query TareGatewayStatus{_meta{block{number hash} deployment hasIndexingErrors}}';

/**
 * A narrow contract for adding Tare's live Graph Studio deployment as a second
 * Bazantic service. The server remains The Graph, not the Tare API.
 */
export const graphOpenapi = {
  openapi: '3.0.3',
  info: {
    title: 'Tare Graph accounting index status',
    version: '1.0.0',
    description: 'Read the indexed block, deployment identity and indexing-error state from Tare\'s live The Graph Studio subgraph.',
  },
  servers: [{ url: 'https://api.studio.thegraph.com' }],
  paths: {
    '/query/1760123/tare-live-accounting/0.1.0': {
      post: {
        operationId: 'graph_tare_accounting_head',
        summary: 'Read the live Tare accounting subgraph status.',
        description: 'The final verdict must reject indexing errors and any deployment other than Tare\'s pinned accounting deployment.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['query'],
                properties: {
                  query: {
                    type: 'string',
                    enum: [accountingHeadQuery],
                    default: accountingHeadQuery,
                    description: 'Use this exact bounded status query.',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Current indexing status from The Graph Studio.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['data'],
                  properties: {
                    data: {
                      type: 'object',
                      required: ['_meta'],
                      properties: {
                        _meta: {
                          type: 'object',
                          required: ['block', 'deployment', 'hasIndexingErrors'],
                          properties: {
                            block: {
                              type: 'object',
                              required: ['number', 'hash'],
                              properties: {
                                number: { type: 'integer', minimum: 0 },
                                hash: { type: 'string', nullable: true },
                              },
                            },
                            deployment: { type: 'string' },
                            hasIndexingErrors: { type: 'boolean' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

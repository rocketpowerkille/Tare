const accountingHeadQuery = 'query TareGatewayStatus{_meta{block{number hash} deployment hasIndexingErrors}}';
const accountingSnapshotQuery = 'query TareGatewaySnapshot($block:Block_height!,$vault:ID!){_meta(block:$block){block{number hash} deployment hasIndexingErrors} accountingState(id:$vault,block:$block){id chainId blockNumber blockHash timestamp reads(first:264){to data result}}}';

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
        summary: 'Read the Tare accounting index head or a bounded block-pinned accounting snapshot.',
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
                    enum: [accountingHeadQuery, accountingSnapshotQuery],
                    default: accountingHeadQuery,
                    description: 'Choose the exact head query or snapshot query. A snapshot requires variables with the returned head hash and requested vault.',
                  },
                  variables: {
                    type: 'object', additionalProperties: false, required: ['block', 'vault'], properties: {
                      block: { type: 'object', additionalProperties: false, required: ['hash'], properties: {
                        hash: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' },
                      } },
                      vault: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
                    },
                    description: 'For the snapshot query only: use the exact hash from the head response and the requested vault.',
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
                        accountingState: { type: 'object', nullable: true, description: 'Present for the snapshot query: id, chainId, blockNumber, blockHash, timestamp, and up to 264 {to,data,result} reads. Forward this exact object with _meta to tare_compare_indexed_accounting.' },
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

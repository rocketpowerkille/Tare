import { z } from 'zod/v4';
import { AnalyzeSchema, ReplaySchema, ExampleSchema } from '../../../packages/service/src/requests.js';
import { ComposeSchema } from '../../../packages/service/src/composition.js';

const operations = {
  analyze: { schema: AnalyzeSchema, summary: 'Read-only Ethereum resolution or verification using configured providers' },
  replay: { schema: ReplaySchema, summary: 'Recalculate an unsigned capture offline; never establishes freshness' },
  example: { schema: ExampleSchema, summary: 'Replay one retained public example offline' },
  compose: { schema: ComposeSchema, summary: 'Recompute and join V1 resolution and Graph share captures at the same position and block; unsigned recorded evidence only' },
};
export const openapi = {
  openapi: '3.1.0', info: { title: 'Tare read-only evidence API', version: '1.0.0',
    description: 'Raw integer amounts are decimal strings. Read status, sourceMode, findings and metric scope before using a result.' },
  paths: {
    '/api/status': { get: { operationId: 'tare_status', summary: 'Configuration flags, limits and retained examples',
      responses: { '200': { description: 'Capabilities; configured does not mean independently verified' } } } },
    ...Object.fromEntries(Object.entries(operations).map(([name, { schema, summary }]) => [`/api/${name}`, {
      post: { operationId: `tare_${name}`, summary,
        requestBody: { required: true, content: { 'application/json': { schema: z.toJSONSchema(schema, { io: 'input' }) } } },
        responses: {
          '200': { description: 'Existing Tare report, including incomplete/mismatch results. A 200 response is not proof of backing.',
            content: { 'application/json': { schema: { type: 'object' } } } },
          '400': { description: 'Invalid input' }, '401': { description: 'Missing or invalid hosted API token' }, '403': { description: 'Untrusted Host or Origin' },
          '413': { description: 'Input exceeds 5 MiB' }, '415': { description: 'Expected application/json' },
          '429': { description: 'Concurrency or client quota reached; see Retry-After' }, '500': { description: 'Operation failed' },
          '503': { description: 'Required provider is not configured' },
        },
      },
    }])),
  },
};

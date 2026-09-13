import { mcpOpenapi } from './openapi-mcp.js';

const response = { '200': { description: 'Bounded investigation response. An AI answer is not new verification or confirmed settlement.' },
  '400': { description: 'Invalid input or sensitive credential content.' }, '401': { description: 'Access session is missing, invalid or expired.' },
  '403': { description: 'Untrusted origin or wrong gateway identity.' }, '404': { description: 'Reference or run unavailable or expired.' },
  '409': { description: 'Idempotency key conflicts with another question.' }, '413': { description: 'Context exceeds bounds.' },
  '429': { description: 'Concurrency, retention or access quota reached.' }, '503': { description: 'Assistant is disabled.' } };
const post = (operationId: string, schema: unknown) => ({ post: { operationId, requestBody: { required: true, content: { 'application/json': { schema } } }, responses: response } });
export const investigationPaths = {
  '/api/investigation/options': { get: { operationId: 'tare_investigation_options', responses: response } },
  '/api/investigation/snapshot': post('tare_investigation_snapshot', { type: 'object', additionalProperties: false, required: ['report'], properties: {
    report: { type: 'object', description: 'Exact displayed report including primary and modules. Maximum combined request 1 MiB; no credentials.' },
    previous: { type: 'object', description: 'Optional previous report for same-identity comparison.' },
  } }),
  '/api/investigation/run': post('tare_investigation_run', { type: 'object', additionalProperties: false, required: ['reference', 'requestId', 'question', 'consent'], properties: {
    reference: { type: 'string', pattern: '^[a-f0-9]{48}$' }, requestId: { type: 'string', format: 'uuid' },
    question: { type: 'string', minLength: 1, maxLength: 1500 }, consent: { type: 'boolean', enum: [true] },
  } }),
  '/api/investigation/run/{id}': { get: { operationId: 'tare_investigation_run_status', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }], responses: response } },
  '/api/investigation/wallet': post('tare_investigate_wallet', { type: 'object', additionalProperties: false, required: ['owner'], properties: { owner: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' } } }),
  '/api/agent-report-context': mcpOpenapi.paths['/api/agent-report-context'],
  '/api/agent-compare-accounting': mcpOpenapi.paths['/api/agent-compare-accounting'],
};

import { z } from 'zod/v4';
import { ServiceError } from '../../../packages/service/src/requests.js';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export type RecipeExecution = { output: unknown; gateway: string; elapsedMs: number; payment: 'not-requested' };
export interface RecipeExecutor { execute(handle: string, question: string): Promise<RecipeExecution> }

async function boundedText(response: Response) {
  if (!response.body) throw new Error('Missing response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 512_000) throw new Error('Response too large');
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}

export function parseMcp(text: string) {
  if (text.trimStart().startsWith('{')) {
    const message = record(JSON.parse(text));
    if (message.id !== 1) throw new Error('Mismatched MCP response');
    return message;
  }
  for (const event of text.split(/\r?\n\r?\n/)) {
    const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data) continue;
    const message = record(JSON.parse(data));
    if (message.id === 1) return message;
  }
  throw new Error('No MCP result');
}

/** No payer, signing key, auth header or paid retry. A 402 always stops execution. */
export class PublicRecipeExecutor implements RecipeExecutor {
  constructor(private readonly send: typeof fetch = fetch) {}

  async execute(handle: string, question: string): Promise<RecipeExecution> {
    z.string().regex(/^[a-z0-9-]{1,100}$/).parse(handle);
    z.string().min(1).max(4000).parse(question);
    const started = Date.now();
    const signal = AbortSignal.timeout(120_000);
    const call = async (url: string, method: string, params: unknown) => {
      const response = await this.send(url, { method: 'POST', redirect: 'error', signal,
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      if (response.status === 402) throw new ServiceError(402, 'recipe-payment-required', 'Bazantic requires payment for this Recipe. No payment was authorized or retried. Use the external Recipe or ask the operator to configure a reviewed payment path.');
      if (!response.ok) throw new ServiceError(502, 'recipe-unavailable', 'The Bazantic Recipe service could not complete this request. It was not retried.');
      const message = parseMcp(await boundedText(response));
      if (message.error) throw new Error('MCP error');
      return record(message.result);
    };
    try {
      const initialization = await call('https://api.bazantic.com/mcp', 'initialize', {
        protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'tare-investigation', version: '1' },
      });
      const endpoint = record(record(initialization._meta)['com.bazantic/recipe']).gateway_mcp_url;
      if (typeof endpoint !== 'string') throw new Error('Missing execution endpoint');
      const url = new URL(endpoint);
      if (url.protocol !== 'https:' || !/^[a-z0-9]+\.bazgateway\.com$/.test(url.hostname)
        || url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/recipe-mcp') throw new Error('Untrusted execution endpoint');
      const catalog = await call('https://api.bazantic.com/mcp', 'tools/list', {});
      const tool = (Array.isArray(catalog.tools) ? catalog.tools : []).map(record).find(item => item.name === handle);
      if (!tool) throw new ServiceError(503, 'recipe-not-published', 'The configured investigation Recipe is not present in the public tool catalog.');
      const schema = record(tool.inputSchema);
      const questionSchema = record(record(schema.properties).question);
      if (schema.type !== 'object' || questionSchema.type !== 'string'
        || (typeof questionSchema.maxLength === 'number' && question.length > questionSchema.maxLength)
        || (Array.isArray(schema.required) && schema.required.some(key => key !== 'question'))) throw new Error('Incompatible Recipe schema');
      const result = await call(url.href, 'tools/call', { name: handle, arguments: { question } });
      if (result.isError === true) throw new Error('Recipe tool failed');
      const structured = record(result.structuredContent);
      const texts = (Array.isArray(result.content) ? result.content : []).map(record).filter(item => item.type === 'text');
      let output: unknown = structured.output ?? texts.map(item => String(item.text ?? '')).join('\n');
      if (typeof output === 'string') {
        try { const wrapper = record(JSON.parse(output)); output = wrapper.output ?? output; } catch { /* Plain text remains an unreviewed answer. */ }
      }
      return { output, gateway: url.origin, elapsedMs: Date.now() - started, payment: 'not-requested' };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(502, signal.aborted ? 'recipe-timeout' : 'recipe-unavailable',
        signal.aborted ? 'Recipe execution timed out. It may still finish remotely; Tare will not automatically retry.' : 'The Recipe response was unavailable or incompatible. No automatic retry was made.');
    }
  }
}

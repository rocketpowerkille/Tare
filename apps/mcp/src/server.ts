import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { TareService } from '../../../packages/service/src/index.js';
import { AnalyzeSchema, ReplaySchema, ExampleSchema, EmptySchema, publicError } from '../../../packages/service/src/requests.js';

export function createMcpServer(service = new TareService()) {
  const server = new McpServer({ name: 'tare', version: '0.1.0' });
  function register(name: string, description: string, schema: z.ZodType, live: boolean, run: (input: unknown) => unknown) {
    server.registerTool(name, {
      description, inputSchema: schema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: live },
    }, async input => {
      try {
        const result = await run(input);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result as Record<string, unknown> };
      } catch (error) {
        const failure = publicError(error);
        return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ error: { code: failure.code, message: failure.message } }) }] };
      }
    });
  }
  register('tare_status', 'List configured read-only operations and offline examples. Configuration is not verification.', EmptySchema, false, () => service.capabilities());
  register('tare_analyze', 'Resolve or cross-check an Ethereum position using local provider configuration. Preserve findings and metric scope; incomplete results are not backing proof.', AnalyzeSchema, true, input => service.run('analyze', input));
  register('tare_replay', 'Recalculate a raw capture offline. Recorded evidence is unsigned and cannot prove current state. Preserve sourceMode and metric limitations.', ReplaySchema, false, input => service.run('replay', input));
  register('tare_example', 'Replay a retained public example offline. These are historical captures, not live checks.', ExampleSchema, false, input => service.run('example', input));
  return server;
}

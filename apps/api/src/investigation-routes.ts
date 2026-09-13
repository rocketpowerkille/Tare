import { createHash } from 'node:crypto';
import { z } from 'zod/v4';
import type { IncomingMessage } from 'node:http';
import type { AccessIdentity, HostedConfig } from './access.js';
import { InvestigationStore, ReferenceInput } from './investigation-store.js';
import { InvestigationRunner } from './investigation-runner.js';
import { PublicRecipeExecutor } from './recipe-client.js';
import type { RecipeExecutor } from './recipe-client.js';
import { ServiceError } from '../../../packages/service/src/requests.js';

export interface InvestigationConfig { recipe?: string; executor?: RecipeExecutor; store?: InvestigationStore }

export function investigationFromEnv(env: NodeJS.ProcessEnv = process.env): InvestigationConfig {
  if (env.TARE_RECIPE_ENABLED !== 'true') return {};
  const recipe = z.string().regex(/^[a-z0-9-]{1,100}$/).parse(env.TARE_INVESTIGATION_RECIPE);
  return { recipe };
}

export class InvestigationRoutes {
  readonly store;
  readonly runner;
  constructor(config: InvestigationConfig = {}, private readonly hosted?: HostedConfig) {
    this.store = config.store ?? new InvestigationStore();
    this.runner = new InvestigationRunner(this.store, config.executor ?? new PublicRecipeExecutor(), config.recipe);
  }

  async handle(path: string, request: IncomingMessage, identity: AccessIdentity | undefined, read: () => Promise<unknown>) {
    // Auth is performed by the existing server before these routes or any body parsing.
    // Hash distinguishes individual sandbox sessions without retaining bearer credentials.
    const owner = createHash('sha256').update(request.headers.authorization ?? 'local-loopback').digest('hex');
    if (path === '/api/investigation/options') {
      this.method(request, 'GET');
      return this.runner.options();
    }
    if (path === '/api/investigation/snapshot') {
      this.method(request, 'POST');
      return this.store.create(owner, await read());
    }
    if (path === '/api/agent-report-context') {
      this.method(request, 'POST');
      if (!this.hosted?.bazanticSandbox || identity?.kind !== 'api-key' || identity.clientId !== this.hosted.bazanticSandbox.clientId) {
        throw new ServiceError(403, 'gateway-required', 'Report context retrieval requires the configured Tare gateway identity and an expiring report reference.');
      }
      const input = ReferenceInput.parse(await read());
      return this.store.read(input.reference, input.page);
    }
    if (path === '/api/investigation/run') {
      this.method(request, 'POST');
      return this.runner.start(owner, await read());
    }
    if (path.startsWith('/api/investigation/run/')) {
      this.method(request, 'GET');
      const id = z.uuid().parse(path.slice('/api/investigation/run/'.length));
      return this.runner.get(owner, id);
    }
    throw new ServiceError(404, 'not-found', 'Unknown investigation route.');
  }
  private method(request: IncomingMessage, method: string) {
    if (request.method !== method) throw new ServiceError(405, 'method-not-allowed', `Use ${method}.`);
  }
}

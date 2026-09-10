import { fileURLToPath } from 'node:url';
import { resolveLivePosition, replayLiveCapture } from '../../resolver/src/live.js';
import { resolveNestedPosition, replayNestedCapture } from '../../resolver/src/nested.js';
import { verifyShares, replayShareVerification } from '../../verification/src/shares.js';
import { verifyAccounting, replayAccounting } from '../../verification/src/accounting.js';
import { verifyWethCustody, replayCustody } from '../../verification/src/custody.js';
import { readJsonFile } from '../../sources/src/snapshot.js';
import { AnalyzeSchema, ReplaySchema, ExampleSchema, MAX_INPUT_BYTES, ServiceError } from './requests.js';
import { composePosition } from './composition.js';

export interface ServiceConfig {
  rpcUrl?: string;
  secondaryRpcUrl?: string;
  graphUrl?: string;
  expectedDeployment?: string;
  graphApiKey?: string;
}
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  return Object.fromEntries(Object.entries({
    rpcUrl: env.TARE_RPC_URL, secondaryRpcUrl: env.TARE_SECONDARY_RPC_URL,
    graphUrl: env.TARE_GRAPH_URL, expectedDeployment: env.TARE_GRAPH_DEPLOYMENT,
    graphApiKey: env.GRAPH_API_KEY,
  }).filter((entry): entry is [string, string] => Boolean(entry[1])));
}

export const examples = [
  { id: 'steakhouse-usdc', operation: 'resolve-v1', label: 'Steakhouse USDC · V1 → Blue' },
  { id: 'ov-usdc-v2', operation: 'resolve-v2', label: 'OV USDC · V2 → V1 → Blue' },
  { id: 'weth-custody', operation: 'verify-weth', label: 'WETH custody · wrapper-only control' },
] as const;

export class TareService {
  private active = 0;
  private readonly config: Readonly<ServiceConfig>;
  constructor(config: ServiceConfig = {}) { this.config = Object.freeze({ ...config }); }

  capabilities() {
    const rpc = Boolean(this.config.rpcUrl);
    const graph = rpc && Boolean(this.config.graphUrl);
    return {
      name: 'tare', apiVersion: 1, chainId: 1, readOnly: true, examples,
      live: { 'resolve-v1': rpc, 'resolve-v2': rpc, 'verify-shares': graph,
        'verify-accounting': graph, 'verify-weth': rpc && Boolean(this.config.secondaryRpcUrl) },
      limits: { maxInputBytes: MAX_INPUT_BYTES, concurrentOperations: 2 },
      limitations: ['Recorded evidence is unsigned and is not a fresh source check.',
        'Morpho backing remains unverified; the WETH metric applies only to the wrapper.'],
    };
  }

  // Shared across transports: requests cannot choose provider URLs, paths or credentials.
  async run(action: 'analyze' | 'replay' | 'example' | 'compose', input: unknown): Promise<unknown> {
    const serialized = JSON.stringify(input);
    if (!serialized || Buffer.byteLength(serialized) > MAX_INPUT_BYTES) {
      throw new ServiceError(413, 'input-too-large', 'Input exceeds the 5 MiB limit.');
    }
    if (this.active >= 2) throw new ServiceError(429, 'busy', 'Two operations are running; retry when one finishes.');
    this.active++;
    try {
      if (action === 'analyze') return await this.analyze(input);
      if (action === 'replay') return await this.replay(input);
      if (action === 'compose') return await composePosition(input);
      const { id } = ExampleSchema.parse(input);
      const example = examples.find(item => item.id === id)!;
      const path = fileURLToPath(new URL(`../../../../fixtures/live/${id}.capture.json`, import.meta.url));
      return await this.replay({ operation: example.operation, capture: await readJsonFile(path) });
    } finally { this.active--; }
  }

  private async replay(input: unknown) {
    const request = ReplaySchema.parse(input);
    switch (request.operation) {
      case 'resolve-v1': return replayLiveCapture(request.capture);
      case 'resolve-v2': return replayNestedCapture(request.capture);
      case 'verify-shares': return replayShareVerification(request.capture);
      case 'verify-accounting': return replayAccounting(request.capture);
      case 'verify-weth': return replayCustody(request.capture);
    }
  }

  private async analyze(input: unknown) {
    const request = AnalyzeSchema.parse(input);
    if (!this.capabilities().live[request.operation]) {
      throw new ServiceError(503, 'not-configured', `Configure local providers for ${request.operation} first.`);
    }
    const { rpcUrl, graphUrl, secondaryRpcUrl, expectedDeployment, graphApiKey } = this.config;
    const rpc = { rpcUrl: rpcUrl!, ...(request.blockNumber === undefined ? {} : { blockNumber: request.blockNumber }) };
    const graph = { ...rpc, graphUrl: graphUrl!, ...(expectedDeployment ? { expectedDeployment } : {}) };
    switch (request.operation) {
      case 'resolve-v1': return resolveLivePosition({ ...rpc, owner: request.owner, vault: request.vault, chainId: 1 });
      case 'resolve-v2': return resolveNestedPosition({ ...rpc, owner: request.owner, vault: request.vault });
      case 'verify-shares': return verifyShares({ ...graph, owner: request.owner, vault: request.vault }, graphApiKey);
      case 'verify-accounting': return verifyAccounting({ ...graph, vault: request.vault }, graphApiKey);
      case 'verify-weth': return verifyWethCustody({ ...rpc, owner: request.owner, secondaryRpcUrl: secondaryRpcUrl! });
    }
  }
}

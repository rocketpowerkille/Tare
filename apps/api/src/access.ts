import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { z } from 'zod/v4';
import { ServiceError } from '../../../packages/service/src/requests.js';
import { BazanticSandboxSchema, BazanticSandboxSessions } from './bazantic-session.js';

const KeySchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);
const HostedSchema = z.strictObject({
  origin: z.url().refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && value === url.origin;
  }),
  keys: z.record(z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), KeySchema)
    .refine(keys => Object.keys(keys).length > 0 && Object.keys(keys).length <= 100)
    .refine(keys => new Set(Object.values(keys)).size === Object.keys(keys).length),
  requestsPerMinute: z.number().int().min(1).max(600).default(60),
  bazanticSandbox: BazanticSandboxSchema.optional(),
});
export type HostedConfig = z.input<typeof HostedSchema>;

export type AccessIdentity = {
  kind: 'api-key' | 'bazantic-sandbox-session';
  clientId: string;
  expiresAt?: number;
};

export function accessFromEnv(env: NodeJS.ProcessEnv = process.env): HostedConfig | undefined {
  const renderOrigin = env.RENDER === 'true' ? env.RENDER_EXTERNAL_URL : undefined;
  const origin = env.TARE_PUBLIC_ORIGIN ?? renderOrigin;
  const { TARE_API_KEYS: keys, TARE_REQUESTS_PER_MINUTE: rate } = env;
  const hasBazanticCredentials = env.TARE_BAZANTIC_CLIENT_ID !== undefined
    || env.TARE_BAZANTIC_SESSION_SECRET !== undefined;
  if (origin === undefined && keys === undefined && rate === undefined && !hasBazanticCredentials) return undefined;
  try {
    return HostedSchema.parse({ origin, keys: JSON.parse(keys ?? ''),
      ...(rate === undefined ? {} : { requestsPerMinute: Number(rate) }),
      ...(hasBazanticCredentials ? { bazanticSandbox: {
        clientId: env.TARE_BAZANTIC_CLIENT_ID,
        sessionSecret: env.TARE_BAZANTIC_SESSION_SECRET,
        gatewayUrl: env.TARE_BAZANTIC_GATEWAY_URL,
        ...(env.TARE_BAZANTIC_SESSION_MINUTES === undefined ? {} : {
          sessionMinutes: Number(env.TARE_BAZANTIC_SESSION_MINUTES),
        }),
      } } : {}),
    });
  } catch {
    throw new Error('Hosted access requires an HTTPS origin, unique API keys, a valid request limit and complete Bazantic sandbox settings.');
  }
}

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Single-process quotas keyed by configured clients, never by spoofable forwarded IPs. */
export class ApiAccess {
  readonly origin: string | undefined;
  private readonly clients;
  private readonly limit;
  private readonly bazantic;
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(input?: HostedConfig, private readonly now = Date.now) {
    const config = input === undefined ? undefined : HostedSchema.parse(input);
    this.origin = config?.origin;
    this.limit = config?.requestsPerMinute ?? 60;
    this.clients = Object.entries(config?.keys ?? {}).map(([id, key]) => ({ id, hash: digest(key) }));
    this.bazantic = config?.bazanticSandbox === undefined
      ? undefined : new BazanticSandboxSessions(config.bazanticSandbox);
  }

  check(request: IncomingMessage, protectedRoute: boolean): AccessIdentity | undefined {
    const localHosts = [`127.0.0.1:${request.socket.localPort}`, `localhost:${request.socket.localPort}`];
    const hosts = this.origin ? [new URL(this.origin).host] : localHosts;
    const origins = this.origin ? [this.origin] : localHosts.map(host => `http://${host}`);
    if (!hosts.includes(request.headers.host ?? '')
      || (request.headers.origin && !origins.includes(request.headers.origin))
      || request.headers['sec-fetch-site'] === 'cross-site') {
      throw new ServiceError(403, 'untrusted-origin', 'Request Host or Origin is not allowed.');
    }
    if (!this.origin || !protectedRoute) return undefined;
    const match = /^Bearer ([A-Za-z0-9._-]{32,512})$/i.exec(request.headers.authorization ?? '');
    const token = match?.[1] ?? '';
    const hash = digest(token);
    const client = this.clients.find(candidate => timingSafeEqual(candidate.hash, hash));
    if (match && client) {
      this.useQuota(client.id);
      return { kind: 'api-key', clientId: client.id };
    }
    const session = match ? this.bazantic?.verify(token, this.now()) : undefined;
    if (!session) throw new ServiceError(401, 'unauthorized', 'A valid Tare access code or Bazantic sandbox session is required.');
    this.useQuota(`bazantic-session:${session.sessionId}`);
    return { kind: 'bazantic-sandbox-session', clientId: 'bazantic-sandbox', expiresAt: session.expiresAt };
  }

  accessOptions() {
    return {
      privateBeta: this.origin !== undefined,
      bazanticSandbox: this.bazantic ? {
        enabled: true,
        network: 'base-sepolia',
        gatewayUrl: this.bazantic.gatewayUrl,
        sessionPath: '/api/bazantic/session',
        sessionSeconds: this.bazantic.sessionSeconds,
      } : null,
    };
  }

  issueBazanticSession(identity: AccessIdentity | undefined) {
    if (!this.bazantic) throw new ServiceError(503, 'bazantic-sandbox-unavailable', 'Bazantic sandbox access is not configured.');
    if (identity?.kind !== 'api-key' || identity.clientId !== this.bazantic.clientId) {
      throw new ServiceError(403, 'bazantic-gateway-required', 'Start this session through the configured Bazantic sandbox gateway.');
    }
    const issued = this.bazantic.issue(this.now());
    return {
      accessToken: issued.token,
      tokenType: 'Bearer',
      network: 'base-sepolia',
      expiresAt: new Date(issued.payload.expiresAt * 1000).toISOString(),
      expiresInSeconds: this.bazantic.sessionSeconds,
    };
  }

  private useQuota(id: string) {
    const now = this.now();
    let window = this.windows.get(id);
    if (!window || now - window.start >= 60000 || now < window.start) {
      window = { start: now, count: 0 };
      this.windows.set(id, window);
    }
    if (window.count >= this.limit) throw new ServiceError(429, 'rate-limited', 'Client request limit reached; retry after one minute.');
    window.count++;
  }
}

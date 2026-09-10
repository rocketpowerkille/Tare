import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { z } from 'zod/v4';
import { ServiceError } from '../../../packages/service/src/requests.js';

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
});
export type HostedConfig = z.input<typeof HostedSchema>;

export function accessFromEnv(env: NodeJS.ProcessEnv = process.env): HostedConfig | undefined {
  const { TARE_PUBLIC_ORIGIN: origin, TARE_API_KEYS: keys, TARE_REQUESTS_PER_MINUTE: rate } = env;
  if (origin === undefined && keys === undefined && rate === undefined) return undefined;
  try {
    return HostedSchema.parse({ origin, keys: JSON.parse(keys ?? ''),
      ...(rate === undefined ? {} : { requestsPerMinute: Number(rate) }) });
  } catch {
    throw new Error('Hosted access requires an HTTPS TARE_PUBLIC_ORIGIN, unique TARE_API_KEYS and a valid request limit.');
  }
}

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Single-process quotas keyed by configured clients, never by spoofable forwarded IPs. */
export class ApiAccess {
  readonly origin: string | undefined;
  private readonly clients;
  private readonly limit;
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(input?: HostedConfig, private readonly now = Date.now) {
    const config = input === undefined ? undefined : HostedSchema.parse(input);
    this.origin = config?.origin;
    this.limit = config?.requestsPerMinute ?? 60;
    this.clients = Object.entries(config?.keys ?? {}).map(([id, key]) => ({ id, hash: digest(key) }));
  }

  check(request: IncomingMessage, protectedRoute: boolean) {
    const localHosts = [`127.0.0.1:${request.socket.localPort}`, `localhost:${request.socket.localPort}`];
    const hosts = this.origin ? [new URL(this.origin).host] : localHosts;
    const origins = this.origin ? [this.origin] : localHosts.map(host => `http://${host}`);
    if (!hosts.includes(request.headers.host ?? '')
      || (request.headers.origin && !origins.includes(request.headers.origin))
      || request.headers['sec-fetch-site'] === 'cross-site') {
      throw new ServiceError(403, 'untrusted-origin', 'Request Host or Origin is not allowed.');
    }
    if (!this.origin || !protectedRoute) return;
    const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/i.exec(request.headers.authorization ?? '');
    const hash = digest(match?.[1] ?? '');
    const client = this.clients.find(candidate => timingSafeEqual(candidate.hash, hash));
    if (!match || !client) throw new ServiceError(401, 'unauthorized', 'A valid Tare API access token is required.');
    const now = this.now();
    let window = this.windows.get(client.id);
    if (!window || now - window.start >= 60000 || now < window.start) {
      window = { start: now, count: 0 };
      this.windows.set(client.id, window);
    }
    if (window.count >= this.limit) throw new ServiceError(429, 'rate-limited', 'Client request limit reached; retry after one minute.');
    window.count++;
  }
}

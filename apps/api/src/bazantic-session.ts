import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod/v4';

const SessionPayloadSchema = z.strictObject({
  version: z.literal(1),
  issuer: z.literal('tare'),
  audience: z.literal('explore'),
  network: z.literal('base-sepolia'),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  sessionId: z.string().regex(/^[0-9a-f]{32}$/),
}).refine(value => value.expiresAt > value.issuedAt);

export const BazanticSandboxSchema = z.strictObject({
  clientId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  sessionSecret: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  gatewayUrl: z.url().refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && value === url.origin;
  }),
  sessionMinutes: z.number().int().min(1).max(60).default(15),
});

export type BazanticSandboxConfig = z.input<typeof BazanticSandboxSchema>;

type SessionPayload = z.output<typeof SessionPayloadSchema>;

const encode = (value: string | Buffer) => Buffer.from(value).toString('base64url');

function decodeCanonical(value: string) {
  const decoded = Buffer.from(value, 'base64url');
  return decoded.toString('base64url') === value ? decoded : undefined;
}

export class BazanticSandboxSessions {
  readonly clientId: string;
  readonly gatewayUrl: string;
  readonly sessionSeconds: number;
  private readonly secret: string;

  constructor(input: BazanticSandboxConfig) {
    const config = BazanticSandboxSchema.parse(input);
    this.clientId = config.clientId;
    this.gatewayUrl = config.gatewayUrl;
    this.sessionSeconds = config.sessionMinutes * 60;
    this.secret = config.sessionSecret;
  }

  issue(nowMs: number) {
    const issuedAt = Math.floor(nowMs / 1000);
    const payload: SessionPayload = {
      version: 1,
      issuer: 'tare',
      audience: 'explore',
      network: 'base-sepolia',
      issuedAt,
      expiresAt: issuedAt + this.sessionSeconds,
      sessionId: randomBytes(16).toString('hex'),
    };
    const encodedPayload = encode(JSON.stringify(payload));
    return {
      token: `tare_sandbox_v1.${encodedPayload}.${this.sign(encodedPayload)}`,
      payload,
    };
  }

  verify(token: string, nowMs: number): SessionPayload | undefined {
    const match = /^tare_sandbox_v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(token);
    if (!match) return undefined;
    const encodedPayload = match[1]!;
    const payloadBytes = decodeCanonical(encodedPayload);
    const supplied = decodeCanonical(match[2]!);
    if (!payloadBytes || !supplied) return undefined;
    const expected = Buffer.from(this.sign(encodedPayload), 'base64url');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return undefined;
    try {
      const payload = SessionPayloadSchema.parse(JSON.parse(payloadBytes.toString('utf8')));
      const now = Math.floor(nowMs / 1000);
      if (payload.issuedAt > now + 30 || payload.expiresAt <= now) return undefined;
      return payload;
    } catch {
      return undefined;
    }
  }

  private sign(payload: string) {
    return createHmac('sha256', this.secret).update(`tare_sandbox_v1.${payload}`).digest('base64url');
  }
}

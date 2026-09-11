const allowedHosts = new Set(['127.0.0.1', '::1', '0.0.0.0']);

export interface ApiRuntime {
  host: string;
  port: number;
}

/** Resolve listen settings while keeping accidental unauthenticated public binds closed. */
export function runtimeFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  hosted = false,
): ApiRuntime {
  const port = Number(env.TARE_PORT ?? env.PORT ?? '4318');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('TARE_PORT or PORT must be an integer from 1 to 65535.');
  }
  const host = env.TARE_BIND_HOST ?? '127.0.0.1';
  if (!allowedHosts.has(host)) {
    throw new Error('TARE_BIND_HOST must be 127.0.0.1, ::1 or 0.0.0.0.');
  }
  if (host === '0.0.0.0' && !hosted) {
    throw new Error('A public bind requires hosted access configuration.');
  }
  return { host, port };
}

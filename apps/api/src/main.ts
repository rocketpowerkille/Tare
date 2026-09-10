import { createApiServer } from './server.js';
import { TareService, configFromEnv } from '../../../packages/service/src/index.js';
import { accessFromEnv } from './access.js';

const port = Number(process.env.TARE_PORT ?? '4318');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('TARE_PORT must be 1–65535.');
const hosted = accessFromEnv();
const server = createApiServer(new TareService(configFromEnv()), hosted);
server.on('error', () => { console.error('Tare could not listen; check TARE_PORT and whether it is already in use.'); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(hosted
  ? `Tare hosted API ready for its HTTPS reverse proxy on local port ${port}`
  : `Tare explorer: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { server.close(); server.closeAllConnections(); });
}

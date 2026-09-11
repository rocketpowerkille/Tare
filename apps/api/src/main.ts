import { createApiServer } from './server.js';
import { TareService, configFromEnv } from '../../../packages/service/src/index.js';
import { accessFromEnv } from './access.js';
import { runtimeFromEnv } from './runtime.js';

const hosted = accessFromEnv();
const { host, port } = runtimeFromEnv(process.env, hosted !== undefined);
const server = createApiServer(new TareService(configFromEnv()), hosted);
server.on('error', () => { console.error('Tare could not listen; check its bind host, port and whether the port is already in use.'); process.exitCode = 1; });
server.listen(port, host, () => console.log(hosted
  ? `Tare hosted API ready behind its HTTPS ingress on ${host}:${port}`
  : `Tare explorer: http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { server.close(); server.closeAllConnections(); });
}

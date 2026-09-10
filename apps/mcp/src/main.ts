import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createMcpServer } from './server.js';
import { TareService, configFromEnv } from '../../../packages/service/src/index.js';

const service = new TareService(configFromEnv());
serveStdio(() => createMcpServer(service));

import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeFromEnv } from '../apps/api/src/runtime.js';

test('API runtime defaults to loopback and accepts platform PORT', () => {
  assert.deepEqual(runtimeFromEnv({}), { host: '127.0.0.1', port: 4318 });
  assert.deepEqual(runtimeFromEnv({ PORT: '10000' }), { host: '127.0.0.1', port: 10000 });
  assert.deepEqual(runtimeFromEnv({ PORT: '10000', TARE_PORT: '4320' }), {
    host: '127.0.0.1', port: 4320,
  });
});

test('API runtime permits an external bind only with hosted access', () => {
  const env = { TARE_BIND_HOST: '0.0.0.0', PORT: '10000' };
  assert.throws(() => runtimeFromEnv(env), /public bind requires hosted access/);
  assert.deepEqual(runtimeFromEnv(env, true), { host: '0.0.0.0', port: 10000 });
});

test('API runtime rejects unsafe hosts and invalid ports', () => {
  assert.throws(() => runtimeFromEnv({ TARE_BIND_HOST: 'example.com' }, true), /TARE_BIND_HOST/);
  for (const port of ['0', '65536', '1.5', 'invalid']) {
    assert.throws(() => runtimeFromEnv({ TARE_PORT: port }), /integer from 1 to 65535/);
  }
});

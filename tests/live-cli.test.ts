import test from 'node:test';
import assert from 'node:assert/strict';
import { withServer, json } from './helpers/http.js';
import { fixture, replayHandler } from './helpers/morpho.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { LiveReceiptSchema } from '../packages/domain/src/live.js';
import { runCli as cli } from './helpers/cli.js';
import { capturePath } from './helpers/morpho.js';

test('CLI live path and offline replay export validated receipts without overwriting', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tare-phase3-'));
  try {
    const capture = await fixture();
    await withServer(replayHandler(capture), async url => {
      const out = join(directory, 'receipt.json'); const saved = join(directory, 'capture.json');
      const args = ['live', 'resolve', '--address', capture.owner, '--vault', capture.vault, '--rpc-url', url, '--graphql-url', url, '--json', '--out', out, '--capture-out', saved];
      const result = await cli(args);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(LiveReceiptSchema.parse(JSON.parse(result.stdout)).kind, 'complete');
      const replay = await cli(['live', 'replay', saved, '--json']);
      assert.equal(replay.code, 0, replay.stderr);
      assert.equal(LiveReceiptSchema.parse(JSON.parse(replay.stdout)).sourceMode, 'recorded-rpc');
      assert.equal((await cli(args)).code, 1);
    });
    assert.equal((await cli(['live', 'replay', capturePath, '--max-markets', '1', '--json'])).code, 2);
    assert.equal((await cli(['live', 'resolve', '--chain-id', '8453'])).code, 1);
    assert.equal((await cli(['live', 'replay', capturePath, '--rpc-url', 'http://example.invalid'])).code, 1);
    let requests = 0;
    await withServer((_body, response) => { requests++; json(response, {}); }, async url => {
      const invalid = await cli(['live', 'example', '--graphql-url', url, '--rpc-url', url, '--max-calls', '1001']);
      assert.equal(invalid.code, 1); assert.equal(requests, 0, 'Invalid options must fail before discovery');
    });
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith('tare-phase3-'));
    await rm(directory, { recursive: true, force: true });
  }
});

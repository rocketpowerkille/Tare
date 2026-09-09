import test from 'node:test';
import assert from 'node:assert/strict';
import { runCliSync as cli } from './helpers/cli.js';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { ReceiptSchema } from '../packages/domain/src/index.js';
import { readJsonFile } from '../packages/sources/src/snapshot.js';

async function cleanup(directory: string) {
  const absolute = resolve(directory);
  assert.equal(dirname(absolute), resolve(tmpdir()));
  assert.ok(basename(absolute).startsWith('tare-'));
  await rm(absolute, { recursive: true, force: true });
}
test('CLI runs help, validates input and demonstrates all four cases from another directory', () => {
  assert.match(cli(['--help']).stdout, /exposure CLI/);
  const demos = cli(['demo', 'all', '--json'], tmpdir());
  assert.equal(demos.status, 0, demos.stderr);
  assert.equal(JSON.parse(demos.stdout).length, 4);
  assert.equal(cli(['snapshot', 'validate', 'fixtures/synthetic/control.json']).status, 0);
  for (const args of [['demo', 'unknown'], ['resolve'], ['demo', '--wallet', 'test'], ['wallet', 'list', 'extra'], ['resolve', 'fixtures/synthetic/control.json', '--max-depth', '1.5']]) {
    assert.equal(cli(args).status, 1);
  }
});
test('CLI emits valid receipts and distinguishes partial from malformed input', () => {
  const complete = cli(['resolve', 'fixtures/synthetic/control.json', '--json']);
  assert.equal(complete.status, 0, complete.stderr);
  assert.equal(ReceiptSchema.parse(JSON.parse(complete.stdout)).kind, 'complete');
  const partial = cli(['resolve', 'fixtures/synthetic/degraded.json', '--json']);
  assert.equal(partial.status, 2, partial.stderr);
  assert.equal(ReceiptSchema.parse(JSON.parse(partial.stdout)).kind, 'partial');
  const bad = cli(['resolve', 'missing-file.json', '--json']);
  assert.equal(bad.status, 1);
  assert.equal(bad.stdout, '');
});
test('watch-only profile lifecycle and wallet-bound resolution are local and reject mismatched identities', async () => {
  const home = await mkdtemp(join(tmpdir(), 'tare-wallet-test-'));
  try {
    const run = (...args: string[]) => cli([...args, '--home', home]);
    assert.deepEqual(JSON.parse(run('wallet', 'list').stdout), []);
    const args = ['wallet', 'add', 'metamask', '--address', `0x${'11'.repeat(20)}`, '--chain-id', '1'];
    assert.equal(run(...args).status, 0);
    assert.equal(run(...args).status, 1, 'Existing profile must not be overwritten');
    assert.equal(JSON.parse(run('wallet', 'show', 'metamask').stdout).mode, 'watch-only');
    assert.equal(run('wallet', 'balance', 'metamask').status, 1, 'Balance reads require an explicit RPC endpoint');
    assert.equal(run('resolve', 'fixtures/synthetic/control.json', '--wallet', 'metamask').status, 0);
    assert.equal(run('wallet', 'add', 'base', '--address', `0x${'11'.repeat(20)}`, '--chain-id', '8453').status, 0);
    assert.equal(run('resolve', 'fixtures/synthetic/control.json', '--wallet', 'base').status, 1);
    assert.equal(run('wallet', 'add', 'other', '--address', `0x${'22'.repeat(20)}`, '--chain-id', '1').status, 0);
    assert.equal(run('resolve', 'fixtures/synthetic/control.json', '--wallet', 'other').status, 1);
    assert.equal(run('wallet', 'show', '../escape').status, 1);
    assert.equal(run('wallet', 'add', 'secret', '--address', `0x${'33'.repeat(32)}`, '--chain-id', '1').status, 1);
    assert.equal(run('wallet', 'remove', 'metamask').status, 0);
    assert.equal(run('wallet', 'show', 'metamask').status, 1);
  } finally { await cleanup(home); }
});
test('receipt exports never overwrite and bounded JSON input rejects oversized or malformed files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tare-output-test-'));
  try {
    const path = join(directory, 'receipt.json');
    const args = ['resolve', 'fixtures/synthetic/control.json', '--out', path];
    assert.equal(cli(args).status, 0);
    const before = await readFile(path, 'utf8');
    assert.equal(cli(args).status, 1);
    assert.equal(await readFile(path, 'utf8'), before);
    await writeFile(path, '{invalid');
    await assert.rejects(readJsonFile(path), /not valid JSON/);
    await writeFile(path, ' '.repeat(1025));
    await assert.rejects(readJsonFile(path, 1024), /exceeds/);
    assert.equal(cli(['resolve', path]).status, 1);
  } finally { await cleanup(directory); }
});

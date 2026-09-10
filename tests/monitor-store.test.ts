import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { openStore, loadState } from '../packages/monitor/src/store.js';
import { advance } from '../packages/monitor/src/engine.js';
import { runMonitor } from '../packages/monitor/src/worker.js';
import { monitorFixture } from './helpers/monitor.js';
import { runCliSync } from './helpers/cli.js';

async function inStore(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'tare-monitor-'));
  try { await run(directory); }
  finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('tare-monitor-'));
    await rm(directory, { recursive: true, force: true });
  }
}

test('monitor atomically persists evidence and cursor; lock excludes a second worker', async () => inStore(async directory => {
  const f = await monitorFixture();
  const store = await openStore(directory, f.state);
  try {
    await assert.rejects(openStore(directory, f.state), { code: 'EEXIST' });
    const next = await advance(store.state, f.frame, f.evaluate);
    await store.commit(next.state, next.evidence);
    assert.deepEqual(await loadState(directory), next.state);
    const captures = await readdir(join(directory, 'captures'));
    assert.equal(captures.length, 1);
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'captures', captures[0]!), 'utf8')), next.evidence);
    await store.commit(next.state, next.evidence);
    await writeFile(join(directory, 'captures', captures[0]!), 'corrupt');
    await assert.rejects(store.commit(next.state, next.evidence), /corrupt/);
  } finally { await store.close(); }
  const resumed = await openStore(directory, f.state);
  try { assert.equal(resumed.state.cursor, f.frame.cursor); }
  finally { await resumed.close(); }
  await assert.rejects(openStore(directory, { ...f.state, scope: 'different' }), /different position/);
  assert.ok(!(await readdir(directory)).includes('worker.lock'));
}));

test('worker commits before emitting and never advances on failed evaluation or commit', async () => inStore(async directory => {
  const f = await monitorFixture();
  const store = await openStore(directory, f.state);
  const stream = async function* () { yield f.frame; yield f.frame; };
  try {
    await assert.rejects(runMonitor(store, stream, async () => { throw new Error('failed read'); },
      { signal: new AbortController().signal, maxBlocks: 2 }, () => assert.fail('unexpected alert')), /failed read/);
    await assert.rejects(loadState(directory), { code: 'ENOENT' });
    let emitted = 0;
    const result = await runMonitor(store, stream, f.evaluate, { signal: new AbortController().signal, maxBlocks: 2 }, alerts => { emitted += alerts.length; });
    assert.equal(emitted, 1);
    assert.equal(result.cursor, f.frame.cursor);
    assert.equal((await loadState(directory)).cursor, f.frame.cursor);
    await assert.rejects(runMonitor({ ...store, commit: async () => { throw new Error('disk full'); } }, stream, f.evaluate,
      { signal: new AbortController().signal, maxBlocks: 1 }, () => assert.fail('uncommitted alert')), /disk full/);
  } finally { await store.close(); }
}));

test('CLI replays monitor evidence offline, exposes checkpoint status and rejects invalid commands', async () => inStore(async directory => {
  const f = await monitorFixture();
  const recording = join(directory, 'recording.json');
  await writeFile(recording, JSON.stringify({ version: 1, sourceMode: 'recorded-substreams', position: f.position,
    startBlock: f.frame.block.number, frames: [{ frame: f.frame, evidence: f.evidence }, { frame: f.frame }] }));
  const result = runCliSync(['monitor', 'replay', recording]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).alerts.length, 1);
  assert.equal(JSON.parse(result.stdout).sourceMode, 'recorded-substreams');
  const store = await openStore(directory, f.state);
  try {
    const next = await advance(store.state, f.frame, f.evaluate);
    await store.commit(next.state, next.evidence);
  } finally { await store.close(); }
  const status = runCliSync(['monitor', 'status', '--home', directory]);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).cursor, f.frame.cursor);
  for (const args of [['monitor', 'unknown'], ['monitor', 'status'], ['monitor', 'replay', recording, '--out', 'x'], ['monitor', 'run']]) {
    assert.equal(runCliSync(args).status, 1);
  }
}));

test('worker reconnects from the committed cursor and rejects blocks past its requested end', async () => inStore(async directory => {
  const f = await monitorFixture();
  const store = await openStore(directory, f.state);
  const cursors: string[] = [];
  let calls = 0;
  const stream = async function* (cursor: string) {
    cursors.push(cursor);
    if (++calls === 1) { yield f.frame; throw new Error('disconnected'); }
    yield { ...f.frame, cursor: 'resumed' };
  };
  try {
    const state = await runMonitor(store, stream, f.evaluate,
      { signal: new AbortController().signal, maxBlocks: 2 }, () => {});
    assert.deepEqual(cursors, ['', f.frame.cursor]);
    assert.equal(state.cursor, 'resumed');
    await assert.rejects(runMonitor(store, stream, f.evaluate, { signal: new AbortController().signal,
      maxBlocks: 1, stopBlock: f.frame.block.number }, () => assert.fail('unexpected alert')), /outside the requested range/);
    assert.equal((await loadState(directory)).cursor, 'resumed');
  } finally { await store.close(); }
}));

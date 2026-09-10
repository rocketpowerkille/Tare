import { mkdir, open, rename, unlink, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readJsonFile } from '../../sources/src/snapshot.js';
import { evidenceDigest } from '../../sources/src/recorded.js';
import { State } from './model.js';

export async function loadState(directory: string): Promise<State> {
  return State.parse(await readJsonFile(join(directory, 'state.json'), 16 * 1024 * 1024));
}

/** Hold the lock for the worker lifetime. Never steal a lock left by a crashed process. */
export async function openStore(directory: string, initial: State) {
  await mkdir(directory, { recursive: true });
  const lockPath = join(directory, 'worker.lock');
  const lock = await open(lockPath, 'wx', 0o600);
  try {
    await lock.writeFile(String(process.pid));
    let state = initial;
    try { state = await loadState(directory); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    if (state.scope !== initial.scope) throw new Error('Monitor checkpoint belongs to a different position, provider or stream configuration');
    return {
      state,
      async commit(next: State, evidence?: unknown) {
        const validated = State.parse(next);
        if (validated.scope !== initial.scope) throw new Error('Monitor checkpoint scope changed');
        if (evidence !== undefined) {
          const captureDir = join(directory, 'captures');
          await mkdir(captureDir, { recursive: true });
          const capturePath = join(captureDir, `${evidenceDigest(evidence).slice(7)}.json`);
          const text = `${JSON.stringify(evidence)}\n`;
          try { await durableWrite(capturePath, text); }
          catch (error) {
            if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
            if (await readFile(capturePath, 'utf8') !== text) throw new Error('Existing monitor capture is corrupt');
          }
        }
        const temp = join(directory, `state-${randomUUID()}.tmp`);
        try {
          await durableWrite(temp, `${JSON.stringify(validated)}\n`);
          await rename(temp, join(directory, 'state.json'));
        } finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
      },
      async close() { await lock.close(); await unlink(lockPath); },
    };
  } catch (error) { await lock.close(); await unlink(lockPath); throw error; }
}

async function durableWrite(path: string, text: string) {
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(text); await file.sync(); }
  finally { await file.close(); }
}

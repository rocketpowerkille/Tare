import { open } from 'node:fs/promises';
import { z } from 'zod/v4';
import { SnapshotSchema } from '../../domain/src/index.js';
import { SnapshotV2Schema } from '../../domain/src/v2.js';

// Bound reads before JSON parsing; profiles reuse the same local-file boundary.
export async function readJsonFile(path: string, maxBytes = 5 * 1024 * 1024): Promise<unknown> {
  const file = await open(path, 'r');
  try {
    if (!(await file.stat()).isFile()) throw new Error('Input must be a regular file');
    const buffer = Buffer.alloc(maxBytes + 1);
    let count = 0;
    while (count < buffer.length) {
      const { bytesRead } = await file.read(buffer, count, buffer.length - count, null);
      if (bytesRead === 0) break;
      count += bytesRead;
    }
    if (count > maxBytes) throw new Error(`Input exceeds ${maxBytes} bytes`);
    try { return JSON.parse(buffer.subarray(0, count).toString('utf8')) as unknown; }
    catch { throw new Error('Input is not valid JSON'); }
  } finally { await file.close(); }
}

export async function loadSnapshot(path: string) {
  return SnapshotSchema.parse(await readJsonFile(path));
}

export async function loadInputSnapshot(path: string) {
  return z.union([SnapshotSchema, SnapshotV2Schema]).parse(await readJsonFile(path));
}

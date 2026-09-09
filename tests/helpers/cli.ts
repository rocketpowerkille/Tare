import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const cliPath = resolve('dist/apps/cli/src/main.js');

export function runCliSync(args: string[], cwd = process.cwd()) {
  return spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8', cwd, timeout: 10000 });
}

export function runCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], { timeout: 30000 });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

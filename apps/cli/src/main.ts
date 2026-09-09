#!/usr/bin/env node
import { ZodError } from 'zod/v4';
import { parseCliArgs } from './args.js';
import { help } from './help.js';
import { runDemoCommand } from './demo.js';
import { runLiveCommand } from './live.js';
import { runSnapshotCommand } from './snapshot.js';
import { runVerifyCommand } from './verify.js';
import { runWalletCommand } from './wallet.js';

async function main(): Promise<number> {
  const { values, positionals } = parseCliArgs();
  if (values.help || positionals.length === 0) {
    console.log(help);
    return 0;
  }
  switch (positionals[0]) {
    case 'demo': return runDemoCommand(positionals, values);
    case 'live': return runLiveCommand(positionals, values);
    case 'verify': return runVerifyCommand(positionals, values);
    case 'wallet': return runWalletCommand(positionals, values);
    case 'snapshot':
    case 'resolve':
    case 'replay': return runSnapshotCommand(positionals, values);
    default: throw new Error('Unknown command; use --help');
  }
}

try { process.exitCode = await main(); }
catch (error) {
  // Do not echo rejected inputs: users can accidentally paste credentials into an argument.
  const message = error instanceof ZodError
    ? `Validation failed: ${error.issues.map(issue => `${issue.path.join('.') || 'input'}: ${issue.message}`).join('; ')}`
    : error instanceof Error && 'code' in error
      ? `Operation failed (${String(error.code)}); check command options, local paths and existing files`
      : error instanceof Error ? error.message : 'Unknown failure';
  console.error(`tare: ${message}`);
  process.exitCode = 1;
}

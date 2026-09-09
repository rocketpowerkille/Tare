import { parseArgs } from 'node:util';

export function required(value: string | undefined, label: string): string {
  if (!value) throw new Error(`Missing ${label}; use --help`);
  return value;
}
export function integer(value: string | undefined, label: string): number {
  if (!value || !/^[1-9][0-9]*$/.test(value)) throw new Error(`${label} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} exceeds the safe integer range`);
  return parsed;
}
export function nonnegativeInteger(value: string | undefined, label: string): number {
  if (value === undefined || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`${label} must be a nonnegative integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} exceeds the safe integer range`);
  return parsed;
}
export function parseCliArgs() {
  return parseArgs({
    allowPositionals: true, strict: true,
    options: {
      help: { type: 'boolean', short: 'h' }, json: { type: 'boolean' }, out: { type: 'string' },
      home: { type: 'string' }, address: { type: 'string' }, 'chain-id': { type: 'string' },
      wallet: { type: 'string' }, 'max-depth': { type: 'string' }, 'max-visits': { type: 'string' },
      'rpc-url': { type: 'string' }, symbol: { type: 'string' }, decimals: { type: 'string' },
      'timeout-ms': { type: 'string' },
      'max-edges': { type: 'string' },
      vault: { type: 'string' }, 'graphql-url': { type: 'string' }, 'max-positions': { type: 'string' },
      'capture-out': { type: 'string' }, 'block-number': { type: 'string' }, 'max-markets': { type: 'string' },
      'max-calls': { type: 'string' }, 'deadline-ms': { type: 'string' },
      'graph-url': { type: 'string' }, 'graph-deployment': { type: 'string' },
      'secondary-rpc-url': { type: 'string' },
    },
  });
}

export type CliValues = ReturnType<typeof parseCliArgs>['values'];

export function allowOptions(values: CliValues, positionals: string[], options: string[], maxPositionals: number): void {
  for (const key of Object.keys(values)) {
    if (!options.includes(key)) throw new Error(`Option --${key} is not supported for this command`);
  }
  if (positionals.length > maxPositionals) throw new Error('Unexpected positional arguments');
}

export type Values = Record<string, string | boolean | undefined>;

export function stringOption(values: Values, name: string): string | undefined {
  const value = values[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value) throw new Error(`--${name} requires a value`);
  return value;
}

export function integerOption(values: Values, name: string, fallback: number): number {
  const value = stringOption(values, name);
  if (value === undefined) return fallback;
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`--${name} requires a positive integer`);
  }
  return Number(value);
}

import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod/v4';
import { AddressSchema, ChainIdSchema } from '../../domain/src/index.js';
import { readJsonFile } from '../../sources/src/snapshot.js';

const NameSchema = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/, 'Use a lowercase name starting with a letter (up to 40 letters, digits or hyphens)');
export const WalletSchema = z.strictObject({ schemaVersion: z.literal(1), mode: z.literal('watch-only'), name: NameSchema, address: AddressSchema, chainId: ChainIdSchema });
export type Wallet = z.infer<typeof WalletSchema>;
function walletDirectory(home: string) { return resolve(home, 'wallets'); }
function walletPath(home: string, name: string) { return resolve(walletDirectory(home), `${NameSchema.parse(name)}.json`); }
export async function addWallet(home: string, input: unknown): Promise<Wallet> {
  const wallet = WalletSchema.parse(input);
  await mkdir(walletDirectory(home), { recursive: true, mode: 0o700 });
  await writeFile(walletPath(home, wallet.name), `${JSON.stringify(wallet, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return wallet;
}
export async function getWallet(home: string, name: string): Promise<Wallet> {
  const wallet = WalletSchema.parse(await readJsonFile(walletPath(home, name), 16384));
  if (wallet.name !== name) throw new Error('Wallet profile name does not match its filename');
  return wallet;
}
export async function listWallets(home: string): Promise<Wallet[]> {
  let entries: string[];
  try { entries = await readdir(walletDirectory(home)); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []; throw error; }
  const wallets: Wallet[] = [];
  for (const entry of entries.sort()) if (entry.endsWith('.json')) wallets.push(await getWallet(home, entry.slice(0, -5)));
  return wallets;
}
export async function removeWallet(home: string, name: string): Promise<void> { await unlink(walletPath(home, name)); }

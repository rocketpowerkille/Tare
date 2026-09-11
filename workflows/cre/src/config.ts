import { z } from 'zod';

const Address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(value => value.toLowerCase());
const Raw = z.string().regex(/^(0|[1-9][0-9]{0,77})$/).refine(value => BigInt(value) < 2n ** 256n);
function isAnalyzeEndpoint(value: string): boolean {
  const match = /^(https?):\/\/([A-Za-z0-9.-]+)(?::([1-9][0-9]{0,4}))?\/api\/analyze$/.exec(value);
  if (!match || (match[3] !== undefined && Number(match[3]) > 65535)) return false;
  const [, protocol, hostname] = match;
  const labels = hostname!.split('.');
  const validHostname = hostname!.length <= 253 && labels.every(label =>
    /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label));
  if (!validHostname) return false;
  return protocol === 'https' || hostname === '127.0.0.1' || hostname === 'localhost';
}

export const configSchema = z.object({
  schedule: z.string().min(1).max(100),
  apiUrl: z.string().refine(isAnalyzeEndpoint,
    'Use an HTTPS Tare analyze endpoint, or HTTP loopback for local simulation'),
  owner: Address, vault: Address, graphDeployment: z.string().min(10).max(128),
  policySecretId: z.string().min(1).max(100), apiSecretId: z.string().min(1).max(100),
  execution: z.object({ enabled: z.boolean().default(false), receiver: Address, shares: Raw, minAssets: Raw,
    nonce: Raw, validUntil: Raw }).strict(),
}).strict();
export type Config = z.infer<typeof configSchema>;

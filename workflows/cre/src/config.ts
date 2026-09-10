import { z } from 'zod';

const Address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(value => value.toLowerCase());
const Raw = z.string().regex(/^(0|[1-9][0-9]{0,77})$/).refine(value => BigInt(value) < 2n ** 256n);
export const configSchema = z.object({
  schedule: z.string().min(1).max(100),
  apiUrl: z.string().url().refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/api/analyze';
  }, 'Use the HTTPS Tare analyze endpoint without embedded credentials'),
  owner: Address, vault: Address, graphDeployment: z.string().min(10).max(128),
  policySecretId: z.string().min(1).max(100), apiSecretId: z.string().min(1).max(100),
  execution: z.object({ enabled: z.boolean().default(false), receiver: Address, shares: Raw, minAssets: Raw,
    nonce: Raw, validUntil: Raw }).strict(),
}).strict();
export type Config = z.infer<typeof configSchema>;

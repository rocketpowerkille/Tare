export type SourceFailureCode = 'timeout' | 'network' | 'http' | 'oversized' | 'invalid-json' | 'invalid-response' | 'rpc-error' | 'graphql-error' | 'budget' | 'reorg';
export class SourceFailure extends Error {
  constructor(readonly code: SourceFailureCode, message: string) { super(message); }
}
export function validateHttpUrl(input: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('Source URL must be a valid HTTP(S) URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('Source URL must use HTTP(S) without embedded credentials or a fragment');
  return url.toString();
}

/** Enforces a byte bound while streaming, not after buffering a provider response. */
export async function postJson(url: string, body: unknown, timeoutMs: number, maxBytes = 1024 * 1024, authorization?: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(validateHttpUrl(url), {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', ...(authorization ? { authorization } : {}) },
      body: JSON.stringify(body), signal: controller.signal, redirect: 'error',
    });
    if (!response.ok) { await response.body?.cancel(); throw new SourceFailure('http', `Source returned HTTP ${response.status}`); }
    const reader = response.body?.getReader();
    if (!reader) throw new SourceFailure('invalid-response', 'Source returned an empty body');
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > maxBytes) { await reader.cancel(); throw new SourceFailure('oversized', 'Source response exceeded its byte budget'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
    catch { throw new SourceFailure('invalid-json', 'Source returned invalid JSON'); }
  } catch (error) {
    if (error instanceof SourceFailure) throw error;
    if (controller.signal.aborted) throw new SourceFailure('timeout', 'Source request timed out');
    // URLs, provider error messages and response bodies can contain provider tokens.
    throw new SourceFailure('network', 'Source request failed');
  } finally { clearTimeout(timer); }
}

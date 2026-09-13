const key = 'tare-access-session';

/** Tab-scoped convenience only; the API validates authorization on every request. */
export function readAccessSession(): string {
  try { return sessionStorage.getItem(key) ?? ''; }
  catch { return ''; }
}

export function saveAccessSession(token: string) {
  try {
    if (token) sessionStorage.setItem(key, token);
    else sessionStorage.removeItem(key);
  } catch { /* In-memory access still works when browser storage is disabled. */ }
}

export function clearRejectedSession(token: string) {
  if (readAccessSession() === token) saveAccessSession('');
}

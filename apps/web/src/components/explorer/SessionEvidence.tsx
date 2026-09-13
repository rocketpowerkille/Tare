import { record, text } from '../../lib/types';
import { displayTimestamp } from '../../lib/report-display';
import { StatusBadge } from '../StatusBadge';
import { CopyValue } from '../CopyValue';

/** Called only after the API accepts the token. Claims are not a settlement receipt. */
export function SessionEvidence({ token }: { token: string }) {
  if (!token.startsWith('tare_sandbox_v1.')) return null;
  let claims;
  try { claims = record(JSON.parse(atob(token.split('.')[1]!.replaceAll('-', '+').replaceAll('_', '/')))); }
  catch { return null; }
  return <section className="session-evidence" aria-label="Payment authorization evidence">
    <div><p className="section-label">Bazantic · Authorization evidence</p><StatusBadge tone="success">Session accepted by API</StatusBadge></div>
    <h2>Payment authorization received</h2>
    <p>Network: <code>{text(claims.network) ?? 'Unavailable'}</code> · Issued: {displayTimestamp(claims.issuedAt) ?? 'Unavailable'} · Expires: {displayTimestamp(claims.expiresAt) ?? 'Unavailable'}</p>
    <p>Session ID: {text(claims.sessionId) ? <CopyValue value={String(claims.sessionId)} label="session ID" /> : 'Unavailable'}</p>
    <details><summary>Session and receipt details</summary><p>Payment amount, asset and settlement receipt are not included in this access token. Keep the original Bazantic purchase response as payment evidence.</p></details>
    <small>Authorization grants access. It does not verify custody, backing or protocol solvency.</small>
  </section>;
}

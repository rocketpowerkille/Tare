import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod/v4';
import { investigationFacts, compareInvestigationReports } from '../../../packages/receipts/src/investigation.js';
import { ServiceError } from '../../../packages/service/src/requests.js';

export const ReferenceInput = z.strictObject({ reference: z.string().regex(/^[a-f0-9]{48}$/), page: z.number().int().min(0).max(63).default(0) });
export const SnapshotInput = z.strictObject({ report: z.record(z.string(), z.json()), previous: z.record(z.string(), z.json()).optional() });
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function rejectCredentials(value: unknown, depth = 0): void {
  if (depth > 40) throw new ServiceError(400, 'invalid-report', 'Report nesting exceeds the supported limit.');
  if (typeof value === 'string' && /tare_sandbox_v1\.|Bearer\s+[A-Za-z0-9._-]{20,}|-----BEGIN .*PRIVATE KEY-----/i.test(value)) {
    throw new ServiceError(400, 'sensitive-input', 'Remove access credentials from the report.');
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (/^(accessToken|apiKey|authorization|privateKey|seedPhrase|sessionSecret|password|providerToken)$/i.test(key)) {
      throw new ServiceError(400, 'sensitive-input', 'Do not submit credentials as report evidence.');
    }
    rejectCredentials(child, depth + 1);
  }
}

export type Snapshot = ReturnType<typeof buildSnapshot>;
function buildSnapshot(input: z.infer<typeof SnapshotInput>) {
  rejectCredentials(input);
  const current = investigationFacts(input.report);
  const facts = [...current.facts, ...(input.previous ? investigationFacts(input.previous, 'previous').facts : [])];
  const comparison = input.previous ? compareInvestigationReports(input.report, input.previous) : null;
  if (comparison) {
    const { changes, ...scope } = comparison.positionChanges;
    facts.push({ id: 'comparison.scope', category: 'notVerified', field: 'Two-block comparison scope', value: scope });
    changes.forEach((value, index) => facts.push({ id: `comparison.change.${index}`, category: 'derived', field: 'Two-block difference', value }));
  }
  return { digest: digest(input), facts, comparison, sourceMode: current.context.sourceMode,
    instructions: current.context.agentInstructions,
    provenanceNotice: 'Exact browser-submitted report snapshot. Submission is not independent authentication of its source claims. No new chain check is performed by storing or explaining it.',
    omissionNotice: current.context.detailPolicy,
  };
}

/** Bounded, process-local snapshots. References are random capabilities, never public report URLs. */
export class InvestigationStore {
  private readonly entries = new Map<string, { owner: string; snapshot: Snapshot; expires: number; readPages: Set<number> }>();
  constructor(private readonly now = Date.now) {}

  create(owner: string, input: unknown) {
    this.prune();
    if (Buffer.byteLength(JSON.stringify(input)) > 1_048_576) throw new ServiceError(413, 'report-too-large', 'Report context is limited to 1 MiB. Keep the full report download separately.');
    if (this.entries.size >= 64 || [...this.entries.values()].filter(entry => entry.owner === owner).length >= 8) {
      throw new ServiceError(429, 'snapshot-limit', 'Too many temporary report snapshots. Wait for an existing snapshot to expire.');
    }
    const snapshot = buildSnapshot(SnapshotInput.parse(input));
    if (snapshot.facts.length > 512 || Buffer.byteLength(JSON.stringify(snapshot)) > 512_000) {
      throw new ServiceError(413, 'context-too-large', 'Explain a smaller report or one position at a time. No context was silently truncated.');
    }
    const reference = randomBytes(24).toString('hex');
    const expires = this.now() + 10 * 60_000;
    this.entries.set(reference, { owner, snapshot, expires, readPages: new Set() });
    return { reference, expiresAt: new Date(expires).toISOString(), ...snapshot };
  }

  get(reference: string, owner: string) {
    const entry = this.entry(reference);
    if (entry.owner !== owner) throw new ServiceError(404, 'reference-unavailable', 'Report reference is unavailable or expired.');
    return entry.snapshot;
  }

  read(reference: string, page: number) {
    const entry = this.entry(reference);
    const pages = Math.ceil(entry.snapshot.facts.length / 8);
    if (page >= pages) throw new ServiceError(400, 'invalid-page', 'Report page is outside the available range.');
    entry.readPages.add(page);
    return { digest: entry.snapshot.digest, page, pages, expiresAt: new Date(entry.expires).toISOString(),
      provenanceNotice: entry.snapshot.provenanceNotice, omissionNotice: entry.snapshot.omissionNotice,
      instructions: entry.snapshot.instructions, comparison: entry.snapshot.comparison,
      facts: entry.snapshot.facts.slice(page * 8, (page + 1) * 8) };
  }

  allPagesRead(reference: string) {
    const coverage = this.readCoverage(reference);
    return coverage.retrievedPages === coverage.expectedPages;
  }

  readCoverage(reference: string) {
    const entry = this.entry(reference);
    return { expectedPages: Math.ceil(entry.snapshot.facts.length / 8), retrievedPages: entry.readPages.size };
  }

  resetReads(reference: string) { this.entry(reference).readPages.clear(); }

  private entry(reference: string) {
    this.prune();
    const entry = this.entries.get(reference);
    if (!entry) throw new ServiceError(404, 'reference-unavailable', 'Report reference is unavailable or expired.');
    return entry;
  }
  private prune() {
    for (const [key, entry] of this.entries) if (entry.expires <= this.now()) this.entries.delete(key);
  }
}

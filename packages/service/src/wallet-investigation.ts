import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import type { TareService } from './index.js';
import { publicError } from './requests.js';
import { positionValuationInput } from '../../domain/src/valuation-input.js';

export const WalletInvestigationInput = z.strictObject({ owner: AddressSchema });
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};

/** Bounded discovery -> eligible reads. Never loops trying to prove unsupported backing. */
export async function investigateWallet(service: TareService, input: unknown) {
  const { owner } = WalletInvestigationInput.parse(input);
  const discovery = object(await service.run('discover', { owner, maxPositions: 10 }));
  const positions = (Array.isArray(discovery.positions) ? discovery.positions : []).map(object);
  const supported = positions.filter(position => object(position.support).status === 'supported');
  const results: { vault: unknown; chainId: unknown; status: string; report?: unknown; reason?: string }[] = [];
  for (const candidate of supported.slice(0, 3)) {
    const operation = object(candidate.support).operation;
    try {
      const primary = object(await service.run('analyze', { operation, owner, vault: candidate.vault,
        ...(operation === 'resolve-v2' ? {} : { chainId: candidate.chainId }) }));
      const modules: Record<string, unknown>[] = [];
      if (operation === 'resolve-v1' && candidate.chainId === 1 && service.capabilities().live['verify-graph-composition']) {
        try {
          const report = object(await service.run('analyze', { operation: 'verify-graph-composition', owner, vault: candidate.vault }));
          modules.push({ id: 'the-graph', eligible: true, status: report.status, report });
        } catch { modules.push({ id: 'the-graph', eligible: true, status: 'unavailable' }); }
      }
      const valuation = positionValuationInput(primary, { operation: String(operation), chainId: Number(candidate.chainId) });
      if (valuation) {
        try {
          const report = await service.run('analyze', { operation: 'value-position', ...valuation });
          modules.push({ id: 'chainlink', eligible: true, status: 'verified', report });
        } catch { modules.push({ id: 'chainlink', eligible: true, status: 'unavailable' }); }
      }
      const status = modules.some(module => module.status === 'mismatch') ? 'mismatch'
        : modules.some(module => ['incomplete', 'unavailable'].includes(String(module.status))) ? 'incomplete' : String(primary.status ?? primary.kind ?? 'incomplete');
      results.push({ vault: candidate.vault, chainId: candidate.chainId, status,
        report: { reportType: 'comprehensive-position-check', status, primary, modules } });
    } catch (error) { results.push({ vault: candidate.vault, chainId: candidate.chainId, status: 'unavailable', reason: publicError(error).message }); }
  }
  return { reportType: 'wallet-investigation', owner, sourceMode: 'live-composed', capturedAt: new Date().toISOString(),
    status: results.some(result => result.status === 'mismatch') ? 'mismatch' : 'incomplete',
    discovery, results, skippedSupportedPositions: Math.max(0, supported.length - results.length),
    limitations: ['Discovery is not a complete inventory of the wallet. No results means no supported positions found, not no assets.',
      'At most three supported candidates are analyzed. Sources may use different blocks. Accounting and reference prices do not prove backing or safety.'] };
}

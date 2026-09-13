import { z } from 'zod/v4';
import { answerSections } from '../../../packages/receipts/src/investigation.js';

const Answer = z.strictObject({ sections: z.array(z.strictObject({ title: z.enum(answerSections),
  text: z.string().min(1).max(4000), citations: z.array(z.string().max(120)).min(1).max(32) })).length(7) });
export type AnswerSection = z.infer<typeof Answer>['sections'][number];

const descriptions = {
  'invalid-json': 'The answer was not valid JSON.',
  'invalid-answer-schema': 'The answer did not match the required seven-section format.',
  'missing-context-pages': 'Not all context pages were retrieved.',
  'section-order': 'The answer sections were not in the required order.',
  'unknown-citations': 'The answer cited fact IDs absent from this report.',
  'sensitive-output': 'The answer contained a temporary reference or credential-like text.',
} as const;
type ReviewReason = keyof typeof descriptions;

/** Return only fixed reasons and counts, never rejected model text or citation values. */
export function reviewInvestigationAnswer(output: unknown, factIds: Set<string>, reference: string,
  coverage: { expectedPages: number; retrievedPages: number }) {
  const reasons: ReviewReason[] = [];
  if (typeof output === 'string') {
    try { output = JSON.parse(output.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '')); }
    catch { reasons.push('invalid-json'); output = null; }
  }
  const parsed = Answer.safeParse(output);
  if (!parsed.success) reasons.push('invalid-answer-schema');
  if (coverage.retrievedPages !== coverage.expectedPages) reasons.push('missing-context-pages');
  let unknownCitationCount = 0;
  if (parsed.success) {
    if (parsed.data.sections.some((section, index) => section.title !== answerSections[index])) reasons.push('section-order');
    unknownCitationCount = parsed.data.sections.reduce((count, section) => count + section.citations.filter(id => !factIds.has(id)).length, 0);
    if (unknownCitationCount) reasons.push('unknown-citations');
    if (parsed.data.sections.some(section => section.text.includes(reference)
      || /tare_sandbox_v1\.|Bearer\s|-----BEGIN .*PRIVATE KEY-----/i.test(section.text))) reasons.push('sensitive-output');
  }
  return {
    sections: reasons.length === 0 && parsed.success ? parsed.data.sections : undefined,
    diagnostic: { reasons, ...coverage, unknownCitationCount },
    explanation: reasons.map(reason => descriptions[reason]).join(' '),
  };
}

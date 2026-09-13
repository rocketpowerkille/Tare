/** Accept a single explicit JSON answer, optionally fenced with model narration.
 * Never repair malformed JSON or search prose for arbitrary brace-delimited data.
 * Callers still apply the full answer schema and evidence validation afterward.
 */
export function parseRecipeAnswerJson(text: string): unknown {
  try { return JSON.parse(text); } catch { /* Try a single explicit code fence. */ }
  const fences = [...text.matchAll(/```(?:json)?[\t ]*\r?\n([\s\S]*?)\r?\n```/g)];
  if (fences.length !== 1) throw new Error('Expected exactly one JSON answer');
  const fence = fences[0]!;
  const outside = text.slice(0, fence.index) + text.slice(fence.index! + fence[0].length);
  if (/```|[{}]/.test(outside)) throw new Error('Ambiguous answer outside JSON fence');
  return JSON.parse(fence[1]!);
}

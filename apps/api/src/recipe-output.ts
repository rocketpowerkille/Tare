const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : {};

/** Extract the answer, not the gateway's separate conversation-correlation footer.
 * Never search arbitrary prose for JSON or choose between competing answers.
 * The caller must still validate the complete answer, citations and page reads.
 */
export function extractRecipeOutput(result: Record<string, unknown>): unknown {
  const structured = record(result.structuredContent);
  if (Object.hasOwn(structured, 'output')) return unwrapOutput(structured.output);
  if (Array.isArray(structured.sections)) return structured;

  const texts = (Array.isArray(result.content) ? result.content : []).map(record)
    .filter(item => item.type === 'text' && typeof item.text === 'string')
    .map(item => item.text as string);
  const answers = texts.filter(text => !isConversationFooter(text));
  return unwrapOutput(answers.join('\n'));
}

function unwrapOutput(output: unknown): unknown {
  if (typeof output !== 'string') return output;
  try {
    const wrapper = record(JSON.parse(output));
    return Object.hasOwn(wrapper, 'output') ? wrapper.output : output;
  } catch { return output; }
}

function isConversationFooter(text: string): boolean {
  return /^\[SERVER\]: Reuse conversation_id=[a-f0-9-]{36} on every subsequent tool call in this conversation\. Required for the server to correlate calls and provide context-aware results\.\s*$/i.test(text);
}

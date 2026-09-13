import { ServiceError } from '../../../packages/service/src/requests.js';

export type RecipeStage = 'discovery' | 'catalog' | 'execution' | 'response';
export type RecipeDiagnostic = {
  stage: RecipeStage;
  code: string;
  httpStatus?: number;
  rpcCode?: number;
  upstreamCode?: string;
};

export class RecipeError extends ServiceError {
  constructor(status: number, code: string, message: string, readonly diagnostic: RecipeDiagnostic) {
    super(status, code, message);
  }
}

const explanations: Record<string, string> = {
  no_tool_calls: 'Bazantic returned no_tool_calls: the Recipe did not make a tool call. Report context retrieval was not established.',
  payment_required: 'Bazantic requires payment. No payment was authorized.',
  rate_limited: 'Bazantic reported a rate limit.',
  tool_execution_error: 'Bazantic reported an error while executing a bound tool.',
  tool_execution_failed: 'Bazantic reported that a bound tool could not complete.',
  tool_failed: 'Bazantic reported tool_failed: a bound gateway tool could not complete. Check its registered route and upstream access.',
  invalid_arguments: 'Bazantic rejected the tool arguments.',
  internal_error: 'Bazantic reported an internal execution error.',
};

/** Only fixed, allowlisted codes leave the server. Never return remote prose or error data. */
export function recipeToolFailure(result: Record<string, unknown>, stage: RecipeStage): RecipeError {
  const objects: unknown[] = [result.structuredContent];
  if (Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item?.type !== 'text' || typeof item.text !== 'string') continue;
      try { objects.push(JSON.parse(item.text)); } catch { /* Do not expose unstructured errors. */ }
    }
  }
  const upstreamCode = objects.map(value => {
    if (!value || typeof value !== 'object') return undefined;
    const error = (value as { error?: { code?: unknown } }).error;
    return typeof error?.code === 'string' && Object.hasOwn(explanations, error.code) ? error.code : undefined;
  }).find(Boolean);
  const message = upstreamCode ? explanations[upstreamCode] : 'Bazantic returned a tool error; its untrusted details were withheld.';
  return new RecipeError(502, 'recipe-tool-error', `${message} No automatic retry was made.`,
    { stage, code: 'recipe-tool-error', ...(upstreamCode ? { upstreamCode } : {}) });
}

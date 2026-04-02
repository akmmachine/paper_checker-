export type AiProvider = 'gemini' | 'openai';

/** Model id from .env (e.g. gemini-3-pro-preview, gpt-4o). */
export function getAiModel(): string {
  const m = process.env.AI_MODEL?.trim();
  return m || 'gemini-3-pro-preview';
}

/** Infer provider from the model name so one env var selects the stack. */
export function resolveProvider(model: string): AiProvider {
  const lower = model.trim().toLowerCase();
  if (lower.startsWith('gemini')) return 'gemini';
  if (
    lower.startsWith('gpt-') ||
    lower.startsWith('o1') ||
    lower.startsWith('o3') ||
    lower.startsWith('o4') ||
    lower.startsWith('chatgpt-')
  ) {
    return 'openai';
  }
  // Backward compatibility: unknown id defaults to Gemini
  return 'gemini';
}

/** Normalize assistant message body from Chat Completions API (string or parts array). */
export function getOpenAiMessageText(message: {
  content?: string | Array<{ type?: string; text?: string }>;
  refusal?: string | null;
}): string {
  if (message.refusal) {
    throw new Error(message.refusal);
  }
  const c = message?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c
      .map((p) => {
        if (p && typeof p === 'object' && 'text' in p && typeof (p as { text?: string }).text === 'string') {
          return (p as { text: string }).text;
        }
        return '';
      })
      .join('');
  }
  return '';
}

/** Drop prose before first `{` or `[` (Gemini sometimes prefixes explanations). */
function stripToFirstJsonBoundary(input: string): string {
  const o = input.indexOf('{');
  const a = input.indexOf('[');
  if (o === -1 && a === -1) return input;
  if (o === -1) return input.slice(a);
  if (a === -1) return input.slice(o);
  return input.slice(Math.min(o, a));
}

/** Trailing commas before } or ] are invalid JSON but common in model output. */
function stripTrailingCommas(input: string): string {
  let s = input;
  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
  }
  return s;
}

/**
 * Parse JSON from model output: strip markdown fences, trim prose, recover first object/array.
 */
export function parseModelJsonOutput(raw: string): unknown {
  let s = (raw ?? '').trim();
  if (!s) throw new Error('Empty model response');

  // Strip BOM / odd spaces
  s = s.replace(/^\uFEFF/, '').replace(/\u200B/g, '');

  // ```json ... ``` or ``` ... ``` (use last fence if model echoed multiple blocks)
  const allFences = [...s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  if (allFences.length > 0) {
    s = allFences[allFences.length - 1][1].trim();
  } else {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  }

  s = stripToFirstJsonBoundary(s.trim());

  const repairInvalidJsonEscapes = (input: string): string => {
    let out = '';
    let inStr = false;
    let escaped = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (!inStr) {
        out += ch;
        if (ch === '"') inStr = true;
        continue;
      }

      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }

      if (ch === '\\') {
        const next = input[i + 1];
        // Keep JSON \uXXXX intact (do not break Unicode escapes).
        if (next === 'u' && /^[0-9a-fA-F]{4}/.test(input.slice(i + 2, i + 6))) {
          out += input.slice(i, i + 6);
          i += 5;
          continue;
        }
        const isValidEscape =
          next === '"' ||
          next === '\\' ||
          next === '/' ||
          next === 'b' ||
          next === 'f' ||
          next === 'n' ||
          next === 'r' ||
          next === 't' ||
          next === 'u';
        out += isValidEscape ? '\\' : '\\\\';
        escaped = isValidEscape;
        continue;
      }

      out += ch;
      if (ch === '"') inStr = false;
    }
    return out;
  };

  const tryParseOne = (candidate: string): unknown | null => {
    const c = candidate.trim();
    if (!c) return null;
    try {
      return JSON.parse(c);
    } catch {
      return null;
    }
  };

  const trySlice = (candidate: string, open: string, close: string): string | null => {
    const start = candidate.indexOf(open);
    if (start === -1) return null;
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (inStr) {
        if (ch === '\\') escape = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return candidate.slice(start, i + 1);
      }
    }
    return null;
  };

  const tryParseWithRecovery = (candidate: string): unknown | null => {
    const repaired = repairInvalidJsonEscapes(candidate);
    const attemptSet = new Set<string>([candidate, repaired].filter(Boolean));
    const attempts: string[] = [...attemptSet];
    for (const base of [...attempts]) {
      const commaStripped = stripTrailingCommas(base);
      if (commaStripped !== base && !attemptSet.has(commaStripped)) {
        attemptSet.add(commaStripped);
        attempts.push(commaStripped);
      }
    }

    for (const cand of attempts) {
      const direct = tryParseOne(cand);
      if (direct !== null) return direct;
    }

    for (const cand of attempts) {
      const objSlice = trySlice(cand, '{', '}');
      const arrSlice = trySlice(cand, '[', ']');
      const sliced = objSlice ?? arrSlice;
      if (!sliced) continue;

      const sliceVariants = [sliced, repairInvalidJsonEscapes(sliced), stripTrailingCommas(sliced)];
      const seen = new Set<string>();
      for (const v of sliceVariants) {
        if (seen.has(v)) continue;
        seen.add(v);
        const parsed = tryParseOne(v) ?? tryParseOne(stripTrailingCommas(repairInvalidJsonEscapes(v)));
        if (parsed !== null) return parsed;
      }
    }
    return null;
  };

  const parsed = tryParseWithRecovery(s);
  if (parsed !== null) {
    return parsed;
  }
  const preview = s.length > 280 ? `${s.slice(0, 280)}…` : s;
  throw new Error(`Could not parse JSON from model output. Preview: ${preview}`);
}

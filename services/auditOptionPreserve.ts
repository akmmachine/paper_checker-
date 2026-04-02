import type { QuestionData } from '../types';
import { clampOptionIndex, parseIndicesFlexible } from './mcqCorrectIndices';

/**
 * Strip outer-only HTML wrappers (quiz exports often use <p>…</p> vs plain text).
 * Repeats until stable so <p><span>x</span></p> becomes x.
 */
function stripOuterTrivialHtml(s: string): string {
  let t = s.trim().replace(/&nbsp;/gi, ' ').replace(/&#160;/g, ' ');
  const wrappers = [
    /^<p\b[^>]*>([\s\S]*)<\/p>$/i,
    /^<div\b[^>]*>([\s\S]*)<\/div>$/i,
    /^<span\b[^>]*>([\s\S]*)<\/span>$/i,
    /^<strong\b[^>]*>([\s\S]*)<\/strong>$/i,
    /^<b\b[^>]*>([\s\S]*)<\/b>$/i,
    /^<em\b[^>]*>([\s\S]*)<\/em>$/i,
    /^<i\b[^>]*>([\s\S]*)<\/i>$/i,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of wrappers) {
      const m = t.match(re);
      if (m) {
        t = m[1].trim().replace(/&nbsp;/gi, ' ').replace(/&#160;/g, ' ');
        changed = true;
        break;
      }
    }
  }
  return t;
}

/** Plain form for storage when HTML wrapper was the only “difference”. */
function canonicalOptionPlainText(s: string): string {
  return stripOuterTrivialHtml(String(s))
    .trim()
    .replace(/\s+/g, ' ');
}

/** Whitespace + common “If/if” cosmetic normalization only — not a full LaTeX canonicalizer. */
function normalizeOptionForCompare(s: string): string {
  return canonicalOptionPlainText(s)
    .replace(/\bIf\b/g, 'if')
    .normalize('NFKC');
}

export function optionsSubstantivelyEqual(a: string, b: string): boolean {
  const na = normalizeOptionForCompare(a);
  const nb = normalizeOptionForCompare(b);
  if (na === nb) return true;
  return na.localeCompare(nb, undefined, { sensitivity: 'accent' }) === 0;
}

/** Collapse redline HTML to the post-correction plain string (del removed, ins unwrapped). */
export function resolvedAfterRedline(html: string): string {
  let s = String(html);
  s = s.replace(/<del\b[^>]*>[\s\S]*?<\/del>/gi, '');
  s = s.replace(/<ins\b[^>]*>([\s\S]*?)<\/ins>/gi, '$1');
  return canonicalOptionPlainText(s);
}

function normalizeOptionArrayLength(baseline: string[], fromModel: unknown): string[] {
  const from = Array.isArray(fromModel) ? fromModel.map((x) => String(x ?? '')) : [];
  return baseline.map((b, i) => {
    const got = from[i];
    return got !== undefined && got.length > 0 ? got : b;
  });
}

export { clampOptionIndex } from './mcqCorrectIndices';

function finalizeCorrectIndicesFromSources(
  n: number,
  input: QuestionData['original'],
  clean: Record<string, unknown>,
  originalParsed: Record<string, unknown>
): void {
  const fromModelArr = parseIndicesFlexible(clean.correctOptionIndices, n);
  const fromInputArr = parseIndicesFlexible(input.correctOptionIndices, n);
  const modelSingle = clampOptionIndex(clean.correctOptionIndex, n);
  const inputSingle = clampOptionIndex(input.correctOptionIndex, n);

  let final: number[];
  if (fromModelArr.length > 0) final = fromModelArr;
  else if (modelSingle !== null) final = [modelSingle];
  else if (fromInputArr.length > 0) final = fromInputArr;
  else if (inputSingle !== null) final = [inputSingle];
  else final = [0];

  clean.correctOptionIndices = final;
  clean.correctOptionIndex = final[0];
  originalParsed.correctOptionIndices = [...final];
  originalParsed.correctOptionIndex = final[0];
}

function finalizeCorrectIndicesFromParsed(
  n: number,
  op: Record<string, unknown>,
  clean: Record<string, unknown>
): void {
  const fromModelArr = parseIndicesFlexible(clean.correctOptionIndices, n);
  const fromOpArr = parseIndicesFlexible(op.correctOptionIndices, n);
  const modelSingle = clampOptionIndex(clean.correctOptionIndex, n);
  const opSingle = clampOptionIndex(op.correctOptionIndex, n);

  let final: number[];
  if (fromModelArr.length > 0) final = fromModelArr;
  else if (modelSingle !== null) final = [modelSingle];
  else if (fromOpArr.length > 0) final = fromOpArr;
  else if (opSingle !== null) final = [opSingle];
  else final = [0];

  clean.correctOptionIndices = final;
  clean.correctOptionIndex = final[0];
  op.correctOptionIndices = [...final];
  op.correctOptionIndex = final[0];
}

function revertCosmeticOnlyOptions(baseline: string[], cleanOpts: string[], redOpts: string[]): void {
  const n = baseline.length;
  for (let i = 0; i < n; i++) {
    const orig = baseline[i];
    const c = cleanOpts[i] ?? '';
    const r = redOpts[i] ?? '';

    if (optionsSubstantivelyEqual(orig, c)) {
      const plain = canonicalOptionPlainText(orig);
      cleanOpts[i] = plain;
      redOpts[i] = plain;
      continue;
    }
    if (r && optionsSubstantivelyEqual(orig, resolvedAfterRedline(r))) {
      const plain = canonicalOptionPlainText(orig);
      cleanOpts[i] = plain;
      redOpts[i] = plain;
    }
  }
}

/**
 * MCQ with known input (re-audit / quiz import): force option strings, repair missing arrays,
 * clamp correct index. Input options are the source of truth for text.
 */
export function finalizeMcqAuditForInput(input: QuestionData['original'], result: Record<string, unknown>): void {
  const src = input.options;
  if (!src?.length) return;

  const baseline = src.map((x) => String(x));
  const n = baseline.length;

  const originalParsed = (result.originalParsed ??= {}) as Record<string, unknown>;
  const clean = (result.clean ??= {}) as Record<string, unknown>;
  const red = (result.redlines ??= {}) as Record<string, unknown>;

  originalParsed.options = [...baseline];

  const cleanOpts = normalizeOptionArrayLength(baseline, clean.options);
  const redOpts = normalizeOptionArrayLength(baseline, red.options);
  clean.options = cleanOpts;
  red.options = redOpts;

  revertCosmeticOnlyOptions(baseline, cleanOpts, redOpts);

  finalizeCorrectIndicesFromSources(n, input, clean, originalParsed);
}

/**
 * MCQ from raw parse (bulk paste): baseline is model’s originalParsed.options.
 */
export function finalizeMcqAuditForParsedRow(row: Record<string, unknown>): void {
  const op = row.originalParsed as Record<string, unknown> | undefined;
  if (!op || !Array.isArray(op.options) || op.options.length === 0) return;

  const baseline = op.options.map((x: unknown) => String(x));
  const n = baseline.length;

  const clean = (row.clean ??= {}) as Record<string, unknown>;
  const red = (row.redlines ??= {}) as Record<string, unknown>;

  const cleanOpts = normalizeOptionArrayLength(baseline, clean.options);
  const redOpts = normalizeOptionArrayLength(baseline, red.options);
  clean.options = cleanOpts;
  red.options = redOpts;

  revertCosmeticOnlyOptions(baseline, cleanOpts, redOpts);

  finalizeCorrectIndicesFromParsed(n, op, clean);
}

/** @deprecated use finalizeMcqAuditForInput */
export function alignAuditOptionsToInput(input: QuestionData['original'], result: Record<string, unknown>): void {
  finalizeMcqAuditForInput(input, result);
}

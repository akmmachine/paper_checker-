import type { QuestionData } from '../types';

/** 0-based index; supports A–Z and 1-based numeric strings. */
export function clampOptionIndex(v: unknown, optionCount: number): number | null {
  if (optionCount <= 0) return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const i = Math.trunc(v);
    if (i >= 0 && i < optionCount) return i;
    if (i >= 1 && i <= optionCount) return i - 1;
    return null;
  }
  if (typeof v === 'string') {
    const t = v.trim().toUpperCase();
    if (/^[A-Z]$/.test(t)) {
      const i = t.charCodeAt(0) - 65;
      return i >= 0 && i < optionCount ? i : null;
    }
    const num = parseInt(t, 10);
    if (!Number.isNaN(num)) {
      if (num >= 1 && num <= optionCount) return num - 1;
      if (num >= 0 && num < optionCount) return num;
    }
  }
  return null;
}

/** Parse model/input array of indices or letters into sorted unique valid indices. */
export function parseIndicesFlexible(v: unknown, optionCount: number): number[] {
  if (optionCount <= 0 || !Array.isArray(v)) return [];
  const out = new Set<number>();
  for (const x of v) {
    const idx = clampOptionIndex(x, optionCount);
    if (idx !== null) out.add(idx);
  }
  return [...out].sort((a, b) => a - b);
}

/** Sorted unique 0-based indices of all correct options (MSQ / single MCQ). */
export function resolvedCorrectOptionIndices(data: {
  original?: QuestionData['original'];
  audit?: QuestionData['audit'];
}): number[] {
  const optCount =
    data.original?.options?.length ?? data.audit?.clean?.options?.length ?? 0;
  if (optCount <= 0) return [];

  const clean = data.audit?.clean;
  const orig = data.original;

  const arr = clean?.correctOptionIndices ?? orig?.correctOptionIndices;
  if (Array.isArray(arr) && arr.length > 0) {
    const out = new Set<number>();
    for (const x of arr) {
      const i = typeof x === 'number' ? Math.trunc(x) : NaN;
      if (Number.isFinite(i) && i >= 0 && i < optCount) out.add(i);
    }
    if (out.size > 0) return [...out].sort((a, b) => a - b);
  }

  const idx = Number(clean?.correctOptionIndex ?? orig?.correctOptionIndex ?? 0);
  const clamped = Math.min(
    Math.max(0, Number.isFinite(idx) ? Math.trunc(idx) : 0),
    optCount - 1
  );
  return [clamped];
}

export function resolvedCorrectOptionIndexSet(data: {
  original?: QuestionData['original'];
  audit?: QuestionData['audit'];
}): Set<number> {
  return new Set(resolvedCorrectOptionIndices(data));
}

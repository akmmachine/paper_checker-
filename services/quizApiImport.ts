import type { QuestionData } from '../types';

function stripHtml(html: string): string {
  if (!html?.trim()) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = doc.body.textContent ?? '';
    return text.replace(/\s+/g, ' ').trim();
  } catch {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/** Map one quiz-platform question (e.g. qText / options / qSolution) to our original shape. */
function quizRowToOriginal(row: Record<string, unknown>): QuestionData['original'] | null {
  const qText = row.qText;
  const qSolution = row.qSolution;
  const rawOptions = row.options;

  if (typeof qText !== 'string') return null;
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
    const question = stripHtml(qText);
    const solution = stripHtml(typeof qSolution === 'string' ? qSolution : '');
    if (!question) return null;
    return {
      question,
      solution,
      options: [],
      correctAnswer:
        row.correctAnswer !== undefined && row.correctAnswer !== null
          ? String(row.correctAnswer)
          : '',
    };
  }

  const sorted = [...rawOptions].sort((a, b) => {
    const ao = isRecord(a) && typeof a.optionOrder === 'number' ? a.optionOrder : 0;
    const bo = isRecord(b) && typeof b.optionOrder === 'number' ? b.optionOrder : 0;
    return ao - bo;
  });

  const optionStrings = sorted.map((o) =>
    isRecord(o) && typeof o.qOption === 'string' ? o.qOption.trim() : ''
  );

  const solutionIndices: number[] = [];
  sorted.forEach((o, i) => {
    if (isRecord(o) && o.isSolution === true) solutionIndices.push(i);
  });

  let correctOptionIndex: number;
  let correctOptionIndices: number[] | undefined;

  if (solutionIndices.length > 1) {
    correctOptionIndices = [...solutionIndices].sort((a, b) => a - b);
    correctOptionIndex = correctOptionIndices[0];
  } else if (solutionIndices.length === 1) {
    correctOptionIndex = solutionIndices[0];
    correctOptionIndices = [solutionIndices[0]];
  } else if (
    typeof row.correctAnswer === 'number' &&
    Number.isInteger(row.correctAnswer) &&
    row.correctAnswer >= 0 &&
    row.correctAnswer < optionStrings.length
  ) {
    correctOptionIndex = row.correctAnswer;
    correctOptionIndices = [row.correctAnswer];
  } else {
    correctOptionIndex = 0;
    correctOptionIndices = [0];
  }

  const question = stripHtml(qText);
  const solution = stripHtml(typeof qSolution === 'string' ? qSolution : '');
  if (!question) return null;

  return {
    question,
    options: optionStrings,
    correctOptionIndex,
    correctOptionIndices,
    solution,
  };
}

/**
 * Detect JSON export shaped like `{ data: [ { qText, options[], qSolution, ... } ] }`
 * and convert to originals for auditing (avoids sending huge JSON through parse-and-audit-in-one prompt).
 */
export function extractOriginalsFromQuizApiPayload(text: string): QuestionData['original'][] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  const data = parsed.data;
  if (!Array.isArray(data) || data.length === 0) return null;

  const first = data[0];
  if (!isRecord(first) || !('qText' in first) || !Array.isArray(first.options)) {
    return null;
  }

  const originals: QuestionData['original'][] = [];
  for (const item of data) {
    if (!isRecord(item)) continue;
    const o = quizRowToOriginal(item);
    if (o) originals.push(o);
  }
  return originals.length ? originals : null;
}

/** Try combined paste or each staged segment (handles one big JSON blob vs multiple). */
export function tryExtractOriginalsFromQuizExport(combinedInput: string): QuestionData['original'][] | null {
  const chunks = combinedInput.split(/\n\n---NEXT QUESTION---\n\n/).map((s) => s.trim());
  for (const chunk of chunks) {
    const found = extractOriginalsFromQuizApiPayload(chunk);
    if (found?.length) return found;
  }
  return null;
}

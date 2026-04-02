import { QuestionData } from '../types';
import { SYSTEM_PROMPT } from './auditShared';
import { getAiModel } from './aiConfig';
import { getOpenAiMessageText, parseModelJsonOutput } from './parseModelJson';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const SINGLE_SHAPE = `One JSON object with keys: status (APPROVED|NEEDS_CORRECTION|REJECTED), topic (string), systematicAudit (string), auditLogs (array of {type, message, severity}), originalParsed ({question, options, correctOptionIndex?, correctOptionIndices?, correctAnswer?, solution}), redlines ({question, options?, correctAnswer?, solution}), clean ({question, options, correctOptionIndex?, correctOptionIndices?, correctAnswer?, solution}). For MCQ: options is a non-empty string array; redlines.options and clean.options MUST have the SAME length as options. For single-answer MCQ: correctOptionIndices is one element, e.g. [1]. For MSQ (multiple correct): correctOptionIndices lists EVERY correct index 0..len-1; correctOptionIndex is the smallest index. Use empty array for options when numerical. originalParsed and clean require at least question and solution.`;

const ARRAY_WRAP = `Return JSON only: { "results": [ ... ] } where each element has ${SINGLE_SHAPE}`;

async function chatJson(model: string, userContent: string): Promise<unknown> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY is not set in .env.local');

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    console.error('OpenAI API error:', res.status, raw);
    throw new Error(`OpenAI request failed: ${res.status}`);
  }

  let data: {
    choices?: {
      message?: { content?: string | Array<{ type?: string; text?: string }>; refusal?: string | null };
      finish_reason?: string;
    }[];
    error?: { message?: string };
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON from OpenAI HTTP response');
  }

  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  const message = data.choices?.[0]?.message;
  const text = message ? getOpenAiMessageText(message) : '';
  if (!text?.trim()) {
    const reason = data.choices?.[0]?.finish_reason;
    throw new Error(
      reason ? `No model text in response (finish_reason: ${reason})` : 'No model text in response'
    );
  }
  return parseModelJsonOutput(text);
}

export const auditRawQuestion = async (rawText: string): Promise<any[]> => {
  const model = getAiModel();
  const prompt = `Parse and Audit this content. Handle both MCQs and Numerical problems (where only Q, Ans, and Solution are given). Preserve math notation/LaTeX from the source and keep JSON escaping valid: """ ${rawText} """

${ARRAY_WRAP}`;

  try {
    const parsed = await chatJson(model, prompt);
    if (Array.isArray(parsed)) return parsed;

    const o = parsed as {
      results?: any[];
      questions?: any[];
      items?: any[];
      data?: any[];
    };
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.questions)) return o.questions;
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.data)) return o.data;
    return [];
  } catch (error) {
    console.error('OpenAI auditRawQuestion error:', error);
    throw error;
  }
};

export const auditQuestion = async (q: QuestionData['original']): Promise<any> => {
  const model = getAiModel();
  const nOpt = q.options?.length ?? 0;
  const mcqHint =
    nOpt > 0
      ? `\nMCQ/MSQ with ${nOpt} options: originalParsed.options, redlines.options, and clean.options MUST each have length ${nOpt}. Include correctOptionIndices (array of all correct 0-based indices). For multiple correct answers, list every correct index (e.g. [0,1,2,3]). Set correctOptionIndex to the smallest listed index.`
      : '';
  const prompt = `Audit this existing question. Support numerical/subjective formats:
    Question: ${q.question}
    Options: ${q.options ? q.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join(', ') : 'NONE'}
    Correct Answer/Index: ${q.correctAnswer || q.correctOptionIndex}
    Solution: ${q.solution}${mcqHint}

Respond with JSON only: a single object — ${SINGLE_SHAPE}`;

  const parsed = (await chatJson(model, prompt)) as Record<string, unknown>;
  const isAudit = (o: unknown) =>
    !!o &&
    typeof o === 'object' &&
    'status' in (o as object) &&
    'originalParsed' in (o as object);
  if (isAudit(parsed)) return parsed;
  const wrapped = parsed as { result?: unknown; audit?: unknown; data?: unknown; output?: unknown };
  for (const v of [wrapped.result, wrapped.audit, wrapped.data, wrapped.output]) {
    if (isAudit(v)) return v as Record<string, unknown>;
  }
  return parsed;
};

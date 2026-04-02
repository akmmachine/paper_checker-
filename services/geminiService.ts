import { GoogleGenAI, Type } from "@google/genai";
import { QuestionData } from "../types";
import { SYSTEM_PROMPT } from "./auditShared";
import { getAiModel } from "./aiConfig";
import { parseModelJsonOutput } from "./parseModelJson";

/** Large audit JSON (systematicAudit, redlines, options) often exceeds Gemini defaults and truncates mid-string. */
function geminiAuditMaxOutputTokens(): number {
  const raw = process.env.GEMINI_MAX_OUTPUT_TOKENS?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1024) return Math.min(n, 65536);
  }
  return 16384;
}

const questionSchemaProperties = {
  status: { type: Type.STRING, enum: ['APPROVED', 'NEEDS_CORRECTION', 'REJECTED'] },
  topic: { type: Type.STRING },
  systematicAudit: { type: Type.STRING },
  auditLogs: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ['CONCEPTUAL', 'NUMERICAL', 'LOGICAL', 'GRAMMATICAL'] },
        message: { type: Type.STRING },
        severity: { type: Type.STRING, enum: ['HIGH', 'MEDIUM', 'LOW'] }
      },
      required: ['type', 'message', 'severity']
    }
  },
  originalParsed: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correctOptionIndex: { type: Type.NUMBER },
      correctOptionIndices: { type: Type.ARRAY, items: { type: Type.NUMBER } },
      correctAnswer: { type: Type.STRING },
      solution: { type: Type.STRING }
    },
    required: ['question', 'solution']
  },
  redlines: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correctAnswer: { type: Type.STRING },
      solution: { type: Type.STRING }
    },
    required: ['question', 'solution']
  },
  clean: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correctOptionIndex: { type: Type.NUMBER },
      correctOptionIndices: { type: Type.ARRAY, items: { type: Type.NUMBER } },
      correctAnswer: { type: Type.STRING },
      solution: { type: Type.STRING }
    },
    required: ['question', 'solution']
  }
};

export const auditRawQuestion = async (rawText: string): Promise<any[]> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  const model = getAiModel();
  const prompt = `Parse and Audit this content. Handle both MCQs and Numerical problems (where only Q, Ans, and Solution are given). Preserve math notation/LaTeX from the source and keep JSON escaping valid: """ ${rawText} """`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0,
        maxOutputTokens: geminiAuditMaxOutputTokens(),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: questionSchemaProperties,
            required: ['status', 'topic', 'systematicAudit', 'auditLogs', 'originalParsed', 'redlines', 'clean']
          }
        }
      }
    });
    const text = response.text?.trim();
    if (!text) return [];
    return parseModelJsonOutput(text) as any[];
  } catch (error) {
    console.error("Gemini Audit Error:", error);
    throw error;
  }
};

export const auditQuestion = async (q: QuestionData['original']): Promise<any> => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    const model = getAiModel();
    const optCount = q.options?.length ?? 0;
    const mcqHint =
      optCount > 0
        ? `\nThis is an MCQ/MSQ with ${optCount} options (indices 0..${optCount - 1}). Return originalParsed.options, redlines.options, and clean.options as string arrays of length ${optCount}. Return correctOptionIndices: array of ALL correct 0-based indices (MSQ may have several). Set correctOptionIndex to the smallest index in that array.`
        : '';
    const prompt = `Audit this existing question. Support numerical/subjective formats:
    Question: ${q.question}
    Options: ${q.options ? q.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join(', ') : 'NONE'}
    Correct Answer/Index: ${q.correctAnswer || q.correctOptionIndex}
    Solution: ${q.solution}${mcqHint}`;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0,
          maxOutputTokens: geminiAuditMaxOutputTokens(),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: questionSchemaProperties,
            required: ['status', 'topic', 'systematicAudit', 'auditLogs', 'originalParsed', 'redlines', 'clean']
          }
        }
    });
    const text = response.text?.trim();
    if (!text) return {};
    return parseModelJsonOutput(text) as any;
};

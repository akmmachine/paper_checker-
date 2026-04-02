import type { QuestionData } from '../types';
import { getAiModel, resolveProvider } from './aiConfig';
import * as gemini from './geminiService';
import * as openai from './openaiService';
import { enrichOriginalWithVisionOcr, enrichRawTextWithVisionOcr } from './visionFormulaOcr';
import { finalizeMcqAuditForInput, finalizeMcqAuditForParsedRow } from './auditOptionPreserve';

export const auditRawQuestion = async (rawText: string): Promise<any[]> => {
  const enriched = await enrichRawTextWithVisionOcr(rawText);
  const model = getAiModel();
  const rows =
    resolveProvider(model) === 'openai'
      ? await openai.auditRawQuestion(enriched)
      : await gemini.auditRawQuestion(enriched);
  if (!Array.isArray(rows)) return rows;
  for (const row of rows) {
    if (row && typeof row === 'object' && row.originalParsed && typeof row.originalParsed === 'object') {
      const op = row.originalParsed as QuestionData['original'];
      if (Array.isArray(op.options) && op.options.length > 0) {
        finalizeMcqAuditForParsedRow(row as Record<string, unknown>);
      }
    }
  }
  return rows;
};

export const auditQuestion = async (q: QuestionData['original']): Promise<any> => {
  const enriched = await enrichOriginalWithVisionOcr(q);
  const model = getAiModel();
  const result =
    resolveProvider(model) === 'openai'
      ? await openai.auditQuestion(enriched)
      : await gemini.auditQuestion(enriched);
  if (result && typeof result === 'object') {
    finalizeMcqAuditForInput(q, result as Record<string, unknown>);
  }
  return result;
};

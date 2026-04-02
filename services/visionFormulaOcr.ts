import { GoogleGenAI } from '@google/genai';
import { QuestionData } from '../types';
import { getAiModel, resolveProvider } from './aiConfig';
import { getOpenAiMessageText, parseModelJsonOutput } from './parseModelJson';

function imgSrcTagRegex(): RegExp {
  return /<img\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>/gi;
}

const MAX_IMAGES_PER_QUESTION = 12;

function isVisionOcrEnabled(): boolean {
  const v = (process.env.VISION_OCR_ENABLED ?? 'true').toLowerCase();
  return v !== 'false' && v !== '0';
}

function openAiVisionModel(): string {
  return (process.env.VISION_OCR_MODEL_OPENAI ?? 'gpt-4o-mini').trim() || 'gpt-4o-mini';
}

function geminiVisionModel(): string {
  const m = (process.env.VISION_OCR_MODEL_GEMINI ?? '').trim();
  return m || getAiModel();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Collect unique http(s) or data URLs from HTML fragments. */
export function extractImageUrlsFromHtml(html: string): string[] {
  if (!html?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const re = imgSrcTagRegex();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = (m[2] ?? '').trim();
    if (!url || seen.has(url)) continue;
    if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_IMAGES_PER_QUESTION) break;
  }
  return out;
}

function collectUrlsFromOriginal(o: QuestionData['original']): string[] {
  const parts = [o.question, o.solution, ...(o.options ?? [])];
  const seen = new Set<string>();
  const all: string[] = [];
  for (const p of parts) {
    for (const u of extractImageUrlsFromHtml(typeof p === 'string' ? p : '')) {
      if (seen.has(u)) continue;
      seen.add(u);
      all.push(u);
      if (all.length >= MAX_IMAGES_PER_QUESTION) return all;
    }
  }
  return all;
}

function collectUrlsFromRawText(raw: string): string[] {
  return extractImageUrlsFromHtml(raw);
}

async function fetchImageAsInlineData(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    if (url.startsWith('data:image/')) {
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(url);
      if (!match) return null;
      return { mimeType: match[1], data: match[2] };
    }
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const mimeType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
    const buf = await blob.arrayBuffer();
    return { mimeType, data: arrayBufferToBase64(buf) };
  } catch {
    return null;
  }
}

const OCR_INSTRUCTION = `You transcribe educational images: math, chemistry, physics, and botanical floral formulas.
Rules:
- Preserve notation faithfully (subscripts, superscripts, special symbols like ⊕, ⚥, % for zygomorphy when visible).
- Prefer inline LaTeX in dollar signs for math when it helps (e.g. $K_{(5)}$, $\\underline{G}_1$). For plain floral shorthand you may use Unicode.
- One concise transcription per image; no explanation unless the image is only text.
Return JSON only: {"transcriptions":["...","..."]} with one string per image in the same order as the images provided.`;

async function transcribeWithOpenAiImageUrls(urls: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (urls.length === 0) return map;
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return map;

  const model = openAiVisionModel();
  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
  > = [
    {
      type: 'text',
      text: `${OCR_INSTRUCTION}\nImage count: ${urls.length}.`,
    },
    ...urls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url, detail: 'high' as const },
    })),
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [{ role: 'user', content }],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    console.warn('OpenAI vision OCR failed:', res.status, raw.slice(0, 200));
    return map;
  }

  let data: { choices?: { message?: { content?: string | Array<{ type?: string; text?: string }> } }[] };
  try {
    data = JSON.parse(raw);
  } catch {
    return map;
  }

  const text = data.choices?.[0]?.message ? getOpenAiMessageText(data.choices[0].message) : '';
  if (!text?.trim()) return map;

  try {
    const parsed = parseModelJsonOutput(text) as { transcriptions?: string[] };
    const arr = Array.isArray(parsed?.transcriptions) ? parsed.transcriptions : [];
    urls.forEach((u, i) => {
      const t = typeof arr[i] === 'string' ? arr[i].trim() : '';
      if (t) map.set(u, t);
    });
  } catch {
    console.warn('OpenAI vision OCR: could not parse JSON transcriptions');
  }
  return map;
}

async function transcribeWithGeminiInline(urls: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (urls.length === 0) return map;
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return map;

  const order: string[] = [];
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  for (const url of urls) {
    const inline = await fetchImageAsInlineData(url);
    if (!inline) continue;
    order.push(url);
    parts.push({ inlineData: { mimeType: inline.mimeType, data: inline.data } });
  }

  if (order.length === 0) return map;

  const ai = new GoogleGenAI({ apiKey });
  const model = geminiVisionModel();

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: `${OCR_INSTRUCTION}\nImage count: ${order.length}.` },
    ...parts,
  ];

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: { temperature: 0, responseMimeType: 'application/json' },
    });
    const text = response.text?.trim();
    if (!text) return map;
    const parsed = parseModelJsonOutput(text) as { transcriptions?: string[] };
    const arr = Array.isArray(parsed?.transcriptions) ? parsed.transcriptions : [];
    order.forEach((u, i) => {
      const t = typeof arr[i] === 'string' ? arr[i].trim() : '';
      if (t) map.set(u, t);
    });
  } catch (e) {
    console.warn('Gemini vision OCR failed:', e);
  }
  return map;
}

function replaceImgTagsWithTranscriptions(html: string, transcriptions: Map<string, string>): string {
  return html.replace(imgSrcTagRegex(), (full, _q: string, src: string) => {
    const t = transcriptions.get(src.trim());
    if (!t) return full;
    return ` ${t} `;
  });
}

function applyTranscriptionsToOriginal(
  o: QuestionData['original'],
  transcriptions: Map<string, string>
): QuestionData['original'] {
  if (transcriptions.size === 0) return o;
  return {
    ...o,
    question: replaceImgTagsWithTranscriptions(o.question, transcriptions),
    solution: replaceImgTagsWithTranscriptions(o.solution, transcriptions),
    options: o.options?.map((opt) => replaceImgTagsWithTranscriptions(opt, transcriptions)),
  };
}

/**
 * When auditing, replace formula images with vision transcriptions so the text model can reason accurately.
 * OpenAI path uses remote image URLs (no browser CORS). Gemini uses fetched bytes; may fall back to OpenAI if configured.
 */
export async function enrichOriginalWithVisionOcr(o: QuestionData['original']): Promise<QuestionData['original']> {
  if (!isVisionOcrEnabled()) return o;
  const urls = collectUrlsFromOriginal(o);
  if (urls.length === 0) return o;

  const provider = resolveProvider(getAiModel());
  let map: Map<string, string>;

  if (provider === 'openai') {
    map = await transcribeWithOpenAiImageUrls(urls);
    if (map.size === 0 && (process.env.GEMINI_API_KEY || process.env.API_KEY)) {
      map = await transcribeWithGeminiInline(urls);
    }
  } else {
    map = await transcribeWithGeminiInline(urls);
    const missing = urls.filter((u) => !map.has(u));
    if (missing.length > 0 && process.env.OPENAI_API_KEY?.trim()) {
      const extra = await transcribeWithOpenAiImageUrls(missing);
      extra.forEach((v, k) => map.set(k, v));
    }
  }

  return applyTranscriptionsToOriginal(o, map);
}

/** Append OCR lines for any images still in raw paste text (used before parse-and-audit). */
export async function enrichRawTextWithVisionOcr(rawText: string): Promise<string> {
  if (!isVisionOcrEnabled() || !rawText?.trim()) return rawText;
  const urls = collectUrlsFromRawText(rawText);
  if (urls.length === 0) return rawText;

  const provider = resolveProvider(getAiModel());
  let map: Map<string, string>;
  if (provider === 'openai') {
    map = await transcribeWithOpenAiImageUrls(urls);
    if (map.size === 0 && (process.env.GEMINI_API_KEY || process.env.API_KEY)) {
      map = await transcribeWithGeminiInline(urls);
    }
  } else {
    map = await transcribeWithGeminiInline(urls);
    const missing = urls.filter((u) => !map.has(u));
    if (missing.length > 0 && process.env.OPENAI_API_KEY?.trim()) {
      const extra = await transcribeWithOpenAiImageUrls(missing);
      extra.forEach((v, k) => map.set(k, v));
    }
  }

  if (map.size === 0) return rawText;

  const lines = ['\n\n---VISION_OCR_(formula images)---'];
  map.forEach((text, url) => {
    lines.push(`Image: ${url}`);
    lines.push(`Transcription: ${text}`);
  });
  return rawText + lines.join('\n');
}

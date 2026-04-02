import DOMPurify from 'dompurify';
import katex from 'katex';

const INLINE_OR_BLOCK_MATH = /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g;
const TRACK_TAGS = /(<\/?(?:del|ins)(?:\s[^>]*)?>)/gi;
const TRACK_TAG_ONLY = /^<\/?(?:del|ins)(?:\s[^>]*)?>$/i;
const IMG_TAG = /(<img\b[^>]*>)/gi;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderMathToken = (token: string): string => {
  let expression = token;
  let displayMode = false;

  if (token.startsWith('\\[') && token.endsWith('\\]')) {
    expression = token.slice(2, -2);
    displayMode = true;
  } else if (token.startsWith('\\(') && token.endsWith('\\)')) {
    expression = token.slice(2, -2);
  } else if (token.startsWith('$$') && token.endsWith('$$')) {
    expression = token.slice(2, -2);
    displayMode = true;
  } else if (token.startsWith('$') && token.endsWith('$')) {
    expression = token.slice(1, -1);
  }

  try {
    return katex.renderToString(expression.trim(), {
      throwOnError: false,
      displayMode,
      strict: 'ignore',
      trust: false,
      output: 'htmlAndMathml',
    });
  } catch {
    return escapeHtml(token);
  }
};

const renderMathInText = (text: string): string => {
  let out = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_OR_BLOCK_MATH.exec(text)) !== null) {
    const [token] = match;
    const start = match.index;

    if (start > cursor) {
      out += escapeHtml(text.slice(cursor, start)).replace(/\n/g, '<br/>');
    }

    out += renderMathToken(token);
    cursor = start + token.length;
  }

  if (cursor < text.length) {
    out += escapeHtml(text.slice(cursor)).replace(/\n/g, '<br/>');
  }

  return out;
};

const allowlistConfig = {
  USE_PROFILES: { html: true, svg: true, mathMl: true },
  ALLOWED_ATTR: ['class', 'src', 'alt', 'width', 'height', 'loading', 'decoding', 'referrerpolicy'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|data):|[^a-z]|[a-z+\.\-]+(?:[^a-z+\.\-:]|$))/i,
};

const renderMathAndImages = (text: string): string => {
  const chunks = text.split(IMG_TAG);
  return chunks
    .map((chunk) => {
      if (/^<img\b[^>]*>$/i.test(chunk)) {
        return DOMPurify.sanitize(chunk, allowlistConfig);
      }
      return renderMathInText(chunk);
    })
    .join('');
};

export const renderMathHtml = (value: unknown): string => {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  const html = renderMathAndImages(text);
  return DOMPurify.sanitize(html, allowlistConfig);
};

export const renderTrackedMathHtml = (value: unknown): string => {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  const chunks = text.split(TRACK_TAGS);
  const html = chunks
    .map((chunk) => (TRACK_TAG_ONLY.test(chunk) ? chunk : renderMathAndImages(chunk)))
    .join('');

  return DOMPurify.sanitize(html, allowlistConfig);
};

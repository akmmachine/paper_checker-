import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY ?? ''),
        'process.env.AI_MODEL': JSON.stringify(env.AI_MODEL ?? 'gemini-3-pro-preview'),
        'process.env.VISION_OCR_ENABLED': JSON.stringify(env.VISION_OCR_ENABLED ?? 'true'),
        'process.env.VISION_OCR_MODEL_OPENAI': JSON.stringify(env.VISION_OCR_MODEL_OPENAI ?? 'gpt-4o-mini'),
        'process.env.VISION_OCR_MODEL_GEMINI': JSON.stringify(env.VISION_OCR_MODEL_GEMINI ?? ''),
        'process.env.GEMINI_MAX_OUTPUT_TOKENS': JSON.stringify(env.GEMINI_MAX_OUTPUT_TOKENS ?? ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

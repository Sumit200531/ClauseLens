import { config } from '../config.js';
import { geminiProvider } from './gemini.js';
import { openaiProvider } from './openai.js';
import { localProvider } from './local.js';

let cached;
export function getProvider() {
  if (cached) return cached;
  if (config.provider === 'gemini') cached = geminiProvider(config.gemini);
  else if (config.provider === 'openai') cached = openaiProvider(config.openai);
  else cached = localProvider();
  return cached;
}

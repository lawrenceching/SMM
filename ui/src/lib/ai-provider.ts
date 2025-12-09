import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export const DEEPSEEK_MODEL = 'deepseek-chat';

// Get API key from environment (works in both client and server contexts)
function getApiKey(): string {
  // In server context (Node.js), use process.env
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeProcess = (globalThis as any).process;
    if (nodeProcess?.env) {
      return nodeProcess.env.VITE_DEEPSEEK_API_KEY || nodeProcess.env.DEEPSEEK_API_KEY || '';
    }
  } catch {
    // process not available
  }
  
  // In client context, use import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_DEEPSEEK_API_KEY || '';
  }
  
  // Fallback
  return '';
}

// Create DeepSeek provider configuration (lazy initialization)
let _deepseekProvider: ReturnType<typeof createOpenAICompatible> | null = null;

export function getDeepseekProvider() {
  if (!_deepseekProvider) {
    _deepseekProvider = createOpenAICompatible({
      name: 'DeepSeek',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: getApiKey(),
    });
  }
  return _deepseekProvider;
}


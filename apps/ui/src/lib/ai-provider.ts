import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export const DEEPSEEK_MODEL = 'deepseek-chat';

// Get API key from environment (works in both client and server contexts)
function getApiKey(): string {
  // In server context (Node.js), use process.env
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeProcess = (globalThis as any).process;
    if (nodeProcess?.env) {
      return nodeProcess.env.VITE_DEEPSEEK_API_KEY || nodeProcess.env.DEEPSEEK_API_KEY || 'sk-ce25f3132fbc4b599f0f26eede96d390';
    }
  } catch {
    // process not available
  }
  
  // In client context, use import.meta.env
  if (typeof import.meta !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metaEnv = (import.meta as any).env;
    if (metaEnv) {
      return metaEnv.VITE_DEEPSEEK_API_KEY || 'sk-ce25f3132fbc4b599f0f26eede96d390';
    }
  }
  
  // Fallback (for development - should use environment variables in production)
  return 'sk-ce25f3132fbc4b599f0f26eede96d390';
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


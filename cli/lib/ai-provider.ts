import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export const DEEPSEEK_MODEL = 'deepseek-chat';

// Get API key from environment
function getApiKey(): string {
  return process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || 'sk-ce25f3132fbc4b599f0f26eede96d390';
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


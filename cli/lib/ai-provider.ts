import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { UserConfig, AI } from '@core/types';

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

// Map AI type to config key
const aiToConfigKey: Record<AI, keyof NonNullable<UserConfig['ai']>> = {
  'OpenAI': 'openAI',
  'DeepSeek': 'deepseek',
  'OpenRouter': 'openrouter',
  'GLM': 'glm',
  'Other': 'other',
};

// Map AI type to provider name
const aiToProviderName: Record<AI, string> = {
  'OpenAI': 'OpenAI',
  'DeepSeek': 'DeepSeek',
  'OpenRouter': 'OpenRouter',
  'GLM': 'GLM',
  'Other': 'Other',
};

/**
 * Creates an AI provider based on the user's selected AI configuration
 * @param userConfig - The user configuration containing AI settings
 * @returns An object containing the provider and the model name
 * @throws Error if selectedAI is not set or if required config values are missing
 */
export function createAIProvider(userConfig: UserConfig): {
  provider: ReturnType<typeof createOpenAICompatible>;
  model: string;
} {
  if (!userConfig.selectedAI) {
    throw new Error('No AI provider selected');
  }

  if (!userConfig.ai) {
    throw new Error('AI configuration is not set');
  }

  const configKey = aiToConfigKey[userConfig.selectedAI];
  const aiConfig = userConfig.ai[configKey];

  if (!aiConfig) {
    throw new Error(`AI configuration for ${userConfig.selectedAI} is not set`);
  }

  if (!aiConfig.baseURL) {
    throw new Error(`baseURL is required for ${userConfig.selectedAI}`);
  }

  if (!aiConfig.apiKey) {
    throw new Error(`apiKey is required for ${userConfig.selectedAI}`);
  }

  if (!aiConfig.model) {
    throw new Error(`model is required for ${userConfig.selectedAI}`);
  }

  const provider = createOpenAICompatible({
    name: aiToProviderName[userConfig.selectedAI],
    baseURL: aiConfig.baseURL,
    apiKey: aiConfig.apiKey,
  });

  return {
    provider,
    model: aiConfig.model,
  };
}


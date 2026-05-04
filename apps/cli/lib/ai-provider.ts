import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { UserConfig } from '@core/types';

export const DEEPSEEK_MODEL = 'deepseek-v4-flash';

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

/**
 * Creates an AI provider based on the user's selected AI configuration.
 * Looks up the provider by name in the aiProviders array.
 *
 * @param userConfig - The user configuration containing AI settings
 * @returns An object containing the provider and the model name
 * @throws Error if selectedAIProvider is not set or if required config values are missing
 */
export function createAIProvider(userConfig: UserConfig): {
  provider: ReturnType<typeof createOpenAICompatible>;
  model: string;
} {
  if (!userConfig.selectedAIProvider) {
    throw new Error('No AI provider selected');
  }

  if (!userConfig.aiProviders || userConfig.aiProviders.length === 0) {
    throw new Error('No AI providers configured');
  }

  const providerName = userConfig.selectedAIProvider;
  const providerConfig = userConfig.aiProviders.find(p => p.name === providerName);

  if (!providerConfig) {
    throw new Error(`AI provider "${providerName}" not found in configured providers`);
  }

  if (!providerConfig.baseURL) {
    throw new Error(`baseURL is required for provider "${providerName}"`);
  }

  if (!providerConfig.apiKey) {
    throw new Error(`apiKey is required for provider "${providerName}"`);
  }

  if (!providerConfig.model) {
    throw new Error(`model is required for provider "${providerName}"`);
  }

  const provider = createOpenAICompatible({
    name: providerName,
    baseURL: providerConfig.baseURL,
    apiKey: providerConfig.apiKey,
  });

  return {
    provider,
    model: providerConfig.model,
  };
}

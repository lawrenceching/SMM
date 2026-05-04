import { DEFAULT_AI_PROVIDERS, DEFAULT_SELECTED_AI_PROVIDER } from './types'

/**
 * The reverse: provider name -> old AIConfig key.
 */
const NAME_TO_OLD_KEY: Record<string, string> = {
  DeepSeek: 'deepseek',
  OpenAI: 'openAI',
  OpenRouter: 'openrouter',
  GLM: 'glm',
  Other: 'other',
}

/**
 * Maps old selectedAI values to provider names (they happen to be the same).
 */
const OLD_AI_TO_NAME: Record<string, string> = {
  OpenAI: 'OpenAI',
  DeepSeek: 'DeepSeek',
  OpenRouter: 'OpenRouter',
  GLM: 'GLM',
  Other: 'Other',
}

/**
 * Migrate old-format AI config (ai as keyed object, selectedAI as AI type)
 * to new-format (aiProviders array, selectedAIProvider string).
 *
 * Operates in-place on the given object. The caller is responsible for
 * persisting the migrated config back to disk on next save.
 *
 * @returns true if migration was performed, false if already in new format.
 */
export function migrateAIConfig(raw: Record<string, unknown>): boolean {
  // Already migrated — no old ai key present
  if (!raw.ai && raw.aiProviders) {
    return false
  }

  // No old ai key — nothing to migrate. Leave aiProviders absent so the
  // consumer (e.g. AiSettings) can show its empty state.
  if (!raw.ai) {
    return false
  }

  const oldAi = raw.ai as Record<string, Record<string, string> | undefined>

  // Build aiProviders from defaults, overlaying old config values
  const providers = DEFAULT_AI_PROVIDERS.map(defaultProvider => {
    const oldKey = NAME_TO_OLD_KEY[defaultProvider.name!]
    const oldConfig = oldKey ? oldAi[oldKey] : undefined
    return {
      name: defaultProvider.name,
      baseURL: oldConfig?.baseURL?.trim() ? oldConfig.baseURL : defaultProvider.baseURL,
      apiKey: oldConfig?.apiKey ?? defaultProvider.apiKey ?? '',
      model: oldConfig?.model?.trim() ? oldConfig.model : defaultProvider.model,
    }
  })

  raw.aiProviders = providers

  // Migrate selectedAI -> selectedAIProvider
  const oldSelectedAI = raw.selectedAI as string | undefined
  if (oldSelectedAI) {
    raw.selectedAIProvider = OLD_AI_TO_NAME[oldSelectedAI] || DEFAULT_SELECTED_AI_PROVIDER
  } else {
    raw.selectedAIProvider = DEFAULT_SELECTED_AI_PROVIDER
  }

  // Remove old keys
  delete raw.ai
  delete raw.selectedAI

  return true
}

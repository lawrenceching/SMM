export interface AiProvider {
  name: string
  baseUrl: string
  models: string[]
}

/**
 * Common OpenAI-compatible providers for the AI settings UI.
 * Not persisted to user config; used only for combobox suggestions and defaults.
 */
export const COMMON_AI_PROVIDERS: AiProvider[] = [
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  },
  {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o', 'deepseek/deepseek-chat', 'anthropic/claude-3.5-sonnet'],
  },
  {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
  },
  {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  },
  {
    name: 'GLM (Zhipu)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-flash'],
  },
  {
    name: 'Moonshot (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k'],
  },
  {
    name: 'DashScope (Qwen)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-turbo'],
  },
  {
    name: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'],
  },
  {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  },
  {
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-large-latest', 'mistral-small-latest'],
  },
  {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo'],
  },
  {
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3.2', 'qwen2.5'],
  },
  {
    name: 'Azure OpenAI',
    baseUrl: 'https://{resource}.openai.azure.com/openai/deployments/{deployment}',
    models: ['gpt-4o'],
  },
  {
    name: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
    models: ['grok-2-latest'],
  },
  {
    name: 'Doubao (Volcengine)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-pro-32k'],
  },
]

const PRESET_BY_NAME = new Map(
  COMMON_AI_PROVIDERS.map((p) => [p.name, p] as const),
)

export const COMMON_AI_PROVIDER_NAMES = COMMON_AI_PROVIDERS.map((p) => p.name)

export function findPresetByName(name: string): AiProvider | undefined {
  const trimmed = name.trim()
  if (!trimmed) return undefined
  return PRESET_BY_NAME.get(trimmed)
}

export function getModelOptions(providerName: string, currentModel?: string): string[] {
  const preset = findPresetByName(providerName)
  const fromPreset = preset?.models ?? []
  const model = (currentModel ?? '').trim()
  if (!model) return [...fromPreset]
  if (fromPreset.includes(model)) return [...fromPreset]
  return [model, ...fromPreset]
}

/** Merge preset names with a custom value for combobox items. */
export function comboboxItemsFromOptions(options: string[], currentValue?: string): string[] {
  const items = [...options]
  const custom = (currentValue ?? '').trim()
  if (custom && !items.includes(custom)) {
    items.unshift(custom)
  }
  return items
}

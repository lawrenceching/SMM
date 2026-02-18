import { useState, useEffect, useMemo } from "react"
import { useConfig } from "@/providers/config-provider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { Button } from "@/components/ui/button"
import type { AI } from "@core/types"
import { useTranslation } from "@/lib/i18n"
import { nextTraceId } from "@/lib/utils"

const aiProviders: AI[] = ["OpenAI", "DeepSeek", "OpenRouter", "GLM", "Other"]

const aiProviderOptions: ComboboxOption[] = aiProviders.map((provider) => ({
  value: provider,
  label: provider,
}))

const providerKeyMap: Record<AI, keyof NonNullable<import("@core/types").AIConfig>> = {
  'OpenAI': 'openAI',
  'DeepSeek': 'deepseek',
  'OpenRouter': 'openrouter',
  'GLM': 'glm',
  'Other': 'other'
}

export function AiSettings() {
  const { userConfig, setAndSaveUserConfig } = useConfig()
  const { t } = useTranslation(['settings', 'common'])
  
  // Get initial values
  const initialSelectedProvider = (userConfig.selectedAI as AI) || "DeepSeek"
  const getInitialProviderConfig = (provider: AI) => {
    const providerKey = providerKeyMap[provider]
    const config = userConfig.ai?.[providerKey] || { baseURL: '', apiKey: '', model: '' }
    return {
      baseURL: config.baseURL || '',
      apiKey: config.apiKey || '',
      model: config.model || '',
    }
  }

  // Track initial state for all providers
  const initialState = useMemo(() => {
    const state: Record<AI, { baseURL: string; apiKey: string; model: string }> = {} as any
    aiProviders.forEach(provider => {
      state[provider] = getInitialProviderConfig(provider)
    })
    return {
      selectedProvider: initialSelectedProvider,
      configs: state,
    }
  }, [userConfig])

  // Track current form state
  const [selectedProvider, setSelectedProvider] = useState<AI>(initialState.selectedProvider)
  const [providerConfigs, setProviderConfigs] = useState<Record<AI, { baseURL: string; apiKey: string; model: string }>>(initialState.configs)

  // Reset form when userConfig changes
  useEffect(() => {
    const newInitialState = {
      selectedProvider: (userConfig.selectedAI as AI) || "DeepSeek",
      configs: {} as Record<AI, { baseURL: string; apiKey: string; model: string }>,
    }
    aiProviders.forEach(provider => {
      newInitialState.configs[provider] = getInitialProviderConfig(provider)
    })
    setSelectedProvider(newInitialState.selectedProvider)
    setProviderConfigs(newInitialState.configs)
  }, [userConfig])

  // Get current provider config
  const currentConfig = providerConfigs[selectedProvider] || { baseURL: '', apiKey: '', model: '' }

  // Update config when provider changes
  const handleProviderChange = (value: AI) => {
    setSelectedProvider(value)
  }

  // Update config values
  const updateConfig = (provider: AI, field: 'baseURL' | 'apiKey' | 'model', value: string) => {
    setProviderConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    }))
  }

  // Detect changes
  const hasChanges = useMemo(() => {
    if (selectedProvider !== initialState.selectedProvider) {
      return true
    }
    for (const provider of aiProviders) {
      const current = providerConfigs[provider]
      const initial = initialState.configs[provider]
      if (
        current.baseURL !== initial.baseURL ||
        current.apiKey !== initial.apiKey ||
        current.model !== initial.model
      ) {
        return true
      }
    }
    return false
  }, [selectedProvider, providerConfigs, initialState])

  // Handle save
  const handleSave = () => {
    const traceId = `AiSettings-${nextTraceId()}`;
    console.log(`[${traceId}] AiSettings: Saving AI settings`)

    // Build complete AIConfig with all providers, starting with existing values
    const existingAi = userConfig.ai
    const updatedAiConfig: import("@core/types").AIConfig = {
      deepseek: existingAi?.deepseek || { baseURL: '', apiKey: '', model: '' },
      openAI: existingAi?.openAI || { baseURL: '', apiKey: '', model: '' },
      openrouter: existingAi?.openrouter || { baseURL: '', apiKey: '', model: '' },
      glm: existingAi?.glm || { baseURL: '', apiKey: '', model: '' },
      other: existingAi?.other || { baseURL: '', apiKey: '', model: '' },
    }

    // Update all provider configs with current form values
    aiProviders.forEach(provider => {
      const providerKey = providerKeyMap[provider]
      const config = providerConfigs[provider]
      updatedAiConfig[providerKey] = {
        baseURL: config.baseURL || undefined,
        apiKey: config.apiKey || undefined,
        model: config.model || undefined,
      }
    })

    const updatedConfig = {
      ...userConfig,
      selectedAI: selectedProvider,
      ai: updatedAiConfig,
    }
    console.log(`[${traceId}] AiSettings: Selected AI provider: ${selectedProvider}`)
    setAndSaveUserConfig(traceId, updatedConfig)
  }

  const providerKey = selectedProvider.toLowerCase()

  return (
    <div className="space-y-6 p-6 relative" data-testid="ai-settings">
      <div>
        <h2 className="text-2xl font-semibold mb-4">{t('ai.title')}</h2>
        <p className="text-muted-foreground mb-6">
          {t('ai.description')}
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="selected-ai">{t('ai.selectProvider')}</Label>
          <Combobox
            options={aiProviderOptions}
            value={selectedProvider}
            onValueChange={(value) => handleProviderChange(value as AI)}
            placeholder={t('ai.selectProviderPlaceholder')}
            searchPlaceholder={t('ai.searchPlaceholder')}
            emptyText={t('ai.noProviderFound')}
            className="w-full"
            data-testid="setting-ai-provider"
          />
        </div>

        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-semibold text-lg">{t('ai.configuration', { provider: selectedProvider })}</h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${providerKey}-baseurl`}>{t('ai.baseUrl')}</Label>
              <Input
                id={`${providerKey}-baseurl`}
                value={currentConfig.baseURL}
                onChange={(e) => updateConfig(selectedProvider, 'baseURL', e.target.value)}
                placeholder={t('ai.baseUrlPlaceholder')}
                data-testid="setting-ai-base-url"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${providerKey}-apikey`}>{t('ai.apiKey')}</Label>
              <Input
                id={`${providerKey}-apikey`}
                type="password"
                value={currentConfig.apiKey}
                onChange={(e) => updateConfig(selectedProvider, 'apiKey', e.target.value)}
                placeholder={t('ai.apiKeyPlaceholder')}
                data-testid="setting-ai-api-key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${providerKey}-model`}>{t('ai.model')}</Label>
              <Input
                id={`${providerKey}-model`}
                value={currentConfig.model}
                onChange={(e) => updateConfig(selectedProvider, 'model', e.target.value)}
                placeholder={t('ai.modelPlaceholder')}
                data-testid="setting-ai-model"
              />
            </div>
          </div>
        </div>
      </div>

      {hasChanges && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button onClick={handleSave} data-testid="settings-save-button">
            {t('save', { ns: 'common' })}
          </Button>
        </div>
      )}
    </div>
  )
}


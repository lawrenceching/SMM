import { useState, useEffect, useMemo } from "react"
import { useConfig } from "@/components/config-provider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { Button } from "@/components/ui/button"
import type { AI } from "@core/types"

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
  const { userConfig, setUserConfig } = useConfig()
  
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
    setUserConfig(updatedConfig)
  }

  const providerKey = selectedProvider.toLowerCase()

  return (
    <div className="space-y-6 p-6 relative">
      <div>
        <h2 className="text-2xl font-semibold mb-4">AI Settings</h2>
        <p className="text-muted-foreground mb-6">
          Configure AI provider settings for media metadata processing
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="selected-ai">Select AI Provider</Label>
          <Combobox
            options={aiProviderOptions}
            value={selectedProvider}
            onValueChange={(value) => handleProviderChange(value as AI)}
            placeholder="Select AI provider..."
            searchPlaceholder="Search AI providers..."
            emptyText="No AI provider found."
            className="w-full"
          />
        </div>

        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-semibold text-lg">{selectedProvider} Configuration</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${providerKey}-baseurl`}>Base URL</Label>
              <Input
                id={`${providerKey}-baseurl`}
                value={currentConfig.baseURL}
                onChange={(e) => updateConfig(selectedProvider, 'baseURL', e.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${providerKey}-apikey`}>API Key</Label>
              <Input
                id={`${providerKey}-apikey`}
                type="password"
                value={currentConfig.apiKey}
                onChange={(e) => updateConfig(selectedProvider, 'apiKey', e.target.value)}
                placeholder="Enter your API key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${providerKey}-model`}>Model</Label>
              <Input
                id={`${providerKey}-model`}
                value={currentConfig.model}
                onChange={(e) => updateConfig(selectedProvider, 'model', e.target.value)}
                placeholder="model-name"
              />
            </div>
          </div>
        </div>
      </div>

      {hasChanges && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button onClick={handleSave}>
            Save
          </Button>
        </div>
      )}
    </div>
  )
}


import { useState } from "react"
import { useConfig } from "@/components/config-provider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import type { AI } from "@core/types"

const aiProviders: AI[] = ["OpenAI", "DeepSeek", "OpenRouter", "GLM", "Other"]

const aiProviderOptions: ComboboxOption[] = aiProviders.map((provider) => ({
  value: provider,
  label: provider,
}))

export function AiSettings() {
  const { userConfig } = useConfig()
  const [selectedProvider, setSelectedProvider] = useState<AI>(
    (userConfig.selectedAI as AI) || "DeepSeek"
  )

  const getProviderConfig = (provider: AI) => {
    const providerKeyMap: Record<AI, keyof NonNullable<typeof userConfig.ai>> = {
      'OpenAI': 'openAI',
      'DeepSeek': 'deepseek',
      'OpenRouter': 'openrouter',
      'GLM': 'glm',
      'Other': 'other'
    }
    const providerKey = providerKeyMap[provider]
    return userConfig.ai?.[providerKey] || { baseURL: '', apiKey: '', model: '' }
  }

  const config = getProviderConfig(selectedProvider)
  const providerKey = selectedProvider.toLowerCase()

  return (
    <div className="space-y-6 p-6">
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
            onValueChange={(value) => setSelectedProvider(value as AI)}
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
                defaultValue={config.baseURL || ''}
                placeholder="https://api.example.com/v1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${providerKey}-apikey`}>API Key</Label>
              <Input
                id={`${providerKey}-apikey`}
                type="password"
                defaultValue={config.apiKey || ''}
                placeholder="Enter your API key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${providerKey}-model`}>Model</Label>
              <Input
                id={`${providerKey}-model`}
                defaultValue={config.model || ''}
                placeholder="model-name"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


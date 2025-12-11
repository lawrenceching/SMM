import { useConfig } from "@/components/config-provider"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { AI } from "@core/types"

const aiProviders: AI[] = ["OpenAI", "DeepSeek", "OpenRouter", "GLM", "Other"]

export function AiSettings() {
  const { userConfig } = useConfig()

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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">AI Settings</h2>
        <p className="text-muted-foreground mb-6">
          Configure AI provider settings for media metadata processing
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="selected-ai">Selected AI Provider</Label>
          <Select defaultValue={userConfig.selectedAI || 'DeepSeek'}>
            <SelectTrigger id="selected-ai">
              <SelectValue placeholder="Select AI provider" />
            </SelectTrigger>
            <SelectContent>
              {aiProviders.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {aiProviders.map((provider) => {
          const config = getProviderConfig(provider)
          const providerKey = provider.toLowerCase()

          return (
            <div key={provider} className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">{provider} Configuration</h3>
              
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
          )
        })}
      </div>
    </div>
  )
}


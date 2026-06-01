import { useState, useEffect, useMemo, useCallback } from "react"
import { useConfig } from "@/hooks/userConfig"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AiProviderNameCombobox } from "@/components/ui/settings/AiProviderNameCombobox"
import { AiModelCombobox } from "@/components/ui/settings/AiModelCombobox"
import { findPresetByName, getModelOptions, type AiProvider } from "@/lib/ai-provider-presets"
import type { OpenAICompatibleConfig } from "@core/types"
import { useTranslation } from "@/lib/i18n"
import { nextTraceId } from "@/lib/utils"
import { checkAiConnection } from "@/api/checkAiConnection"
import { Trash2, Plus, CircleCheck, Circle } from "lucide-react"

interface CheckState {
  status: 'idle' | 'checking' | 'ok' | 'error'
  message: string
}

export function AiSettings() {
  const { userConfig, setAndSaveUserConfig } = useConfig()
  const { t } = useTranslation(['settings', 'common'])

  const initialProviders: OpenAICompatibleConfig[] = useMemo(() => {
    if (userConfig.aiProviders && userConfig.aiProviders.length > 0) {
      return userConfig.aiProviders.map(p => ({ ...p }))
    }
    return []
  }, [userConfig.aiProviders])

  const initialActive = userConfig.selectedAIProvider || ''

  const [providers, setProviders] = useState<OpenAICompatibleConfig[]>(initialProviders)
  const [activeProviderName, setActiveProviderName] = useState(initialActive)
  const [checkStates, setCheckStates] = useState<Record<number, CheckState>>({})
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({})

  useEffect(() => {
    const newProviders = userConfig.aiProviders?.length
      ? userConfig.aiProviders.map(p => ({ ...p }))
      : []
    setProviders(newProviders)
    setActiveProviderName(userConfig.selectedAIProvider || '')
    setCheckStates({})
  }, [userConfig])

  const hasChanges = useMemo(() => {
    const orig = userConfig.aiProviders || []
    if (providers.length !== orig.length) return true
    for (let i = 0; i < providers.length; i++) {
      const p = providers[i]
      const o = orig[i]
      if (p.name !== o.name || p.baseURL !== o.baseURL || p.apiKey !== o.apiKey || p.model !== o.model) {
        return true
      }
    }
    if (activeProviderName !== (userConfig.selectedAIProvider || '')) return true
    return false
  }, [providers, activeProviderName, userConfig])

  const validateUniqueNames = useCallback((list: OpenAICompatibleConfig[]): Record<number, string> => {
    const errors: Record<number, string> = {}
    const seen = new Map<string, number>()
    list.forEach((p, i) => {
      const name = (p.name || '').trim()
      if (!name) {
        errors[i] = t('ai.nameRequired')
      } else if (seen.has(name)) {
        errors[i] = t('ai.nameDuplicate', { name })
        const firstIdx = seen.get(name)!
        errors[firstIdx] = t('ai.nameDuplicate', { name })
      } else {
        seen.set(name, i)
      }
    })
    return errors
  }, [t])

  const updateProvider = (index: number, field: keyof OpenAICompatibleConfig, value: string) => {
    setProviders(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      if (field === 'name') {
        setValidationErrors(validateUniqueNames(next))
      }
      return next
    })
  }

  const applyPresetToProvider = (index: number, preset: AiProvider, name: string) => {
    setProviders(prev => {
      const next = [...prev]
      const current = next[index]
      next[index] = {
        ...current,
        name,
        baseURL: (current.baseURL ?? '').trim() ? current.baseURL : preset.baseUrl,
        model: (current.model ?? '').trim() ? current.model : (preset.models[0] ?? ''),
      }
      setValidationErrors(validateUniqueNames(next))
      return next
    })
  }

  const handleProviderNameChange = (index: number, name: string) => {
    const preset = findPresetByName(name)
    if (preset) {
      applyPresetToProvider(index, preset, name)
    } else {
      updateProvider(index, 'name', name)
    }
  }

  const setActive = (name: string | undefined) => {
    if (name) {
      setActiveProviderName(name)
    }
  }

  const addProvider = () => {
    const newProvider: OpenAICompatibleConfig = {
      name: `provider-${providers.length + 1}`,
      baseURL: '',
      apiKey: '',
      model: '',
    }
    setProviders(prev => [...prev, newProvider])
  }

  const deleteProvider = (index: number) => {
    if (providers.length <= 1) return
    const deleted = providers[index]
    setProviders(prev => prev.filter((_, i) => i !== index))
    setCheckStates(prev => {
      const next = { ...prev }
      delete next[index]
      return next
    })
    if (deleted.name === activeProviderName) {
      const remaining = providers.filter((_, i) => i !== index)
      if (remaining.length > 0) {
        setActiveProviderName(remaining[0].name!)
      }
    }
  }

  const handleCheck = async (index: number) => {
    const provider = providers[index]
    if (!provider) return
    const { baseURL, apiKey, model } = provider
    if (!baseURL || !model) return

    setCheckStates(prev => ({ ...prev, [index]: { status: 'checking', message: '' } }))
    try {
      const result = await checkAiConnection(model!, apiKey || '', baseURL)
      setCheckStates(prev => ({
        ...prev,
        [index]: {
          status: result.status === 'ok' ? 'ok' : 'error',
          message: result.status !== 'ok' ? t('ai.checkError') : '',
        }
      }))
    } catch (err) {
      setCheckStates(prev => ({
        ...prev,
        [index]: {
          status: 'error',
          message: err instanceof Error ? err.message : t('ai.checkError'),
        }
      }))
    }
  }

  const handleSave = () => {
    const traceId = `AiSettings-${nextTraceId()}`
    const errors = validateUniqueNames(providers)
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }
    setAndSaveUserConfig(traceId, {
      ...userConfig,
      aiProviders: providers,
      selectedAIProvider: activeProviderName,
    })
  }

  const canDelete = providers.length > 1

  return (
    <div className="space-y-6 p-6 relative" data-testid="ai-settings">
      <div>
        <h2 className="text-2xl font-semibold mb-4">{t('ai.title')}</h2>
        <p className="text-muted-foreground mb-6">
          {t('ai.description')}
        </p>
      </div>

      {providers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t('ai.noProviders')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {providers.map((provider, index) => {
            const isActive = provider.name === activeProviderName
            const checkState = checkStates[index]
            return (
              <div
                key={index}
                className={`space-y-3 p-4 border rounded-lg ${isActive ? 'border-primary bg-primary/5' : ''}`}
                data-testid={`ai-provider-card-${index}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setActive(provider.name)}
                    className="flex-shrink-0 mt-1"
                    data-testid={`ai-provider-radio-${index}`}
                    aria-label={t('ai.setActive')}
                  >
                    {isActive ? (
                      <CircleCheck className="h-5 w-5 text-primary fill-primary" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>

                  <div className="flex-1 space-y-2 min-w-0">
                    <Label htmlFor={`provider-name-${index}`}>{t('ai.providerName')}</Label>
                    <AiProviderNameCombobox
                      id={`provider-name-${index}`}
                      value={provider.name || ''}
                      onValueChange={(name) => handleProviderNameChange(index, name)}
                      placeholder={t('ai.providerNamePlaceholder')}
                      data-testid={`ai-provider-name-${index}`}
                      invalid={!!validationErrors[index]}
                    />
                    {validationErrors[index] && (
                      <p className="text-sm text-destructive">{validationErrors[index]}</p>
                    )}
                  </div>

                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteProvider(index)}
                      data-testid={`ai-provider-delete-${index}`}
                      aria-label={t('ai.deleteProvider')}
                      className="flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-8">
                  <div className="space-y-2">
                    <Label htmlFor={`provider-baseurl-${index}`}>{t('ai.baseUrl')}</Label>
                    <Input
                      id={`provider-baseurl-${index}`}
                      value={provider.baseURL || ''}
                      onChange={(e) => updateProvider(index, 'baseURL', e.target.value)}
                      placeholder={t('ai.baseUrlPlaceholder')}
                      data-testid={`ai-provider-baseurl-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`provider-apikey-${index}`}>{t('ai.apiKey')}</Label>
                    <Input
                      id={`provider-apikey-${index}`}
                      type="password"
                      value={provider.apiKey || ''}
                      onChange={(e) => updateProvider(index, 'apiKey', e.target.value)}
                      placeholder={t('ai.apiKeyPlaceholder')}
                      data-testid={`ai-provider-apikey-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`provider-model-${index}`}>{t('ai.model')}</Label>
                    <AiModelCombobox
                      id={`provider-model-${index}`}
                      value={provider.model || ''}
                      onValueChange={(model) => updateProvider(index, 'model', model)}
                      modelOptions={getModelOptions(provider.name || '', provider.model)}
                      placeholder={t('ai.modelPlaceholder')}
                      data-testid={`ai-provider-model-${index}`}
                    />
                  </div>
                </div>

                <div className="ml-8 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCheck(index)}
                    disabled={checkState?.status === 'checking' || !provider.baseURL || !provider.model}
                    data-testid={`ai-provider-check-${index}`}
                  >
                    {checkState?.status === 'checking' ? t('ai.checkChecking') : t('ai.check')}
                  </Button>

                  {checkState?.status === 'ok' && (
                    <p className="text-sm text-green-600" data-testid={`ai-provider-check-success-${index}`}>
                      {t('ai.checkSuccess')}
                    </p>
                  )}
                  {checkState?.status === 'error' && (
                    <p className="text-sm text-red-600" data-testid={`ai-provider-check-error-${index}`}>
                      {checkState.message || t('ai.checkError')}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Button
        variant="outline"
        onClick={addProvider}
        data-testid="ai-add-provider"
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        {t('ai.addProvider')}
      </Button>

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

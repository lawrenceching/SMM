import { useState, useEffect, useMemo } from "react"
import { useConfig } from "@/providers/config-provider"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SUPPORTED_LANGUAGES, changeLanguage, type SupportedLanguage } from "@/lib/i18n"
import { useTranslation } from "@/lib/i18n"
import { nextTraceId } from "@/lib/utils"

export function GeneralSettings() {
  const { userConfig, setUserConfig } = useConfig()
  const { t } = useTranslation(['settings', 'common'])
  
  // Track initial values
  const initialValues = useMemo(() => ({
    applicationLanguage: userConfig.applicationLanguage || 'zh-CN',
    tmdbHost: userConfig.tmdb?.host || '',
    tmdbApiKey: userConfig.tmdb?.apiKey || '',
    tmdbProxy: userConfig.tmdb?.httpProxy || '',
  }), [userConfig])

  // Track current form values
  const [applicationLanguage, setApplicationLanguage] = useState<SupportedLanguage>(initialValues.applicationLanguage as SupportedLanguage)
  const [tmdbHost, setTmdbHost] = useState(initialValues.tmdbHost)
  const [tmdbApiKey, setTmdbApiKey] = useState(initialValues.tmdbApiKey)
  const [tmdbProxy, setTmdbProxy] = useState(initialValues.tmdbProxy)

  // Reset form when userConfig changes
  useEffect(() => {
    setApplicationLanguage(initialValues.applicationLanguage)
    setTmdbHost(initialValues.tmdbHost)
    setTmdbApiKey(initialValues.tmdbApiKey)
    setTmdbProxy(initialValues.tmdbProxy)
  }, [initialValues])

  // Detect changes
  const hasChanges = useMemo(() => {
    return (
      applicationLanguage !== initialValues.applicationLanguage ||
      tmdbHost !== initialValues.tmdbHost ||
      tmdbApiKey !== initialValues.tmdbApiKey ||
      tmdbProxy !== initialValues.tmdbProxy
    )
  }, [applicationLanguage, tmdbHost, tmdbApiKey, tmdbProxy, initialValues])

  // Handle save
  const handleSave = async () => {
    const traceId = `GeneralSettings-${nextTraceId()}`;
    console.log(`[${traceId}] GeneralSettings: Saving general settings`)

    // Change i18n language if language changed
    if (applicationLanguage !== userConfig.applicationLanguage) {
      console.log(`[${traceId}] GeneralSettings: Changing language to ${applicationLanguage}`)
      await changeLanguage(applicationLanguage)
    }

    const updatedConfig = {
      ...userConfig,
      applicationLanguage: applicationLanguage,
      tmdb: {
        ...userConfig.tmdb,
        host: tmdbHost || undefined,
        apiKey: tmdbApiKey || undefined,
        httpProxy: tmdbProxy || undefined,
      },
    }
    setUserConfig(traceId, updatedConfig)
  }

  return (
    <div className="space-y-6 p-6 relative">
      <div>
        <h2 className="text-2xl font-semibold mb-4">{t('title')}</h2>
        <p className="text-muted-foreground mb-6">
          {t('general.title')}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="language">{t('general.language')}</Label>
          <Select 
            value={applicationLanguage} 
            onValueChange={(value) => setApplicationLanguage(value as SupportedLanguage)}
          >
            <SelectTrigger id="language">
              <SelectValue placeholder={t('general.languageDescription')} />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{t('general.languageDescription')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tmdb-host">{t('general.tmdbHost')}</Label>
          <Input
            id="tmdb-host"
            value={tmdbHost}
            onChange={(e) => setTmdbHost(e.target.value)}
            placeholder={t('general.tmdbHostPlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tmdb-api-key">{t('general.tmdbApiKey')}</Label>
          <Input
            id="tmdb-api-key"
            type="password"
            value={tmdbApiKey}
            onChange={(e) => setTmdbApiKey(e.target.value)}
            placeholder={t('general.tmdbApiKeyPlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tmdb-proxy">{t('general.httpProxy')}</Label>
          <Input
            id="tmdb-proxy"
            value={tmdbProxy}
            onChange={(e) => setTmdbProxy(e.target.value)}
            placeholder={t('general.httpProxyPlaceholder')}
          />
        </div>
      </div>

      {hasChanges && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button onClick={handleSave}>
            {t('save', { ns: 'common' })}
          </Button>
        </div>
      )}
    </div>
  )
}


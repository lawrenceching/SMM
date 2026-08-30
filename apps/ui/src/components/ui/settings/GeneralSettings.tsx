import { useState, useEffect, useMemo } from "react"
import { useConfig } from "@/hooks/userConfig"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SUPPORTED_APP_LANGUAGES, changeLanguage, type SupportedLanguage } from "@/lib/i18n"
import { useTranslation } from "@/lib/i18n"
import { nextTraceId } from "@/lib/utils"
import { useTheme } from "@/providers/theme-provider"
import type { PreferMediaLanguage } from "@core/types"
import { resolveAppLanguage } from "@core/locale"
import { useHelloQuery } from "@/hooks/userConfig/useHelloQuery"
import {
  useStartMcpServerMutation,
  useStopMcpServerMutation,
} from "@/hooks/useMcpServerStatus"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const THEME_OPTIONS = ["light", "dark", "system"] as const

const APPLICATION_LANGUAGE_UNSET = "__unset__"
type ApplicationLanguageFormValue = SupportedLanguage | typeof APPLICATION_LANGUAGE_UNSET
const PREFER_MEDIA_LANGUAGE_UNSET = "__unset__"
const APPLICATION_LANGUAGE_OPTIONS: Array<{
  value: SupportedLanguage | typeof APPLICATION_LANGUAGE_UNSET
  labelKey: "general.applicationLanguageUnset" | null
  name?: string
}> = [
  { value: APPLICATION_LANGUAGE_UNSET, labelKey: "general.applicationLanguageUnset" },
  ...SUPPORTED_APP_LANGUAGES.map((lang) => ({
    value: lang.code,
    labelKey: null as null,
    name: lang.name,
  })),
]
const PREFER_MEDIA_LANGUAGE_OPTIONS: Array<{
  value: PreferMediaLanguage | typeof PREFER_MEDIA_LANGUAGE_UNSET
  labelKey:
    | "general.preferMediaLanguageUnset"
    | "general.preferMediaLanguageZhCn"
    | "general.preferMediaLanguageEnUs"
    | "general.preferMediaLanguageJaJp"
}> = [
  { value: PREFER_MEDIA_LANGUAGE_UNSET, labelKey: "general.preferMediaLanguageUnset" },
  { value: "zh-CN", labelKey: "general.preferMediaLanguageZhCn" },
  { value: "en-US", labelKey: "general.preferMediaLanguageEnUs" },
  { value: "ja-JP", labelKey: "general.preferMediaLanguageJaJp" },
]

export function GeneralSettings() {
  const { theme, setTheme } = useTheme()
  const { userConfig, setAndSaveUserConfig } = useConfig()
  const helloQuery = useHelloQuery()
  const startMcpServerMutation = useStartMcpServerMutation()
  const stopMcpServerMutation = useStopMcpServerMutation()
  const { t } = useTranslation(['settings', 'common'])

  // Track initial values
  const initialValues = useMemo(() => ({
    applicationLanguage: (userConfig.applicationLanguage ??
      APPLICATION_LANGUAGE_UNSET) as ApplicationLanguageFormValue,
    preferMediaLanguage: userConfig.preferMediaLanguage || PREFER_MEDIA_LANGUAGE_UNSET,
    anonymousTelemetryConsent: userConfig.anonymousTelemetryConsent ?? false,
    enableMcpServer: userConfig.enableMcpServer ?? false,
    mcpHost: userConfig.mcpHost ?? '127.0.0.1',
    mcpPort: userConfig.mcpPort ?? 30001,
  }), [userConfig])

  // Track current form values
  const [applicationLanguage, setApplicationLanguage] = useState<ApplicationLanguageFormValue>(
    initialValues.applicationLanguage,
  )
  const [preferMediaLanguage, setPreferMediaLanguage] = useState<PreferMediaLanguage | typeof PREFER_MEDIA_LANGUAGE_UNSET>(initialValues.preferMediaLanguage as PreferMediaLanguage | typeof PREFER_MEDIA_LANGUAGE_UNSET)
  const [anonymousTelemetryConsent, setAnonymousTelemetryConsent] = useState(initialValues.anonymousTelemetryConsent)
  const [enableMcpServer, setEnableMcpServer] = useState(initialValues.enableMcpServer)
  const [mcpHost, setMcpHost] = useState(initialValues.mcpHost)
  const [mcpPort, setMcpPort] = useState(String(initialValues.mcpPort))

  // Reset form when userConfig changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setApplicationLanguage(initialValues.applicationLanguage)
    setPreferMediaLanguage(initialValues.preferMediaLanguage as PreferMediaLanguage | typeof PREFER_MEDIA_LANGUAGE_UNSET)
    setAnonymousTelemetryConsent(initialValues.anonymousTelemetryConsent)
    setEnableMcpServer(initialValues.enableMcpServer)
    setMcpHost(initialValues.mcpHost)
    setMcpPort(String(initialValues.mcpPort))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialValues])

  // Detect changes
  const hasChanges = useMemo(() => {
    return (
      applicationLanguage !== initialValues.applicationLanguage ||
      preferMediaLanguage !== initialValues.preferMediaLanguage ||
      anonymousTelemetryConsent !== initialValues.anonymousTelemetryConsent ||
      enableMcpServer !== initialValues.enableMcpServer ||
      mcpHost !== initialValues.mcpHost ||
      mcpPort !== String(initialValues.mcpPort)
    )
  }, [
    applicationLanguage,
    preferMediaLanguage,
    anonymousTelemetryConsent,
    enableMcpServer,
    mcpHost,
    mcpPort,
    initialValues,
  ])

  // Handle save
  const handleSave = async () => {
    const traceId = `GeneralSettings-${nextTraceId()}`;
    console.log(`[${traceId}] GeneralSettings: Saving general settings`)

    const savedApplicationLanguage =
      applicationLanguage === APPLICATION_LANGUAGE_UNSET ? undefined : applicationLanguage

    // Change i18n language if language changed
    if (savedApplicationLanguage !== userConfig.applicationLanguage) {
      const resolved = resolveAppLanguage({
        configured: savedApplicationLanguage,
        browserLocale: typeof navigator !== "undefined" ? navigator.language : undefined,
        osLocale: helloQuery.data?.osLocale,
      })
      console.log(`[${traceId}] GeneralSettings: Changing language to ${resolved}`)
      await changeLanguage(resolved)
    }

    const parsedMcpPort = Number(mcpPort)
    const resolvedMcpPort =
      Number.isNaN(parsedMcpPort) || parsedMcpPort <= 0 ? 30001 : parsedMcpPort

    const nonMcpConfig = {
      ...userConfig,
      applicationLanguage: savedApplicationLanguage,
      preferMediaLanguage: preferMediaLanguage === PREFER_MEDIA_LANGUAGE_UNSET ? undefined : preferMediaLanguage,
      anonymousTelemetryConsent,
    }
    await setAndSaveUserConfig(traceId, nonMcpConfig)

    // MCP changes go through Core APIs; Core persists MCP fields in smm.json.
    const mcpToggledOn = enableMcpServer && !initialValues.enableMcpServer
    const mcpToggledOff = !enableMcpServer && initialValues.enableMcpServer
    const mcpHostOrPortChanged =
      mcpHost !== initialValues.mcpHost ||
      mcpPort !== String(initialValues.mcpPort)

    try {
      if (mcpToggledOff) {
        await stopMcpServerMutation.mutateAsync()
      } else if (mcpToggledOn) {
        await startMcpServerMutation.mutateAsync({ host: mcpHost, port: resolvedMcpPort })
      } else if (enableMcpServer && mcpHostOrPortChanged) {
        await stopMcpServerMutation.mutateAsync()
        await startMcpServerMutation.mutateAsync({ host: mcpHost, port: resolvedMcpPort })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[${traceId}] MCP server sync failed:`, msg)
    }
  }

  return (
    <div className="space-y-6 p-6 relative" data-testid="general-settings">
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
            onValueChange={(value) =>
              setApplicationLanguage(value as SupportedLanguage | typeof APPLICATION_LANGUAGE_UNSET)
            }
          >
            <SelectTrigger id="language" data-testid="setting-language-trigger">
              <SelectValue placeholder={t('general.languageDescription')} />
            </SelectTrigger>
            <SelectContent data-testid="setting-language-content">
              {APPLICATION_LANGUAGE_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  data-testid={`setting-language-option-${opt.value}`}
                >
                  {opt.labelKey ? t(opt.labelKey) : opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{t('general.languageDescription')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme-mode">{t('general.theme')}</Label>
          <Select
            value={theme}
            onValueChange={(value) =>
              setTheme(value as (typeof THEME_OPTIONS)[number])
            }
          >
            <SelectTrigger id="theme-mode" data-testid="setting-theme-trigger">
              <SelectValue placeholder={t('general.themeDescription')} />
            </SelectTrigger>
            <SelectContent data-testid="setting-theme-content">
              <SelectItem value="light" data-testid="setting-theme-light">
                {t('general.themeLight')}
              </SelectItem>
              <SelectItem value="dark" data-testid="setting-theme-dark">
                {t('general.themeDark')}
              </SelectItem>
              <SelectItem value="system" data-testid="setting-theme-system">
                {t('general.themeSystem')}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {t('general.themeDescription')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prefer-media-language">{t('general.preferMediaLanguage')}</Label>
          <Select
            value={preferMediaLanguage}
            onValueChange={(v) => setPreferMediaLanguage(v as PreferMediaLanguage | typeof PREFER_MEDIA_LANGUAGE_UNSET)}
          >
            <SelectTrigger id="prefer-media-language" data-testid="setting-prefer-media-language-trigger">
              <SelectValue placeholder={t('general.preferMediaLanguageDescription')} />
            </SelectTrigger>
            <SelectContent data-testid="setting-prefer-media-language-content">
              {PREFER_MEDIA_LANGUAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} data-testid={`setting-prefer-media-language-option-${opt.value}`}>
                  {t(opt.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{t('general.preferMediaLanguageDescription')}</p>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="anonymous-telemetry-consent"
                type="checkbox"
                checked={anonymousTelemetryConsent}
                onChange={(e) => setAnonymousTelemetryConsent(e.target.checked)}
                className="h-4 w-4 rounded border-input"
                data-testid="setting-anonymous-telemetry-consent"
              />
              <Label htmlFor="anonymous-telemetry-consent">
                {t("general.anonymousTelemetryConsent")}
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("general.anonymousTelemetryConsentDescription")}
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="enable-mcp-server"
                type="checkbox"
                checked={enableMcpServer}
                onChange={(e) => setEnableMcpServer(e.target.checked)}
                className="h-4 w-4 rounded border-input"
                data-testid="setting-enable-mcp-server"
              />
              <Label htmlFor="enable-mcp-server">{t('general.enableMcpServer')}</Label>
            </div>
            <p className="text-sm text-muted-foreground">{t('general.enableMcpServerDescription')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mcp-host">{t('general.mcpHost')}</Label>
            <Input
              id="mcp-host"
              value={mcpHost}
              onChange={(e) => setMcpHost(e.target.value)}
              placeholder={t('general.mcpHostPlaceholder')}
              data-testid="setting-mcp-host"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mcp-port">{t('general.mcpPort')}</Label>
            <Input
              id="mcp-port"
              type="number"
              value={mcpPort}
              onChange={(e) => setMcpPort(e.target.value)}
              placeholder={t('general.mcpPortPlaceholder')}
              data-testid="setting-mcp-port"
            />
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


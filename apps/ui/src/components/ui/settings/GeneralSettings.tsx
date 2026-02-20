import { useState, useEffect, useMemo } from "react"
import { useConfig } from "@/providers/config-provider"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SUPPORTED_LANGUAGES, changeLanguage, type SupportedLanguage } from "@/lib/i18n"
import { useTranslation } from "@/lib/i18n"
import { nextTraceId } from "@/lib/utils"
import { useDialogs } from "@/providers/dialog-provider"
import type { FileItem } from "@/components/dialogs/types"

export function GeneralSettings() {
  const { userConfig, setAndSaveUserConfig } = useConfig()
  const { t } = useTranslation(['settings', 'common'])
  const { filePickerDialog } = useDialogs()
  const [openFilePicker] = filePickerDialog

  // Track initial values
  const initialValues = useMemo(() => ({
    applicationLanguage: userConfig.applicationLanguage || 'zh-CN',
    tmdbHost: userConfig.tmdb?.host || '',
    tmdbApiKey: userConfig.tmdb?.apiKey || '',
    tmdbProxy: userConfig.tmdb?.httpProxy || '',
    enableMcpServer: userConfig.enableMcpServer ?? false,
    mcpHost: userConfig.mcpHost ?? '127.0.0.1',
    mcpPort: userConfig.mcpPort ?? 30001,
    ytdlpExecutablePath: userConfig.ytdlpExecutablePath || '',
    ffmpegExecutablePath: userConfig.ffmpegExecutablePath || '',
  }), [userConfig])

  // Track current form values
  const [applicationLanguage, setApplicationLanguage] = useState<SupportedLanguage>(initialValues.applicationLanguage as SupportedLanguage)
  const [tmdbHost, setTmdbHost] = useState(initialValues.tmdbHost)
  const [tmdbApiKey, setTmdbApiKey] = useState(initialValues.tmdbApiKey)
  const [tmdbProxy, setTmdbProxy] = useState(initialValues.tmdbProxy)
  const [enableMcpServer, setEnableMcpServer] = useState(initialValues.enableMcpServer)
  const [mcpHost, setMcpHost] = useState(initialValues.mcpHost)
  const [mcpPort, setMcpPort] = useState(String(initialValues.mcpPort))
  const [ytdlpExecutablePath, setYtdlpExecutablePath] = useState(initialValues.ytdlpExecutablePath)
  const [ffmpegExecutablePath, setFfmpegExecutablePath] = useState(initialValues.ffmpegExecutablePath)

  // Reset form when userConfig changes
  useEffect(() => {
    setApplicationLanguage(initialValues.applicationLanguage)
    setTmdbHost(initialValues.tmdbHost)
    setTmdbApiKey(initialValues.tmdbApiKey)
    setTmdbProxy(initialValues.tmdbProxy)
    setEnableMcpServer(initialValues.enableMcpServer)
    setMcpHost(initialValues.mcpHost)
    setMcpPort(String(initialValues.mcpPort))
    setYtdlpExecutablePath(initialValues.ytdlpExecutablePath)
    setFfmpegExecutablePath(initialValues.ffmpegExecutablePath)
  }, [initialValues])

  // Detect changes
  const hasChanges = useMemo(() => {
    return (
      applicationLanguage !== initialValues.applicationLanguage ||
      tmdbHost !== initialValues.tmdbHost ||
      tmdbApiKey !== initialValues.tmdbApiKey ||
      tmdbProxy !== initialValues.tmdbProxy ||
      enableMcpServer !== initialValues.enableMcpServer ||
      mcpHost !== initialValues.mcpHost ||
      mcpPort !== String(initialValues.mcpPort) ||
      ytdlpExecutablePath !== initialValues.ytdlpExecutablePath ||
      ffmpegExecutablePath !== initialValues.ffmpegExecutablePath
    )
  }, [applicationLanguage, tmdbHost, tmdbApiKey, tmdbProxy, enableMcpServer, mcpHost, mcpPort, ytdlpExecutablePath, ffmpegExecutablePath, initialValues])

  // Handle save
  const handleSave = async () => {
    const traceId = `GeneralSettings-${nextTraceId()}`;
    console.log(`[${traceId}] GeneralSettings: Saving general settings`)

    // Change i18n language if language changed
    if (applicationLanguage !== userConfig.applicationLanguage) {
      console.log(`[${traceId}] GeneralSettings: Changing language to ${applicationLanguage}`)
      await changeLanguage(applicationLanguage)
    }

    const parsedMcpPort = Number(mcpPort)
    const updatedConfig = {
      ...userConfig,
      applicationLanguage: applicationLanguage,
      tmdb: {
        ...userConfig.tmdb,
        host: tmdbHost || undefined,
        apiKey: tmdbApiKey || undefined,
        httpProxy: tmdbProxy || undefined,
      },
      enableMcpServer,
      mcpHost: mcpHost || undefined,
      mcpPort: Number.isNaN(parsedMcpPort) || parsedMcpPort <= 0 ? 30001 : parsedMcpPort,
      ytdlpExecutablePath: ytdlpExecutablePath || undefined,
      ffmpegExecutablePath: ffmpegExecutablePath || undefined,
    }
    setAndSaveUserConfig(traceId, updatedConfig)
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
            onValueChange={(value) => setApplicationLanguage(value as SupportedLanguage)}
          >
            <SelectTrigger id="language" data-testid="setting-language-trigger">
              <SelectValue placeholder={t('general.languageDescription')} />
            </SelectTrigger>
            <SelectContent data-testid="setting-language-content">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code} data-testid={`setting-language-option-${lang.code}`}>
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
            data-testid="setting-tmdb-host"
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
            data-testid="setting-tmdb-api-key"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tmdb-proxy">{t('general.httpProxy')}</Label>
          <Input
            id="tmdb-proxy"
            value={tmdbProxy}
            onChange={(e) => setTmdbProxy(e.target.value)}
            placeholder={t('general.httpProxyPlaceholder')}
            data-testid="setting-tmdb-proxy"
          />
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

        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-semibold text-lg">{t('general.externalTools')}</h3>
          <p className="text-sm text-muted-foreground">{t('general.externalToolsDescription')}</p>
          <div className="space-y-2">
            <Label htmlFor="ytdlp-executable-path">{t('general.ytdlpExecutablePath')}</Label>
            <div className="flex gap-2">
              <Input
                id="ytdlp-executable-path"
                value={ytdlpExecutablePath}
                onChange={(e) => setYtdlpExecutablePath(e.target.value)}
                placeholder={t('general.ytdlpExecutablePathPlaceholder')}
                data-testid="setting-ytdlp-executable-path"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => {
                  openFilePicker((file: FileItem) => {
                    setYtdlpExecutablePath(file.path)
                  }, {
                    title: t('general.selectYtdlpExecutable'),
                    description: t('general.selectYtdlpExecutableDescription'),
                    selectFolder: false,
                  })
                }}
                data-testid="setting-ytdlp-browse"
              >
                {t('general.browse')}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ffmpeg-executable-path">{t('general.ffmpegExecutablePath')}</Label>
            <div className="flex gap-2">
              <Input
                id="ffmpeg-executable-path"
                value={ffmpegExecutablePath}
                onChange={(e) => setFfmpegExecutablePath(e.target.value)}
                placeholder={t('general.ffmpegExecutablePathPlaceholder')}
                data-testid="setting-ffmpeg-executable-path"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => {
                  openFilePicker((file: FileItem) => {
                    setFfmpegExecutablePath(file.path)
                  }, {
                    title: t('general.selectFfmpegExecutable'),
                    description: t('general.selectFfmpegExecutableDescription'),
                    selectFolder: false,
                  })
                }}
                data-testid="setting-ffmpeg-browse"
              >
                {t('general.browse')}
              </Button>
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


import { useState, useEffect, useMemo } from "react"
import { useConfig } from "@/hooks/userConfig"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SUPPORTED_APP_LANGUAGES, changeLanguage, type SupportedLanguage } from "@/lib/i18n"
import { useTranslation } from "@/lib/i18n"
import { nextTraceId } from "@/lib/utils"
import { useDialogs } from "@/providers/dialog-provider"
import type { FileItem } from "@/components/dialogs/types"
import { discoverYtdlp, getYtdlpVersion } from "@/api/ytdlp"
import { discoverFfmpeg, getFfmpegVersion } from "@/api/ffmpeg"
import { discoverVideoCaptioner } from "@/api/videocaptioner"
import { useTheme } from "@/providers/theme-provider"
import type { PreferMediaLanguage, PrimaryDatabase } from "@core/types"

const THEME_OPTIONS = ["light", "dark", "system"] as const
const PRIMARY_DATABASE_OPTIONS: {
  value: PrimaryDatabase
  labelKey: 'general.primaryDatabaseTmdb' | 'general.primaryDatabaseTvdb'
}[] = [
  { value: 'TMDB', labelKey: 'general.primaryDatabaseTmdb' },
  { value: 'TVDB', labelKey: 'general.primaryDatabaseTvdb' },
]

const PREFER_MEDIA_LANGUAGE_UNSET = "__unset__"
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
  const { t } = useTranslation(['settings', 'common'])
  const { filePickerDialog } = useDialogs()
  const [openFilePicker] = filePickerDialog

  // Track initial values
  const initialValues = useMemo(() => ({
    applicationLanguage: userConfig.applicationLanguage || 'zh-CN',
    tmdbHost: userConfig.tmdb?.host || '',
    tmdbApiKey: userConfig.tmdb?.apiKey || '',
    tmdbProxy: userConfig.tmdb?.httpProxy || '',
    tvdbHost: userConfig.tvdb?.host || '',
    tvdbApiKey: userConfig.tvdb?.apiKey || '',
    primaryDatabase: (userConfig.primaryDatabase || 'TMDB') as PrimaryDatabase,
    preferMediaLanguage: userConfig.preferMediaLanguage || PREFER_MEDIA_LANGUAGE_UNSET,
    enableMcpServer: userConfig.enableMcpServer ?? false,
    mcpHost: userConfig.mcpHost ?? '127.0.0.1',
    mcpPort: userConfig.mcpPort ?? 30001,
    ytdlpExecutablePath: userConfig.ytdlpExecutablePath || '',
    ffmpegExecutablePath: userConfig.ffmpegExecutablePath || '',
    useBundledFfmpegForVideoCaptioner: userConfig.useBundledFfmpegForVideoCaptioner ?? true,
  }), [userConfig])

  // Track current form values
  const [applicationLanguage, setApplicationLanguage] = useState<SupportedLanguage>(initialValues.applicationLanguage as SupportedLanguage)
  const [tmdbHost, setTmdbHost] = useState(initialValues.tmdbHost)
  const [tmdbApiKey, setTmdbApiKey] = useState(initialValues.tmdbApiKey)
  const [tmdbProxy, setTmdbProxy] = useState(initialValues.tmdbProxy)
  const [tvdbHost, setTvdbHost] = useState(initialValues.tvdbHost)
  const [tvdbApiKey, setTvdbApiKey] = useState(initialValues.tvdbApiKey)
  const [primaryDatabase, setPrimaryDatabase] = useState<PrimaryDatabase>(initialValues.primaryDatabase)
  const [preferMediaLanguage, setPreferMediaLanguage] = useState<PreferMediaLanguage | typeof PREFER_MEDIA_LANGUAGE_UNSET>(initialValues.preferMediaLanguage as PreferMediaLanguage | typeof PREFER_MEDIA_LANGUAGE_UNSET)
  const [enableMcpServer, setEnableMcpServer] = useState(initialValues.enableMcpServer)
  const [mcpHost, setMcpHost] = useState(initialValues.mcpHost)
  const [mcpPort, setMcpPort] = useState(String(initialValues.mcpPort))
  const [ytdlpExecutablePath, setYtdlpExecutablePath] = useState(initialValues.ytdlpExecutablePath)
  const [ffmpegExecutablePath, setFfmpegExecutablePath] = useState(initialValues.ffmpegExecutablePath)
  const [useBundledFfmpegForVideoCaptioner, setUseBundledFfmpegForVideoCaptioner] = useState(
    initialValues.useBundledFfmpegForVideoCaptioner,
  )
  const [ytdlpVersion, setYtdlpVersion] = useState<string | null>(null)
  const [ffmpegVersion, setFfmpegVersion] = useState<string | null>(null)
  const [videoCaptionerPath, setVideoCaptionerPath] = useState<string | null>(null)

  // Reset form when userConfig changes
  useEffect(() => {
    setApplicationLanguage(initialValues.applicationLanguage)
    setTmdbHost(initialValues.tmdbHost)
    setTmdbApiKey(initialValues.tmdbApiKey)
    setTmdbProxy(initialValues.tmdbProxy)
    setTvdbHost(initialValues.tvdbHost)
    setTvdbApiKey(initialValues.tvdbApiKey)
    setPrimaryDatabase(initialValues.primaryDatabase)
    setPreferMediaLanguage(initialValues.preferMediaLanguage as PreferMediaLanguage | typeof PREFER_MEDIA_LANGUAGE_UNSET)
    setEnableMcpServer(initialValues.enableMcpServer)
    setMcpHost(initialValues.mcpHost)
    setMcpPort(String(initialValues.mcpPort))
    setYtdlpExecutablePath(initialValues.ytdlpExecutablePath)
    setFfmpegExecutablePath(initialValues.ffmpegExecutablePath)
    setUseBundledFfmpegForVideoCaptioner(initialValues.useBundledFfmpegForVideoCaptioner)
  }, [initialValues])

  // Discover ytdlp and ffmpeg paths when component mounts
  useEffect(() => {
    const discoverPaths = async () => {
      try {
        // Discover ytdlp path
        const ytdlpResult = await discoverYtdlp()
        if (ytdlpResult.path) {
          setYtdlpExecutablePath(ytdlpResult.path)
          // Get ytdlp version
          const ytdlpVersionResult = await getYtdlpVersion()
          if (ytdlpVersionResult.version) {
            setYtdlpVersion(ytdlpVersionResult.version)
          }
        }

        // Discover ffmpeg path
        const ffmpegResult = await discoverFfmpeg()
        if (ffmpegResult.path) {
          setFfmpegExecutablePath(ffmpegResult.path)
          // Get ffmpeg version
          const ffmpegVersionResult = await getFfmpegVersion()
          if (ffmpegVersionResult.version) {
            setFfmpegVersion(ffmpegVersionResult.version)
          }
        }

        // Discover videocaptioner path for read-only display
        const videoCaptionerResult = await discoverVideoCaptioner()
        setVideoCaptionerPath(videoCaptionerResult.path ?? null)
      } catch (error) {
        console.error('Error discovering tool paths:', error)
      }
    }

    discoverPaths()
  }, [])

  // Detect changes
  const hasChanges = useMemo(() => {
    return (
      applicationLanguage !== initialValues.applicationLanguage ||
      tmdbHost !== initialValues.tmdbHost ||
      tmdbApiKey !== initialValues.tmdbApiKey ||
      tmdbProxy !== initialValues.tmdbProxy ||
      tvdbHost !== initialValues.tvdbHost ||
      tvdbApiKey !== initialValues.tvdbApiKey ||
      primaryDatabase !== initialValues.primaryDatabase ||
      preferMediaLanguage !== initialValues.preferMediaLanguage ||
      enableMcpServer !== initialValues.enableMcpServer ||
      mcpHost !== initialValues.mcpHost ||
      mcpPort !== String(initialValues.mcpPort) ||
      ytdlpExecutablePath !== initialValues.ytdlpExecutablePath ||
      ffmpegExecutablePath !== initialValues.ffmpegExecutablePath ||
      useBundledFfmpegForVideoCaptioner !== initialValues.useBundledFfmpegForVideoCaptioner
    )
  }, [
    applicationLanguage,
    tmdbHost,
    tmdbApiKey,
    tmdbProxy,
    tvdbHost,
    tvdbApiKey,
    primaryDatabase,
    preferMediaLanguage,
    enableMcpServer,
    mcpHost,
    mcpPort,
    ytdlpExecutablePath,
    ffmpegExecutablePath,
    useBundledFfmpegForVideoCaptioner,
    initialValues,
  ])

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
      tvdb: {
        ...userConfig.tvdb,
        host: tvdbHost || undefined,
        apiKey: tvdbApiKey || undefined,
      },
      primaryDatabase,
      preferMediaLanguage: preferMediaLanguage === PREFER_MEDIA_LANGUAGE_UNSET ? undefined : preferMediaLanguage,
      enableMcpServer,
      mcpHost: mcpHost || undefined,
      mcpPort: Number.isNaN(parsedMcpPort) || parsedMcpPort <= 0 ? 30001 : parsedMcpPort,
      ytdlpExecutablePath: ytdlpExecutablePath || undefined,
      ffmpegExecutablePath: ffmpegExecutablePath || undefined,
      useBundledFfmpegForVideoCaptioner,
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
              {SUPPORTED_APP_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code} data-testid={`setting-language-option-${lang.code}`}>
                  {lang.name}
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

        <div className="space-y-2">
          <Label htmlFor="primary-database">{t('general.primaryDatabase')}</Label>
          <Select
            value={primaryDatabase}
            onValueChange={(v) => setPrimaryDatabase(v as PrimaryDatabase)}
          >
            <SelectTrigger id="primary-database" data-testid="setting-primary-database-trigger">
              <SelectValue placeholder={t('general.primaryDatabaseDescription')} />
            </SelectTrigger>
            <SelectContent data-testid="setting-primary-database-content">
              {PRIMARY_DATABASE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} data-testid={`setting-primary-database-option-${opt.value}`}>
                  {t(opt.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{t('general.primaryDatabaseDescription')}</p>
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

        <div className="space-y-2">
          <Label htmlFor="tvdb-host">{t('general.tvdbHost')}</Label>
          <Input
            id="tvdb-host"
            value={tvdbHost}
            onChange={(e) => setTvdbHost(e.target.value)}
            placeholder={t('general.tvdbHostPlaceholder')}
            data-testid="setting-tvdb-host"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tvdb-api-key">{t('general.tvdbApiKey')}</Label>
          <Input
            id="tvdb-api-key"
            type="password"
            value={tvdbApiKey}
            onChange={(e) => setTvdbApiKey(e.target.value)}
            placeholder={t('general.tvdbApiKeyPlaceholder')}
            data-testid="setting-tvdb-api-key"
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
            {ytdlpVersion && (
              <p className="text-sm text-muted-foreground" data-testid="setting-ytdlp-version">
                Version: {ytdlpVersion}
              </p>
            )}
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
            {ffmpegVersion && (
              <p className="text-sm text-muted-foreground" data-testid="setting-ffmpeg-version">
                Version: {ffmpegVersion}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('general.videoCaptionerExecutablePath')}</Label>
            <p
              className="text-sm text-muted-foreground break-all rounded-md border p-2"
              data-testid="setting-videocaptioner-path"
            >
              {videoCaptionerPath ?? t('general.videoCaptionerExecutablePathUnavailable')}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="use-bundled-ffmpeg-videocaptioner"
                type="checkbox"
                checked={useBundledFfmpegForVideoCaptioner}
                onChange={(e) => setUseBundledFfmpegForVideoCaptioner(e.target.checked)}
                className="h-4 w-4 rounded border-input"
                data-testid="setting-use-bundled-ffmpeg-videocaptioner"
              />
              <Label htmlFor="use-bundled-ffmpeg-videocaptioner">
                {t('general.useBundledFfmpegForVideoCaptioner')}
              </Label>
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


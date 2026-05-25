import { useState, useEffect, useMemo } from "react"
import { useConfig } from "@/hooks/userConfig"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { nextTraceId } from "@/lib/utils"
import { useDialogs } from "@/providers/dialog-provider"
import type { FileItem } from "@/components/dialogs/types"
import { getYtdlpVersion } from "@/api/ytdlp"
import { getFfmpegVersion } from "@/api/ffmpeg"
import { getQuickjsVersion } from "@/api/quickjs"
import { discoverVideoCaptioner } from "@/api/videocaptioner"
import {
  fetchDiscoverExecutables,
  type ExecutablePathInfo,
} from "@/api/discoverExecutables"

export function ExternalApplicationsSettings() {
  const { userConfig, setAndSaveUserConfig } = useConfig()
  const { t } = useTranslation(['settings', 'common'])
  const { filePickerDialog } = useDialogs()
  const [openFilePicker] = filePickerDialog

  const initialValues = useMemo(() => ({
    ytdlpExecutablePath: userConfig.ytdlpExecutablePath || '',
    ffmpegExecutablePath: userConfig.ffmpegExecutablePath || '',
    useBundledFfmpegForVideoCaptioner: userConfig.useBundledFfmpegForVideoCaptioner ?? true,
    quickjsExecutablePath: userConfig.quickjsExecutablePath || '',
  }), [userConfig])

  const [ytdlpExecutablePath, setYtdlpExecutablePath] = useState(initialValues.ytdlpExecutablePath)
  const [ytdlpDiscoveredPlaceholder, setYtdlpDiscoveredPlaceholder] = useState("")
  const [ytdlpUsesAppDiscovery, setYtdlpUsesAppDiscovery] = useState(!initialValues.ytdlpExecutablePath)
  const [ffmpegExecutablePath, setFfmpegExecutablePath] = useState(initialValues.ffmpegExecutablePath)
  const [ffmpegDiscoveredPlaceholder, setFfmpegDiscoveredPlaceholder] = useState("")
  const [ffmpegUsesAppDiscovery, setFfmpegUsesAppDiscovery] = useState(!initialValues.ffmpegExecutablePath)
  const [useBundledFfmpegForVideoCaptioner, setUseBundledFfmpegForVideoCaptioner] = useState(
    initialValues.useBundledFfmpegForVideoCaptioner,
  )
  const [quickjsExecutablePath, setQuickjsExecutablePath] = useState(initialValues.quickjsExecutablePath)
  const [quickjsDiscoveredPlaceholder, setQuickjsDiscoveredPlaceholder] = useState("")
  const [quickjsUsesAppDiscovery, setQuickjsUsesAppDiscovery] = useState(!initialValues.quickjsExecutablePath)
  const [ytdlpVersion, setYtdlpVersion] = useState<string | null>(null)
  const [ffmpegVersion, setFfmpegVersion] = useState<string | null>(null)
  const [quickjsVersion, setQuickjsVersion] = useState<string | null>(null)
  const [videoCaptionerPath, setVideoCaptionerPath] = useState<string | null>(null)

  useEffect(() => {
    setYtdlpExecutablePath(initialValues.ytdlpExecutablePath)
    setYtdlpUsesAppDiscovery(!initialValues.ytdlpExecutablePath)
    setFfmpegExecutablePath(initialValues.ffmpegExecutablePath)
    setFfmpegUsesAppDiscovery(!initialValues.ffmpegExecutablePath)
    setUseBundledFfmpegForVideoCaptioner(initialValues.useBundledFfmpegForVideoCaptioner)
    setQuickjsExecutablePath(initialValues.quickjsExecutablePath)
    setQuickjsUsesAppDiscovery(!initialValues.quickjsExecutablePath)
  }, [initialValues])

  useEffect(() => {
    const applyExecutablePathFields = (
      info: ExecutablePathInfo,
      setValue: (path: string) => void,
      setPlaceholder: (path: string) => void,
      setUsesAppDiscovery: (uses: boolean) => void,
      defaultPlaceholder: string,
    ) => {
      const discovered = info.discoveredPath ?? ""
      if (info.configuredPath) {
        setValue(info.configuredPath)
        setPlaceholder(discovered || defaultPlaceholder)
        setUsesAppDiscovery(false)
      } else {
        setValue("")
        setPlaceholder(discovered || defaultPlaceholder)
        setUsesAppDiscovery(Boolean(discovered))
      }
    }

    const discoverPaths = async () => {
      try {
        const paths = await fetchDiscoverExecutables()

        applyExecutablePathFields(
          paths.ytdlp,
          setYtdlpExecutablePath,
          setYtdlpDiscoveredPlaceholder,
          setYtdlpUsesAppDiscovery,
          t("externalApps.ytdlpExecutablePathPlaceholder"),
        )
        applyExecutablePathFields(
          paths.ffmpeg,
          setFfmpegExecutablePath,
          setFfmpegDiscoveredPlaceholder,
          setFfmpegUsesAppDiscovery,
          t("externalApps.ffmpegExecutablePathPlaceholder"),
        )
        applyExecutablePathFields(
          paths.quickjs,
          setQuickjsExecutablePath,
          setQuickjsDiscoveredPlaceholder,
          setQuickjsUsesAppDiscovery,
          t("externalApps.quickjsExecutablePathPlaceholder"),
        )

        const ytdlpVersionResult = await getYtdlpVersion()
        if (ytdlpVersionResult.version) {
          setYtdlpVersion(ytdlpVersionResult.version)
        }

        const ffmpegVersionResult = await getFfmpegVersion()
        if (ffmpegVersionResult.version) {
          setFfmpegVersion(ffmpegVersionResult.version)
        }

        const videoCaptionerResult = await discoverVideoCaptioner()
        setVideoCaptionerPath(
          videoCaptionerResult.path ?? paths.videocaptioner.discoveredPath ?? null,
        )

        // Get QuickJS version via discovered path
        const quickjsVersionResult = await getQuickjsVersion()
        if (quickjsVersionResult.version) {
          setQuickjsVersion(quickjsVersionResult.version)
        }
      } catch (error) {
        console.error("Error discovering tool paths:", error)
      }
    }

    discoverPaths()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  const hasChanges = useMemo(() => {
    return (
      ytdlpExecutablePath !== initialValues.ytdlpExecutablePath ||
      ffmpegExecutablePath !== initialValues.ffmpegExecutablePath ||
      useBundledFfmpegForVideoCaptioner !== initialValues.useBundledFfmpegForVideoCaptioner ||
      quickjsExecutablePath !== initialValues.quickjsExecutablePath
    )
  }, [
    ytdlpExecutablePath,
    ffmpegExecutablePath,
    useBundledFfmpegForVideoCaptioner,
    quickjsExecutablePath,
    initialValues,
  ])

  const handleSave = async () => {
    const traceId = `ExternalApps-${nextTraceId()}`
    console.log(`[${traceId}] ExternalApplicationsSettings: Saving`)

    const updatedConfig = {
      ...userConfig,
      ytdlpExecutablePath: ytdlpExecutablePath || undefined,
      ffmpegExecutablePath: ffmpegExecutablePath || undefined,
      useBundledFfmpegForVideoCaptioner,
      quickjsExecutablePath: quickjsExecutablePath || undefined,
    }
    setAndSaveUserConfig(traceId, updatedConfig)
  }

  return (
    <div className="space-y-6 p-6 relative" data-testid="external-apps-settings">
      <div>
        <h2 className="text-2xl font-semibold mb-4">{t('title')}</h2>
        <p className="text-muted-foreground mb-6">
          {t('externalApps.title')}
        </p>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('externalApps.description')}</p>

        {/* yt-dlp */}
        <div className="space-y-2">
          <Label htmlFor="ytdlp-executable-path">{t('externalApps.ytdlpExecutablePath')}</Label>
          <div className="flex gap-2">
            <Input
              id="ytdlp-executable-path"
              value={ytdlpExecutablePath}
              onChange={(e) => {
                setYtdlpExecutablePath(e.target.value)
                setYtdlpUsesAppDiscovery(false)
              }}
              placeholder={
                ytdlpDiscoveredPlaceholder || t("externalApps.ytdlpExecutablePathPlaceholder")
              }
              data-testid="setting-ytdlp-executable-path"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={() => {
                openFilePicker((file: FileItem) => {
                  setYtdlpExecutablePath(file.path)
                }, {
                  title: t('externalApps.selectYtdlpExecutable'),
                  description: t('externalApps.selectYtdlpExecutableDescription'),
                  selectFolder: false,
                })
              }}
              data-testid="setting-ytdlp-browse"
            >
              {t('externalApps.browse')}
            </Button>
          </div>
          {ytdlpUsesAppDiscovery && ytdlpDiscoveredPlaceholder ? (
            <p className="text-sm text-muted-foreground" data-testid="setting-ytdlp-path-hint">
              {t("externalApps.executablePathHintAppDiscovery")}
            </p>
          ) : ytdlpExecutablePath ? (
            <p className="text-sm text-muted-foreground" data-testid="setting-ytdlp-path-hint">
              {t("externalApps.executablePathHintUserConfig")}
            </p>
          ) : null}
          {ytdlpVersion && (
            <p className="text-sm text-muted-foreground" data-testid="setting-ytdlp-version">
              Version: {ytdlpVersion}
            </p>
          )}
        </div>

        {/* ffmpeg */}
        <div className="space-y-2">
          <Label htmlFor="ffmpeg-executable-path">{t('externalApps.ffmpegExecutablePath')}</Label>
          <div className="flex gap-2">
            <Input
              id="ffmpeg-executable-path"
              value={ffmpegExecutablePath}
              onChange={(e) => {
                setFfmpegExecutablePath(e.target.value)
                setFfmpegUsesAppDiscovery(false)
              }}
              placeholder={
                ffmpegDiscoveredPlaceholder || t("externalApps.ffmpegExecutablePathPlaceholder")
              }
              data-testid="setting-ffmpeg-executable-path"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={() => {
                openFilePicker((file: FileItem) => {
                  setFfmpegExecutablePath(file.path)
                }, {
                  title: t('externalApps.selectFfmpegExecutable'),
                  description: t('externalApps.selectFfmpegExecutableDescription'),
                  selectFolder: false,
                })
              }}
              data-testid="setting-ffmpeg-browse"
            >
              {t('externalApps.browse')}
            </Button>
          </div>
          {ffmpegUsesAppDiscovery && ffmpegDiscoveredPlaceholder ? (
            <p className="text-sm text-muted-foreground" data-testid="setting-ffmpeg-path-hint">
              {t("externalApps.executablePathHintAppDiscovery")}
            </p>
          ) : ffmpegExecutablePath ? (
            <p className="text-sm text-muted-foreground" data-testid="setting-ffmpeg-path-hint">
              {t("externalApps.executablePathHintUserConfig")}
            </p>
          ) : null}
          {ffmpegVersion && (
            <p className="text-sm text-muted-foreground" data-testid="setting-ffmpeg-version">
              Version: {ffmpegVersion}
            </p>
          )}
        </div>

        {/* VideoCaptioner */}
        <div className="space-y-2">
          <Label>{t('externalApps.videoCaptionerExecutablePath')}</Label>
          <p
            className="text-sm text-muted-foreground break-all rounded-md border p-2"
            data-testid="setting-videocaptioner-path"
          >
            {videoCaptionerPath ?? t('externalApps.videoCaptionerExecutablePathUnavailable')}
          </p>
        </div>

        {/* Bundled ffmpeg */}
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
              {t('externalApps.useBundledFfmpegForVideoCaptioner')}
            </Label>
          </div>
        </div>

        {/* QuickJS */}
        <div className="space-y-2">
          <Label htmlFor="quickjs-executable-path">{t('externalApps.quickjsExecutablePath')}</Label>
          <div className="flex gap-2">
            <Input
              id="quickjs-executable-path"
              value={quickjsExecutablePath}
              onChange={(e) => {
                setQuickjsExecutablePath(e.target.value)
                setQuickjsUsesAppDiscovery(false)
              }}
              placeholder={
                quickjsDiscoveredPlaceholder || t("externalApps.quickjsExecutablePathPlaceholder")
              }
              data-testid="setting-quickjs-executable-path"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={() => {
                openFilePicker((file: FileItem) => {
                  setQuickjsExecutablePath(file.path)
                }, {
                  title: t('externalApps.selectQuickjsExecutable'),
                  description: t('externalApps.selectQuickjsExecutableDescription'),
                  selectFolder: false,
                })
              }}
              data-testid="setting-quickjs-browse"
            >
              {t('externalApps.browse')}
            </Button>
          </div>
          {quickjsUsesAppDiscovery && quickjsDiscoveredPlaceholder ? (
            <p className="text-sm text-muted-foreground" data-testid="setting-quickjs-path-hint">
              {t("externalApps.executablePathHintAppDiscovery")}
            </p>
          ) : quickjsExecutablePath ? (
            <p className="text-sm text-muted-foreground" data-testid="setting-quickjs-path-hint">
              {t("externalApps.executablePathHintUserConfig")}
            </p>
          ) : null}
          {quickjsVersion && (
            <p className="text-sm text-muted-foreground" data-testid="setting-quickjs-version">
              Version: {quickjsVersion}
            </p>
          )}
        </div>
      </div>

      {hasChanges && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button onClick={handleSave} data-testid="settings-save-button">
            Save
          </Button>
        </div>
      )}
    </div>
  )
}

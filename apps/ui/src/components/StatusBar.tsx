import { useMemo, useState } from "react"
import { Path } from "@core/path"
import { isVersionGreater } from "@core/versionCompare"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useStatusBar, mapWebSocketStatusToConnectionStatus } from "./hooks/useStatusBar"
import { MessageIndicator, type Message } from "./ConnectionStatusIndicator"
import { BackgroundJobsPopover } from "./background-jobs/BackgroundJobsPopover"
import { McpIndicator } from "./mcp/McpIndicator"
import { Separator } from "@/components/ui/separator"
import { useDatabaseConnectionStatus } from "@/hooks/useDatabaseConnectionStatus"
import type { DatabaseConnectionStatus } from "@/lib/databaseConnectionCheck"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { useFeatures } from "@/hooks/useFeatures"
import { useConvexSettings } from "@/hooks/useConvexSettings"
import { NewVersionDialog } from "./dialogs/NewVersionDialog"

export { mapWebSocketStatusToConnectionStatus }

const VIDEO_CAPTIONER_CLI_HELP_LINK =
    "https://github.com/WEIFENG2333/VideoCaptioner#cli-%E5%91%BD%E4%BB%A4%E8%A1%8C"

function databaseStatusMessage(
    status: DatabaseConnectionStatus,
    labels: { available: string; unavailable: string; checkFailed: string },
): Message | null {
    if (status === "checking") return null
    if (status === "connected") return { title: labels.available, type: "info" }
    if (status === "checkFailed") return { title: labels.checkFailed, type: "warning" }
    return { title: labels.unavailable, type: "error" }
}

interface StatusBarProps {
    className?: string
    /** When set (including `""`), overrides the path from `UIMediaFolderStore` `selectedFolder`. */
    message?: string
    /** Override app version (e.g. for tests); when set, useConfig is not used for version. */
    version?: string
}

export function StatusBar({
    className,
    message,
    version: versionOverride,
}: StatusBarProps) {
    const { t } = useTranslation("components")
    const { selectedFolder } = useUIMediaFolderStoreState()
    const { tmdbStatus, tvdbStatus } = useDatabaseConnectionStatus()
    const { isTranscribeEnabled } = useFeatures()
    const { isAvailable: isVideoCaptionerAvailable } = useVideoCaptionerStatus()
    const { data: convexSettings } = useConvexSettings()
    const [newVersionDialogOpen, setNewVersionDialogOpen] = useState(false)
    const folderPathMessage = useMemo(
        () => (selectedFolder ? Path.toPlatformPath(selectedFolder) : ""),
        [selectedFolder],
    )
    const displayMessage = message !== undefined ? message : folderPathMessage

    const { version } = useStatusBar({ versionOverride })
    const latestVersion = convexSettings?.latestVersion
    const hasUpdate = Boolean(
        latestVersion && isVersionGreater(latestVersion, version),
    )

    const statusMessages = useMemo<Message[]>(() => {
        const messages: Message[] = []
        const tmdbMessage = databaseStatusMessage(tmdbStatus, {
            available: t("statusBar.messages.tmdbAvailable"),
            unavailable: t("statusBar.messages.tmdbUnavailable"),
            checkFailed: t("statusBar.messages.tmdbCheckFailed"),
        })
        if (tmdbMessage) messages.push(tmdbMessage)
        const tvdbMessage = databaseStatusMessage(tvdbStatus, {
            available: t("statusBar.messages.tvdbAvailable"),
            unavailable: t("statusBar.messages.tvdbUnavailable"),
            checkFailed: t("statusBar.messages.tvdbCheckFailed"),
        })
        if (tvdbMessage) messages.push(tvdbMessage)
        return [
            ...messages,
            isTranscribeEnabled
                ? {
                      title: isVideoCaptionerAvailable
                          ? t("statusBar.messages.videoCaptionerAvailable")
                          : t("statusBar.messages.videoCaptionerNotFound"),
                      type: isVideoCaptionerAvailable ? "info" : "error",
                      link: isVideoCaptionerAvailable
                          ? undefined
                          : VIDEO_CAPTIONER_CLI_HELP_LINK,
                  }
                : {
                      title: t("statusBar.messages.transcribeUnavailableOnOs"),
                      type: "warning",
                  },
        ]
    }, [tmdbStatus, tvdbStatus, isVideoCaptionerAvailable, isTranscribeEnabled, t])

    const handleVersionClick = () => {
        if (hasUpdate && latestVersion) {
            setNewVersionDialogOpen(true)
        }
    }

    return (
        <div
            data-testid="status-bar"
            className={cn(
                "h-8 w-full shrink-0 flex gap-2 items-center",
                "bg-muted/50 border-t border-border",
                "px-4 text-xs",
                "text-muted-foreground",
                className
            )}
        >
            <div className="flex items-center gap-2">
                <div data-testid="connection-status-indicator">
                    <MessageIndicator messages={statusMessages} />
                </div>
            </div>
            <div className="flex-1" data-testid="status-bar-message">{displayMessage}</div>
            <div className="flex items-center gap-2">
                <McpIndicator />
                <div data-testid="background-jobs-indicator">
                    <BackgroundJobsPopover />
                </div>
                <Separator orientation="vertical" className="h-4" />
                <button
                    type="button"
                    data-testid="app-version-button"
                    onClick={handleVersionClick}
                    disabled={!hasUpdate}
                    aria-label={
                        hasUpdate
                            ? t("statusBar.versionUpdate.ariaLabel")
                            : undefined
                    }
                    className={cn(
                        "relative font-medium rounded p-0.5 -m-0.5",
                        hasUpdate && "cursor-pointer hover:bg-muted",
                        !hasUpdate && "cursor-default",
                    )}
                >
                    <span data-testid="app-version">{version}</span>
                    {hasUpdate ? (
                        <span
                            data-testid="app-version-update-dot"
                            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500"
                        />
                    ) : null}
                </button>
            </div>
            {hasUpdate && latestVersion ? (
                <NewVersionDialog
                    open={newVersionDialogOpen}
                    onOpenChange={setNewVersionDialogOpen}
                    currentVersion={version}
                    latestVersion={latestVersion}
                />
            ) : null}
        </div>
    )
}

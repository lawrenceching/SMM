import { useMemo } from "react"
import { Path } from "@core/path"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useStatusBar, mapWebSocketStatusToConnectionStatus } from "./hooks/useStatusBar"
import { MessageIndicator, type Message } from "./ConnectionStatusIndicator"
import { BackgroundJobsIndicator } from "./background-jobs/BackgroundJobsIndicator"
import { McpIndicator } from "./mcp/McpIndicator"
import { Separator } from "@/components/ui/separator"
import { useDatabaseConnectionStatus } from "@/hooks/useDatabaseConnectionStatus"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"

export { mapWebSocketStatusToConnectionStatus }

const VIDEO_CAPTIONER_CLI_HELP_LINK =
    "https://github.com/WEIFENG2333/VideoCaptioner#cli-%E5%91%BD%E4%BB%A4%E8%A1%8C"

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
    const { isAvailable: isVideoCaptionerAvailable } = useVideoCaptionerStatus()
    const folderPathMessage = useMemo(
        () => (selectedFolder ? Path.toPlatformPath(selectedFolder) : ""),
        [selectedFolder],
    )
    const displayMessage = message !== undefined ? message : folderPathMessage

    const { version } = useStatusBar({ versionOverride })
    const statusMessages = useMemo<Message[]>(
        () => [
            {
                title:
                    tmdbStatus === "disconnected"
                        ? t("statusBar.messages.tmdbUnavailable")
                        : t("statusBar.messages.tmdbAvailable"),
                type: tmdbStatus === "disconnected" ? "error" : "info",
            },
            {
                title:
                    tvdbStatus === "disconnected"
                        ? t("statusBar.messages.tvdbUnavailable")
                        : t("statusBar.messages.tvdbAvailable"),
                type: tvdbStatus === "disconnected" ? "error" : "info",
            },
            {
                title: isVideoCaptionerAvailable
                    ? t("statusBar.messages.videoCaptionerAvailable")
                    : t("statusBar.messages.videoCaptionerNotFound"),
                type: isVideoCaptionerAvailable ? "info" : "error",
                link: isVideoCaptionerAvailable
                    ? undefined
                    : VIDEO_CAPTIONER_CLI_HELP_LINK,
            },
        ],
        [tmdbStatus, tvdbStatus, isVideoCaptionerAvailable, t],
    )

    return (
        <div
            data-testid="status-bar"
            className={cn(
                "h-8 w-full flex gap-2 items-center",
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
                    <BackgroundJobsIndicator />
                </div>
                <Separator orientation="vertical" className="h-4" />
                <span className="font-medium" data-testid="app-version">{version}</span>
            </div>
        </div>
    )
}

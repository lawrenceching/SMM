import { useMemo } from "react"
import { Path } from "@core/path"
import { cn } from "@/lib/utils"
import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useStatusBar, mapWebSocketStatusToConnectionStatus } from "./hooks/useStatusBar"
import { MessageIndicator, type Message } from "./ConnectionStatusIndicator"
import { BackgroundJobsIndicator } from "./background-jobs/BackgroundJobsIndicator"
import { McpIndicator } from "./mcp/McpIndicator"
import { Separator } from "@/components/ui/separator"
import { useDatabaseConnectionStatus } from "@/hooks/useDatabaseConnectionStatus"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"

export { mapWebSocketStatusToConnectionStatus }

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
                        ? "TMDB is unavailable"
                        : "TMDB is available",
                type: tmdbStatus === "disconnected" ? "error" : "info",
            },
            {
                title:
                    tvdbStatus === "disconnected"
                        ? "TVDB is unavailable"
                        : "TVDB is available",
                type: tvdbStatus === "disconnected" ? "error" : "info",
            },
            {
                title: isVideoCaptionerAvailable
                    ? "VideoCaptioner is available"
                    : "videocaptioner not found",
                type: isVideoCaptionerAvailable ? "info" : "error",
            },
        ],
        [tmdbStatus, tvdbStatus, isVideoCaptionerAvailable],
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

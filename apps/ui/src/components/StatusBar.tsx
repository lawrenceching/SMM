import { cn } from "@/lib/utils"
import { useStatusBar, mapWebSocketStatusToConnectionStatus } from "./hooks/useStatusBar"
import { ConnectionStatusIndicator, type ConnectionStatus } from "./ConnectionStatusIndicator"
import { BackgroundJobsIndicator } from "./background-jobs/BackgroundJobsIndicator"
import { McpIndicator } from "./mcp/McpIndicator"
import { Separator } from "@/components/ui/separator"

export { mapWebSocketStatusToConnectionStatus }

interface StatusBarProps {
    className?: string
    message?: string
    /** Override connection status (e.g. for tests); when set, useWebSocket is not used for status. */
    connectionStatus?: ConnectionStatus
    /** Override app version (e.g. for tests); when set, useConfig is not used for version. */
    version?: string
}

export function StatusBar({
    className,
    message,
    connectionStatus: connectionStatusOverride,
    version: versionOverride,
}: StatusBarProps) {
    const { connectionStatus, version } = useStatusBar({
        connectionStatusOverride,
        versionOverride,
    })

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
                    <ConnectionStatusIndicator status={connectionStatus} />
                </div>
            </div>
            <div className="flex-1" data-testid="status-bar-message">{message}</div>
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

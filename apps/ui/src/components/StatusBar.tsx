import { cn } from "@/lib/utils"
import { useConfig } from "@/providers/config-provider"
import { useWebSocket } from "@/hooks/useWebSocket"
import { ConnectionStatusIndicator, type ConnectionStatus } from "./ConnectionStatusIndicator"
import { BackgroundJobsIndicator } from "./background-jobs/BackgroundJobsIndicator"
import { McpIndicator } from "./mcp/McpIndicator"
import { Separator } from "@/components/ui/separator"

interface StatusBarProps {
    className?: string
    message?: string
}

export function StatusBar({className, message}: StatusBarProps) {
    const { appConfig } = useConfig()
    const { status } = useWebSocket()
    
    // Map WebSocketStatus to ConnectionStatus
    const connectionStatus: ConnectionStatus = 
        status === 'connected' ? 'connected' :
        status === 'connecting' ? 'connecting' :
        'disconnected' // 'disconnected' or 'error' both map to 'disconnected'

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
                <span className="font-medium" data-testid="app-version">{appConfig.version}</span>
            </div>
        </div>
    )
}

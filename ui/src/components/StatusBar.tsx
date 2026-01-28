import { cn } from "@/lib/utils"
import { useConfig } from "@/providers/config-provider"
import { useWebSocket } from "@/hooks/useWebSocket"
import { ConnectionStatusIndicator, type ConnectionStatus } from "./ConnectionStatusIndicator"
import { BackgroundJobsIndicator } from "./background-jobs/BackgroundJobsIndicator"

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
            className={cn(
                "h-8 w-full flex gap-2 items-center",
                "bg-muted/50 border-t border-border",
                "px-4 text-xs",
                "text-muted-foreground",
                className
            )}
        >
            <div className="flex items-center gap-2">
                <ConnectionStatusIndicator status={connectionStatus} />
            </div>
            <div className="flex-1">{message}</div>
            <div className="flex items-center gap-2">
                <BackgroundJobsIndicator />
                <span className="font-medium">{appConfig.version}</span>
            </div>
        </div>
    )
}

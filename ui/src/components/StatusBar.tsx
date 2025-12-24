import { cn } from "@/lib/utils"
import { useConfig } from "./config-provider"
import { useWebSocket } from "@/hooks/useWebSocket"
import { ConnectionStatusIndicator, type ConnectionStatus } from "./ConnectionStatusIndicator"

interface StatusBarProps {
    className?: string
}

export function StatusBar({className}: StatusBarProps) {
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
                "h-8 w-full flex items-center",
                "bg-muted/50 border-t border-border",
                "px-4 text-xs",
                "text-muted-foreground",
                className
            )}
        >
            <div className="flex items-center gap-2">
                <ConnectionStatusIndicator status={connectionStatus} />
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center gap-2">
                <span className="font-medium">{appConfig.version}</span>
            </div>
        </div>
    )
}
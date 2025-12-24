import { cn } from "@/lib/utils"
import { useConfig } from "./config-provider"
import { useWebSocket } from "@/hooks/useWebSocket"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface StatusBarProps {
    className?: string
}

export function StatusBar({className}: StatusBarProps) {
    const { appConfig } = useConfig()
    const { status } = useWebSocket()
    const isConnected = status === 'connected'
    const isDisconnected = status === 'disconnected' || status === 'error'
    
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
                {isConnected && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div 
                                className="w-2 h-2 rounded-full bg-green-500 cursor-default"
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Backend connected</p>
                        </TooltipContent>
                    </Tooltip>
                )}
                {isDisconnected && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div 
                                className="w-2 h-2 rounded-full bg-red-500 cursor-default"
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Backend disconnected</p>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center gap-2">
                <span className="font-medium">{appConfig.version}</span>
            </div>
        </div>
    )
}
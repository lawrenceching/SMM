import { cn } from "@/lib/utils"
import { useConfig } from "./config-provider"

interface StatusBarProps {
    className?: string
}

export function StatusBar({className}: StatusBarProps) {
    const { appConfig } = useConfig()
    
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
            <div className="flex-1"></div>
            <div className="flex items-center gap-2">
                <span className="font-medium">{appConfig.version}</span>
            </div>
        </div>
    )
}
import { cn } from "@/lib/utils"
import { useConfig } from "./config-provider"

interface StatusBarProps {
    className?: string
}

export function StatusBar({className}: StatusBarProps) {
    const { appConfig } = useConfig()
    
    return <div className={cn("h-[30px] w-full flex", className)}>
    <div className="flex-1"></div>
    <div className="max-w-[60px]">{appConfig.version}</div>
  </div>
}
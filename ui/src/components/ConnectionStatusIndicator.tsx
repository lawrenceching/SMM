import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export type ConnectionStatus = "connected" | "disconnected" | "connecting"

interface ConnectionStatusIndicatorProps {
    status: ConnectionStatus
}

export function ConnectionStatusIndicator({ status }: ConnectionStatusIndicatorProps) {
    const getIndicatorConfig = () => {
        switch (status) {
            case "connected":
                return {
                    className: "w-2 h-2 rounded-full bg-green-500",
                    tooltip: "Backend connected",
                }
            case "disconnected":
                return {
                    className: "w-2 h-2 rounded-full bg-red-500",
                    tooltip: "Backend disconnected",
                }
            case "connecting":
                return {
                    className: "w-2 h-2 rounded-full bg-red-500 animate-pulse",
                    tooltip: "Connecting to backend...",
                }
        }
    }

    const config = getIndicatorConfig()

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div 
                    className={`${config.className} cursor-default`}
                />
            </TooltipTrigger>
            <TooltipContent>
                <p>{config.tooltip}</p>
            </TooltipContent>
        </Tooltip>
    )
}


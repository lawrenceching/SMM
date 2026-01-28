import { cn } from "@/lib/utils"
import { nextTraceId } from "@/lib/utils"
import { useConfig } from "@/providers/config-provider"
import { useWebSocket } from "@/hooks/useWebSocket"
import { ConnectionStatusIndicator, type ConnectionStatus } from "./ConnectionStatusIndicator"
import { BackgroundJobsIndicator } from "./background-jobs/BackgroundJobsIndicator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Plug, Globe, FileText, ExternalLink } from "lucide-react"

const MCP_DOC_URL = "https://gitcode.com/lawrenceching/simple-media-manager/blob/main/MCP.md"

interface StatusBarProps {
    className?: string
    message?: string
}

export function StatusBar({className, message}: StatusBarProps) {
    const { appConfig, userConfig, setUserConfig } = useConfig()
    const { status } = useWebSocket()
    
    // Map WebSocketStatus to ConnectionStatus
    const connectionStatus: ConnectionStatus = 
        status === 'connected' ? 'connected' :
        status === 'connecting' ? 'connecting' :
        'disconnected' // 'disconnected' or 'error' both map to 'disconnected'

    const mcpEnabled = userConfig.enableMcpServer === true
    const mcpHost = userConfig.mcpHost ?? "127.0.0.1"
    const mcpPort = userConfig.mcpPort ?? 30001
    const mcpAddress = `http://${mcpHost}:${mcpPort}`

    const handleMcpToggle = () => {
        const traceId = `StatusBar-MCP-toggle-${nextTraceId()}`
        setUserConfig(traceId, { ...userConfig, enableMcpServer: !mcpEnabled })
    }

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
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                "flex items-center justify-center rounded p-0.5 transition-colors hover:bg-muted",
                                mcpEnabled ? "text-primary" : "text-muted-foreground/50"
                            )}
                            aria-label={mcpEnabled ? "MCP server on" : "MCP server off"}
                        >
                            <Plug className="h-4 w-4" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="end" side="top">
                        <div className="p-3 pb-2">
                            <div className="flex items-center gap-2">
                                <div className={cn(
                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                    mcpEnabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                    <Plug className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate">MCP Server</p>
                                    <p className="text-xs text-muted-foreground">Model Context Protocol</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={mcpEnabled}
                                    aria-label={mcpEnabled ? "Turn MCP server off" : "Turn MCP server on"}
                                    onClick={handleMcpToggle}
                                    className={cn(
                                        "relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                        mcpEnabled ? "bg-primary" : "bg-muted"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-sm ring-0 transition-transform",
                                            mcpEnabled ? "translate-x-6" : "translate-x-0.5"
                                        )}
                                    />
                                </button>
                            </div>
                        </div>
                        <Separator />
                        <div className="p-3 space-y-3">
                            {mcpEnabled ? (
                                <>
                                    <div className="rounded-lg bg-muted/60 p-2.5 space-y-2">
                                        <div className="flex items-center gap-2 text-xs">
                                            <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-muted-foreground font-medium">Address</span>
                                        </div>
                                        <a
                                            href={mcpAddress}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block font-mono text-xs text-primary break-all hover:underline"
                                        >
                                            {mcpAddress}
                                        </a>
                                        <div className="flex items-center gap-2 text-xs pt-1 border-t border-border/60">
                                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-muted-foreground">Protocol: </span>
                                            <span className="font-medium">Streamable HTTP</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Enable MCP in Settings → General to expose the server on its own port.
                                </p>
                            )}
                            <a
                                href={MCP_DOC_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 w-full rounded-md px-2.5 py-2 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                            >
                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                Documentation
                                <ExternalLink className="h-3 w-3 shrink-0 ml-auto opacity-70" />
                            </a>
                        </div>
                    </PopoverContent>
                </Popover>
                <BackgroundJobsIndicator />
                <span className="font-medium">{appConfig.version}</span>
            </div>
        </div>
    )
}

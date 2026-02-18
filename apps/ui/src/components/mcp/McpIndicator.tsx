import { Plug, Globe, FileText, ExternalLink } from "lucide-react"
import { useConfig } from "@/providers/config-provider"
import { useTranslation } from "@/lib/i18n"
import { nextTraceId } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const MCP_DOC_URL = "https://gitcode.com/lawrenceching/simple-media-manager/blob/main/MCP.md"

interface McpIndicatorProps {
    className?: string
}

export function McpIndicator({ className }: McpIndicatorProps) {
    const { userConfig, setAndSaveUserConfig } = useConfig()
    const { t } = useTranslation('components')

    const mcpEnabled = userConfig.enableMcpServer === true
    const mcpHost = userConfig.mcpHost ?? "127.0.0.1"
    const mcpPort = userConfig.mcpPort ?? 30001
    const mcpAddress = `http://${mcpHost}:${mcpPort}`

    const handleMcpToggle = () => {
        const traceId = `McpIndicator-MCP-toggle-${nextTraceId()}`
        setAndSaveUserConfig(traceId, { ...userConfig, enableMcpServer: !mcpEnabled })
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    data-testid="mcp-toggle-button"
                    className={cn(
                        "flex items-center justify-center rounded p-0.5 transition-colors hover:bg-muted",
                        mcpEnabled ? "text-primary" : "text-muted-foreground/50",
                        className
                    )}
                    aria-label={mcpEnabled ? t('statusBar.mcp.serverOn') : t('statusBar.mcp.serverOff')}
                >
                    <Plug className="h-4 w-4" />
                </button>
            </PopoverTrigger>
            <PopoverContent data-testid="mcp-popover" className="w-80 p-0" align="end" side="top">
                <div className="p-3 pb-2">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            mcpEnabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                            <Plug className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{t('statusBar.mcp.title')}</p>
                            <p className="text-xs text-muted-foreground">{t('statusBar.mcp.subtitle')}</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            data-testid="mcp-switch"
                            aria-checked={mcpEnabled}
                            aria-label={mcpEnabled ? t('statusBar.mcp.turnOff') : t('statusBar.mcp.turnOn')}
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
                                    <span className="text-muted-foreground font-medium">{t('statusBar.mcp.address')}</span>
                                </div>
                                <a
                                    href={mcpAddress}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    data-testid="mcp-address"
                                    className="block font-mono text-xs text-primary break-all hover:underline"
                                >
                                    {mcpAddress}
                                </a>
                                <div className="flex items-center gap-2 text-xs pt-1 border-t border-border/60">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-muted-foreground">{t('statusBar.mcp.protocol')}: </span>
                                    <span className="font-medium">{t('statusBar.mcp.protocolValue')}</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            {t('statusBar.mcp.disabledMessage')}
                        </p>
                    )}
                    <a
                        href={MCP_DOC_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 w-full rounded-md px-2.5 py-2 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                    >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        {t('statusBar.mcp.documentation')}
                        <ExternalLink className="h-3 w-3 shrink-0 ml-auto opacity-70" />
                    </a>
                </div>
            </PopoverContent>
        </Popover>
    )
}

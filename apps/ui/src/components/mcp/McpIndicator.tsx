import { Plug, Globe, FileText, ExternalLink } from "lucide-react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useConfig } from "@/hooks/userConfig"
import {
    useMcpServerStatusQuery,
    useStartMcpServerMutation,
    useStopMcpServerMutation,
} from "@/hooks/useMcpServerStatus"
import { useRefreshUserConfig } from "@/hooks/userConfig/useRefreshUserConfig"
import { useTranslation } from "@/lib/i18n"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const MCP_DOC_URL = "https://gitcode.com/lawrenceching/simple-media-manager/blob/main/MCP.md"

interface McpIndicatorProps {
    className?: string
}

export function McpIndicator({ className }: McpIndicatorProps) {
    const { userConfig } = useConfig()
    const { data: serverState } = useMcpServerStatusQuery()
    const startMcpServerMutation = useStartMcpServerMutation()
    const stopMcpServerMutation = useStopMcpServerMutation()
    const refreshUserConfig = useRefreshUserConfig()
    const { t } = useTranslation('components')

    const mcpEnabled = userConfig.enableMcpServer === true
    const mcpHost = userConfig.mcpHost ?? "127.0.0.1"
    const mcpPort = userConfig.mcpPort ?? 30001
    const mcpAddress =
        serverState?.url ?? `http://${mcpHost}:${mcpPort}/mcp`
    const isRunning = serverState?.status === "running"
    const isToggling = startMcpServerMutation.isPending || stopMcpServerMutation.isPending

    // On initial load: Core reconciles smm.json via getMcpServerStatus.
    // UI only refreshes cached config and shows a toast — never writes MCP fields.
    const initialCheckDone = useRef(false)
    useEffect(() => {
        if (!serverState || !userConfig || initialCheckDone.current) return
        initialCheckDone.current = true

        if (!mcpEnabled || isRunning) {
            return
        }

        void refreshUserConfig()

        if (serverState.status === "error") {
            toast.error(t('statusBar.mcp.serverError'), {
                description: serverState.error || t('statusBar.mcp.unknownError'),
            })
        } else if (serverState.status === "stopped") {
            toast.warning(t('statusBar.mcp.serverError'), {
                description: t('statusBar.mcp.startFailedOnLoad'),
            })
        }
    }, [serverState, userConfig, mcpEnabled, isRunning, refreshUserConfig, t])

    const handleMcpToggle = async () => {
        if (isToggling) return

        if (mcpEnabled) {
            try {
                await stopMcpServerMutation.mutateAsync()
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e)
                console.error("[McpIndicator] MCP stop failed", msg)
                toast.error(t('statusBar.mcp.serverError'), { description: msg })
            }
            return
        }

        try {
            await startMcpServerMutation.mutateAsync({ host: mcpHost, port: mcpPort })
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            console.error("[McpIndicator] MCP start failed:", msg)
            toast.error(t('statusBar.mcp.serverError'), { description: msg })
        }
    }

    const iconClass = cn(
        "flex items-center justify-center rounded p-0.5 transition-colors hover:bg-muted",
        mcpEnabled ? "text-primary" : "text-muted-foreground/50",
        className,
    )

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    data-testid="mcp-toggle-button"
                    className={iconClass}
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
                            mcpEnabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
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
                            aria-disabled={isToggling}
                            aria-label={mcpEnabled ? t('statusBar.mcp.turnOff') : t('statusBar.mcp.turnOn')}
                            onClick={handleMcpToggle}
                            disabled={isToggling}
                            className={cn(
                                "relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
                                mcpEnabled ? "bg-primary" : "bg-muted",
                            )}
                        >
                            <span
                                className={cn(
                                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-sm ring-0 transition-transform",
                                    mcpEnabled ? "translate-x-6" : "translate-x-0.5",
                                )}
                            />
                        </button>
                    </div>
                </div>
                <Separator />
                <div className="p-3 space-y-3">
                    {mcpEnabled ? (
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

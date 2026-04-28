import { Bell } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

export interface Message {
    title: string
    link?: string
    type: "info" | "warning" | "error"
}

interface MessageIndicatorProps {
    messages: Message[]
}

export function MessageIndicator({ messages }: MessageIndicatorProps) {
    const { t } = useTranslation("components")
    const actionableCount = messages.filter(
        (message) => message.type === "warning" || message.type === "error",
    ).length

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    data-testid="message-indicator-button"
                    className="relative flex items-center justify-center rounded p-0.5 transition-colors hover:bg-muted"
                    aria-label="Messages"
                >
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    {actionableCount > 0 ? (
                        <span
                            data-testid="message-indicator-badge"
                            className={cn(
                                "absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-[10px] leading-4 text-white",
                            )}
                        >
                            {actionableCount}
                        </span>
                    ) : null}
                </button>
            </PopoverTrigger>
            <PopoverContent
                data-testid="message-indicator-popover"
                className="w-80 p-2"
                align="start"
                side="top"
            >
                <div className="space-y-1">
                    {messages.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No messages</p>
                    ) : (
                        messages.map((message, index) => (
                            <div
                                key={`${message.title}-${index}`}
                                className="flex items-start justify-between gap-3 rounded px-2 py-1.5 text-xs"
                                data-testid={`message-item-${index}`}
                            >
                                <span
                                    data-testid={`message-type-${index}`}
                                    className={cn(
                                        "inline-block h-2 w-2 shrink-0 rounded-full mt-1",
                                        message.type === "info" && "bg-blue-500",
                                        message.type === "warning" && "bg-yellow-500",
                                        message.type === "error" && "bg-red-500",
                                    )}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="wrap-break-word">{message.title}</p>
                                    {message.link ? (
                                        <a
                                            href={message.link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[11px] text-primary underline-offset-2 hover:underline"
                                        >
                                            {t("statusBar.messages.learnMore")}
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}


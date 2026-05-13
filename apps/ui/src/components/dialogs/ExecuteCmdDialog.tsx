import { useState, useRef, useEffect, useCallback } from "react"
import { Loader2, Trash2, Plus, X, Play, Square, Copy } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "@/lib/i18n"
import type { ExecuteCmdDialogProps, ExecuteCmdLogEntry } from "./types"
import {
  executeCmdStream,
  type ExecuteCmdMessage,
  type ExecuteCmdType,
} from "@/api/executeCmd"

function getLogStyle(type: ExecuteCmdLogEntry["type"]): { bg: string; text: string } {
  switch (type) {
    case "stdout":
      return { bg: "bg-transparent", text: "text-foreground" }
    case "stderr":
      return { bg: "bg-orange-500/10", text: "text-orange-400" }
    case "system":
      return { bg: "bg-blue-500/10", text: "text-blue-400" }
    default:
      return { bg: "bg-transparent", text: "text-foreground" }
  }
}

const AVAILABLE_COMMANDS: ExecuteCmdType[] = ["ffmpeg", "ffprobe", "yt-dlp", "videocaptioner"]

export function ExecuteCmdDialog({ isOpen, onClose, initialCommand }: ExecuteCmdDialogProps) {
  const { t } = useTranslation(["dialogs", "common"])
  const [command, setCommand] = useState<ExecuteCmdType>(initialCommand ?? "ffmpeg")
  const [args, setArgs] = useState<string[]>([""])
  const [logs, setLogs] = useState<ExecuteCmdLogEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [executionContext, setExecutionContext] = useState<{
    executionId: string
    logRelativePath: string | null
  } | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const logIdCounterRef = useRef(0)

  useEffect(() => {
    if (isOpen && initialCommand) {
      setCommand(initialCommand)
    }
  }, [isOpen, initialCommand])

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [logs])

  const handleAddArg = useCallback(() => {
    setArgs((prev) => [...prev, ""])
  }, [])

  const handleRemoveArg = useCallback((index: number) => {
    setArgs((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleArgChange = useCallback((index: number, value: string) => {
    setArgs((prev) => prev.map((arg, i) => (i === index ? value : arg)))
  }, [])

  const handleClearLogs = useCallback(() => {
    setLogs([])
  }, [])

  const handleStartExecution = useCallback(() => {
    const filteredArgs = args.filter((arg) => arg.trim() !== "")

    if (!command) return

    setExecutionContext(null)
    logIdCounterRef.current = 0

    setLogs((prev) => [
      ...prev,
      {
        id: ++logIdCounterRef.current,
        timestamp: Date.now(),
        type: "system",
        content: `Executing: ${command} ${filteredArgs.join(" ")}`,
      },
    ])

    setIsRunning(true)

    const abortController = executeCmdStream(
      { command, args: filteredArgs },
      {
        onExecutionContext: (ctx) => {
          setExecutionContext(ctx)
        },
        onMessage: (message: ExecuteCmdMessage) => {
          logIdCounterRef.current += 1
          const newLog: ExecuteCmdLogEntry = {
            id: logIdCounterRef.current,
            timestamp: Date.now(),
            type: message.type,
            content:
              message.type === "system"
                ? `[${message.data.event}] ${
                    message.data.code !== undefined
                      ? `code=${message.data.code}`
                      : message.data.message ?? ""
                  }`
                : String(message.data),
          }
          setLogs((prev) => [...prev, newLog])
        },
        onComplete: () => {
          setIsRunning(false)
          abortControllerRef.current = null
        },
        onError: (error: Error) => {
          logIdCounterRef.current += 1
          setLogs((prev) => [
            ...prev,
            {
              id: logIdCounterRef.current,
              timestamp: Date.now(),
              type: "system",
              content: `[error] ${error.message}`,
            },
          ])
          setIsRunning(false)
          abortControllerRef.current = null
        },
      }
    )

    abortControllerRef.current = abortController
  }, [command, args])

  const handleStopExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsRunning(false)
  }, [])

  const handleClose = useCallback(() => {
    if (isRunning) {
      handleStopExecution()
    }
    setLogs([])
    setArgs([""])
    setExecutionContext(null)
    onClose()
  }, [isRunning, handleStopExecution, onClose])

  const validArgs = args.filter((arg) => arg.trim() !== "")
  const canExecute = command && !isRunning && validArgs.length > 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl" data-testid="execute-cmd-dialog">
        <DialogHeader>
          <DialogTitle>{t("dialogs:executeCmd.title")}</DialogTitle>
          <DialogDescription>{t("dialogs:executeCmd.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("dialogs:executeCmd.command")}</Label>
            <Select
              value={command}
              onValueChange={(value) => setCommand(value as ExecuteCmdType)}
              disabled={isRunning}
            >
              <SelectTrigger data-testid="execute-cmd-select">
                <SelectValue placeholder={t("dialogs:executeCmd.selectCommand")} />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_COMMANDS.map((cmd) => (
                  <SelectItem key={cmd} value={cmd} data-testid={`execute-cmd-option-${cmd}`}>
                    {cmd}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("dialogs:executeCmd.arguments")}</Label>
            <div className="space-y-2">
              {args.map((arg, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    value={arg}
                    onChange={(e) => handleArgChange(index, e.target.value)}
                    placeholder={`Argument ${index + 1}`}
                    disabled={isRunning}
                    data-testid={`execute-cmd-arg-${index}`}
                  />
                  {args.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveArg(index)}
                      disabled={isRunning}
                      data-testid={`execute-cmd-remove-arg-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddArg}
              disabled={isRunning}
              className="mt-2"
              data-testid="execute-cmd-add-arg"
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("dialogs:executeCmd.addArgument")}
            </Button>
          </div>

          {executionContext ? (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-xs">
              <p className="font-medium text-foreground">{t("dialogs:executeCmd.serverCommandLog")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground shrink-0">{t("dialogs:executeCmd.executionId")}</span>
                <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono">
                  {executionContext.executionId}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void navigator.clipboard.writeText(executionContext.executionId)}
                  data-testid="execute-cmd-copy-execution-id"
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  {t("dialogs:executeCmd.copy")}
                </Button>
              </div>
              {executionContext.logRelativePath ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground shrink-0">{t("dialogs:executeCmd.logPath")}</span>
                  <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-1 font-mono">
                    {executionContext.logRelativePath}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      void navigator.clipboard.writeText(executionContext.logRelativePath ?? "")
                    }
                    data-testid="execute-cmd-copy-log-path"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {t("dialogs:executeCmd.copy")}
                  </Button>
                </div>
              ) : null}
              <p className="text-muted-foreground leading-relaxed">{t("dialogs:executeCmd.commandLogHint")}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("dialogs:executeCmd.output")}</Label>
              <div className="flex items-center gap-2">
                {isRunning && (
                  <Badge variant="secondary" className="animate-pulse">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    {t("dialogs:executeCmd.running")}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearLogs}
                  disabled={logs.length === 0}
                  data-testid="execute-cmd-clear-logs"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t("dialogs:executeCmd.clear")}
                </Button>
              </div>
            </div>
            <ScrollArea
              ref={scrollAreaRef}
              className="h-[300px] rounded-md border p-2 font-mono text-sm bg-muted/50"
              data-testid="execute-cmd-logs"
            >
              {logs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                  {t("dialogs:executeCmd.noOutput")}
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log) => {
                    const style = getLogStyle(log.type)
                    return (
                      <div
                        key={log.id}
                        className={`${style.bg} ${style.text} px-2 py-1 rounded text-xs whitespace-pre-wrap break-all`}
                        data-testid={`execute-cmd-log-${log.id}`}
                      >
                        <span className="text-muted-foreground mr-2">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        {log.content}
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose} data-testid="execute-cmd-close">
            {t("close", { ns: "common" })}
          </Button>
          {isRunning ? (
            <Button
              variant="destructive"
              onClick={handleStopExecution}
              data-testid="execute-cmd-stop"
            >
              <Square className="h-4 w-4 mr-1" />
              {t("dialogs:executeCmd.stop")}
            </Button>
          ) : (
            <Button
              onClick={handleStartExecution}
              disabled={!canExecute}
              data-testid="execute-cmd-execute"
            >
              <Play className="h-4 w-4 mr-1" />
              {t("dialogs:executeCmd.execute")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

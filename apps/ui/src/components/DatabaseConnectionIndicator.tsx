import { TriangleAlert } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  useDatabaseConnectionStatus,
  type DatabaseConnectionStatus,
} from "@/hooks/useDatabaseConnectionStatus"

function StatusDot({ status }: { status: DatabaseConnectionStatus }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        status === "connected" && "bg-green-500",
        status === "disconnected" && "bg-red-500",
        status === "checking" && "bg-yellow-500 animate-pulse"
      )}
    />
  )
}

export function DatabaseConnectionIndicator() {
  const { tmdbStatus, tvdbStatus, hasWarning } = useDatabaseConnectionStatus()
  const { t } = useTranslation("components")

  if (!hasWarning) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="database-connection-warning"
          className={cn(
            "flex items-center justify-center rounded p-0.5 transition-colors hover:bg-muted",
            "text-yellow-500"
          )}
          aria-label={t("statusBar.database.warningAriaLabel")}
        >
          <TriangleAlert className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        data-testid="database-connection-popover"
        className="w-72 p-0"
        align="end"
        side="top"
      >
        <div className="p-3 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-500/15 text-yellow-500">
              <TriangleAlert className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {t("statusBar.database.title")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("statusBar.database.subtitle")}
              </p>
            </div>
          </div>
        </div>
        <Separator />
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <StatusDot status={tmdbStatus} />
            <span className="font-medium">{t("statusBar.database.tmdb")}</span>
            <span className="text-muted-foreground ml-auto">
              {t(
                `statusBar.database.${tmdbStatus}`
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <StatusDot status={tvdbStatus} />
            <span className="font-medium">{t("statusBar.database.tvdb")}</span>
            <span className="text-muted-foreground ml-auto">
              {t(
                `statusBar.database.${tvdbStatus}`
              )}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

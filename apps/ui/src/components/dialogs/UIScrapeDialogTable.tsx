import { Loader2, CheckCircle2, XCircle, Circle } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ScrapeTaskView } from "@/lib/scrapeDialog"
import { useTranslation } from "@/lib/i18n"
import { localizeScrapeError } from "@/lib/scrapeError"

function scrapeTaskNameKey(id: ScrapeTaskView["id"]): `scrape.tasks.${ScrapeTaskView["id"]}` {
  return `scrape.tasks.${id}`
}

function ScrapeTaskRow({ task }: { task: ScrapeTaskView }) {
  const { t } = useTranslation("dialogs")

  const icon =
    task.status === "running" ? (
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
    ) : task.status === "completed" ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : task.status === "failed" ? (
      <XCircle className="h-4 w-4 text-destructive" />
    ) : (
      <Circle className="h-4 w-4 text-muted-foreground" />
    )

  const text =
    task.status === "running"
      ? t("scrape.status.running")
      : task.status === "completed"
        ? t("scrape.status.completed")
        : task.status === "failed"
          ? task.failedReason
            ? localizeScrapeError(task.failedReason, t)
            : t("scrape.status.failed")
          : t("scrape.status.pending")

  return (
    <TableRow data-testid={`scrape-dialog-task-row-${task.id}`}>
      <TableCell className="py-2 px-2">
        <span className="text-sm">{t(scrapeTaskNameKey(task.id))}</span>
      </TableCell>
      <TableCell className="py-2 px-2">
        <div
          className="flex items-center gap-2"
          data-testid={`scrape-dialog-task-status-${task.id}`}
        >
          {icon}
          <span
            className="text-xs text-muted-foreground"
            title={
              task.status === "failed" && task.failedReason ? task.failedReason : undefined
            }
          >
            {text}
          </span>
        </div>
      </TableCell>
    </TableRow>
  )
}

export interface UIScrapeDialogTableProps {
  tasks: ScrapeTaskView[]
}

export function UIScrapeDialogTable({ tasks }: UIScrapeDialogTableProps) {
  const { t } = useTranslation("dialogs")

  return (
    <Table data-testid="scrape-dialog-table">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="py-2 px-2">{t("scrape.columns.file")}</TableHead>
          <TableHead className="py-2 px-2">{t("scrape.columns.status")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <ScrapeTaskRow key={task.id} task={task} />
        ))}
      </TableBody>
    </Table>
  )
}

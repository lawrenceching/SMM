/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { UIScrapeDialog } from "./UIScrapeDialog"
import type { ScrapeTaskView } from "@/lib/scrapeDialog"

vi.mock("@/lib/i18n", () => ({
  useTranslation: (ns?: string | string[]) => ({
    t: (key: string) => {
      if (ns === "common" && key === "cancel") return "取消"
      const map: Record<string, string> = {
        "scrape.defaultTitle": "任务进度",
        "scrape.defaultDescription": "当前任务执行状态",
        "scrape.start": "开始",
        "scrape.done": "完成",
        "scrape.noTasks": "没有任务",
        "scrape.tasks.poster": "海报",
        "scrape.columns.file": "文件",
        "scrape.columns.status": "状态",
        "scrape.status.pending": "未下载",
      }
      return map[key] ?? key
    },
  }),
}))

const pendingTasks: ScrapeTaskView[] = [
  { id: "poster", status: "pending" },
  { id: "fanart", status: "pending" },
  { id: "thumbnails", status: "pending" },
  { id: "nfo", status: "pending" },
]

describe("UIScrapeDialog", () => {
  const onClose = vi.fn()
  const onCancel = vi.fn()
  const onStart = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("enables cancel before scrape and invokes onCancel when clicked", () => {
    render(
      <UIScrapeDialog
        isOpen
        onClose={onClose}
        tasks={pendingTasks}
        isRunning={false}
        allTasksDone={false}
        showButtons
        cancelDisabled={false}
        canDismissIncidentally={false}
        onCancel={onCancel}
        onStart={onStart}
      />,
    )

    const cancel = screen.getByTestId("scrape-dialog-cancel")
    expect(cancel).not.toBeDisabled()
    fireEvent.click(cancel)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("disables cancel while scrape is running", () => {
    render(
      <UIScrapeDialog
        isOpen
        onClose={onClose}
        tasks={pendingTasks.map((t) => ({ ...t, status: "running" as const }))}
        isRunning
        allTasksDone={false}
        showButtons
        cancelDisabled
        canDismissIncidentally={false}
        onCancel={onCancel}
        onStart={onStart}
      />,
    )

    expect(screen.getByTestId("scrape-dialog-cancel")).toBeDisabled()
    expect(screen.getByTestId("scrape-dialog-start")).toBeDisabled()
  })

  it("invokes onStart when start is clicked", () => {
    render(
      <UIScrapeDialog
        isOpen
        onClose={onClose}
        tasks={pendingTasks}
        isRunning={false}
        allTasksDone={false}
        showButtons
        cancelDisabled={false}
        canDismissIncidentally={false}
        onCancel={onCancel}
        onStart={onStart}
      />,
    )

    fireEvent.click(screen.getByTestId("scrape-dialog-start"))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})

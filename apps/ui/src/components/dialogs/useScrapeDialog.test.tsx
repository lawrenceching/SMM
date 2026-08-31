/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { UIScrapeDialog } from "./UIScrapeDialog"
import { useScrapeDialog, type UseScrapeDialogInput } from "./useScrapeDialog"
import type { ScrapeJob } from "@/api/getJob"

const scrapeFolderViaCoreMock = vi.fn()
const getJobViaCoreMock = vi.fn()
const refreshMediaMetadataMock = vi.fn().mockResolvedValue(undefined)
const listFilesMock = vi.fn().mockResolvedValue({ data: { items: [] } })
const userConfigMock = { preferMediaLanguage: "zh-CN" }

vi.mock("@/api/scrapeV3", () => ({
  scrapeFolderViaCore: (...args: unknown[]) => scrapeFolderViaCoreMock(...args),
}))
vi.mock("@/api/getJob", () => ({
  getJobViaCore: (...args: unknown[]) => getJobViaCoreMock(...args),
}))
vi.mock(
  "@/hooks/mediaMetadata/useFetchMediaMetadataMutation",
  () => ({
    useFetchMediaMetadataMutation: () => ({
      mutateAsync: refreshMediaMetadataMock,
    }),
  }),
)
vi.mock("@/api/listFiles", () => ({
  listFiles: (...args: unknown[]) => listFilesMock(...args),
}))
vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => ({ userConfig: userConfigMock }),
}))

const I18N_KEYS: Record<string, string> = {
  "scrape.tasks.poster": "海报",
  "scrape.tasks.fanart": "背景图",
  "scrape.tasks.thumbnails": "每集封面",
  "scrape.tasks.nfo": "nfo",
  "scrape.status.pending": "未下载",
  "scrape.status.running": "运行中",
  "scrape.status.completed": "已完成",
  "scrape.status.failed": "失败",
  "scrape.errors.imageUrlTimeout": "图片链接访问超时",
  "scrape.errors.imageUrlNotFound": "图片链接域名无法解析",
  "scrape.errors.imageUrlConnectionRefused": "图片链接连接被拒绝",
  "scrape.errors.imageUrlNetworkFailed": "图片链接网络连接失败",
  "scrape.errors.metadataNetworkFailed": "无法连接媒体数据库",
  "scrape.errors.tmdbUnavailable": "TMDB 服务不可用",
  "scrape.errors.tvdbUnavailable": "TVDB 服务不可用",
  "scrape.errors.reverseProxyUnavailable": "本地反向代理不可用",
  "scrape.errors.internal": "发生内部错误，请稍后重试",
  "scrape.errors.unknown": "任务失败，请稍后重试",
  "scrape.defaultTitle": "任务进度",
  "scrape.defaultDescription": "当前任务执行状态",
  "scrape.start": "开始",
  "scrape.done": "完成",
  "scrape.columns.file": "文件",
  "scrape.columns.status": "状态",
  "scrape.noTasks": "没有任务",
  cancel: "取消",
}

const stableT = (key: string) => I18N_KEYS[key] ?? key
const stableI18n = { t: stableT }

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => stableI18n,
}))

function Harness(props: UseScrapeDialogInput) {
  const dlg = useScrapeDialog(props)
  return (
    <UIScrapeDialog
      isOpen={props.isOpen}
      onClose={props.onClose}
      tasks={dlg.tasks}
      isRunning={dlg.isRunning}
      allTasksDone={dlg.allTasksDone}
      showButtons={dlg.showButtons}
      cancelDisabled={dlg.cancelDisabled}
      canDismissIncidentally={dlg.canDismissIncidentally}
      onCancel={dlg.handleCancel}
      onStart={dlg.handleStart}
    />
  )
}

function renderDialog(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

function movieMetadata() {
  return {
    type: "movie-folder",
    mediaFolderPath: "/media/Movie",
    mediaFiles: [{ absolutePath: "/media/Movie/movie.mkv" }],
    movie: { id: "1", name: "Movie", database: "TMDB" },
  } as any
}

function scrapeJob(overrides: Partial<ScrapeJob> = {}): ScrapeJob {
  return {
    kind: "scrape",
    id: "job-1",
    folderPath: "/media/Movie",
    status: "succeeded",
    tasks: {
      poster: { status: "completed" },
      fanart: { status: "completed" },
      thumbnails: { status: "skipped" },
      nfo: { status: "completed" },
    },
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe("useScrapeDialog — movie folder tasks", () => {
  beforeEach(() => {
    listFilesMock.mockReset()
    listFilesMock.mockResolvedValue({ data: { items: [] } })
  })

  it("does not show the thumbnails row for movie folders", async () => {
    renderDialog(<Harness isOpen onClose={vi.fn()} mediaMetadata={movieMetadata()} />)

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-task-row-poster")).toBeInTheDocument()
    })

    expect(screen.queryByTestId("scrape-dialog-task-row-thumbnails")).not.toBeInTheDocument()
    expect(screen.queryByText("每集封面")).not.toBeInTheDocument()
  })
})

describe("useScrapeDialog — error propagation", () => {
  beforeEach(() => {
    scrapeFolderViaCoreMock.mockReset()
    getJobViaCoreMock.mockReset()
    refreshMediaMetadataMock.mockClear()
    listFilesMock.mockClear()
    listFilesMock.mockResolvedValue({ data: { items: [] } })
    scrapeFolderViaCoreMock.mockResolvedValue("job-1")
  })

  it("starts scrape via Core job API instead of per-task mutations", async () => {
    getJobViaCoreMock.mockResolvedValue(scrapeJob())

    renderDialog(<Harness isOpen onClose={vi.fn()} mediaMetadata={movieMetadata()} />)
    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    await waitFor(() => {
      expect(scrapeFolderViaCoreMock).toHaveBeenCalledWith({
        path: "/media/Movie",
        language: "zh-CN",
      })
    })
    expect(getJobViaCoreMock).toHaveBeenCalledWith("job-1", expect.any(AbortSignal))
  })

  it("captures the server's raw error message and shows the localized error in the status column", async () => {
    getJobViaCoreMock.mockResolvedValue(
      scrapeJob({
        status: "failed",
        tasks: {
          poster: {
            status: "failed",
            error:
              "Image URL fetch failed: Unable to connect. Is the computer able to access the url? (ConnectionRefused)",
          },
          fanart: { status: "completed" },
          thumbnails: { status: "skipped" },
          nfo: { status: "completed" },
        },
      }),
    )

    renderDialog(<Harness isOpen onClose={vi.fn()} mediaMetadata={movieMetadata()} />)
    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    await waitFor(() => {
      const posterStatus = screen.getByTestId("scrape-dialog-task-status-poster")
      expect(posterStatus.textContent).toContain("图片链接连接被拒绝")
    })

    const fanartStatus = screen.getByTestId("scrape-dialog-task-status-fanart")
    expect(fanartStatus.textContent).toContain("已完成")
  })

  it("shows 'Failed' (no localized reason) when the error message is empty", async () => {
    getJobViaCoreMock.mockResolvedValue(
      scrapeJob({
        status: "failed",
        tasks: {
          poster: { status: "failed", error: "" },
          fanart: { status: "completed" },
          thumbnails: { status: "skipped" },
          nfo: { status: "completed" },
        },
      }),
    )

    renderDialog(<Harness isOpen onClose={vi.fn()} mediaMetadata={movieMetadata()} />)
    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    await waitFor(() => {
      const posterStatus = screen.getByTestId("scrape-dialog-task-status-poster")
      expect(posterStatus.textContent).toContain("失败")
    })
  })

  it("localizes internal TypeError as a user-friendly internal error", async () => {
    scrapeFolderViaCoreMock.mockRejectedValue(
      new TypeError("Cannot read properties of undefined (reading 'status')"),
    )

    renderDialog(<Harness isOpen onClose={vi.fn()} mediaMetadata={movieMetadata()} />)

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-task-status-poster").textContent).toContain(
        "未下载",
      )
    })

    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    await waitFor(() => {
      const posterStatus = screen.getByTestId("scrape-dialog-task-status-poster")
      expect(posterStatus.textContent).toContain("发生内部错误，请稍后重试")
    })
  })

  it("captures ETIMEDOUT and localizes it as '图片链接访问超时'", async () => {
    getJobViaCoreMock.mockResolvedValue(
      scrapeJob({
        status: "failed",
        tasks: {
          poster: {
            status: "failed",
            error: "Failed to download image: fetch failed (ETIMEDOUT: connect ETIMEDOUT)",
          },
          fanart: { status: "completed" },
          thumbnails: { status: "skipped" },
          nfo: { status: "completed" },
        },
      }),
    )

    renderDialog(<Harness isOpen onClose={vi.fn()} mediaMetadata={movieMetadata()} />)
    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    await waitFor(() => {
      const posterStatus = screen.getByTestId("scrape-dialog-task-status-poster")
      expect(posterStatus.textContent).toContain("图片链接访问超时")
    })
  })
})

describe("useScrapeDialog — cancel button", () => {
  beforeEach(() => {
    scrapeFolderViaCoreMock.mockReset()
    getJobViaCoreMock.mockReset()
    refreshMediaMetadataMock.mockClear()
    listFilesMock.mockClear()
    listFilesMock.mockResolvedValue({ data: { items: [] } })
    scrapeFolderViaCoreMock.mockResolvedValue("job-1")
    getJobViaCoreMock.mockResolvedValue(scrapeJob())
  })

  it("keeps cancel enabled with pending tasks and closes on cancel click", async () => {
    const onClose = vi.fn()
    renderDialog(<Harness isOpen onClose={onClose} mediaMetadata={movieMetadata()} />)

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-task-status-poster").textContent).toContain(
        "未下载",
      )
    })

    const cancel = screen.getByTestId("scrape-dialog-cancel")
    expect(cancel).not.toBeDisabled()
    fireEvent.click(cancel)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("keeps cancel enabled when some tasks are completed but scrape has not started", async () => {
    listFilesMock.mockResolvedValue({
      data: { items: [{ path: "/media/Movie/poster.jpg" }] },
    })

    const onClose = vi.fn()
    renderDialog(<Harness isOpen onClose={onClose} mediaMetadata={movieMetadata()} />)

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-task-status-poster").textContent).toContain(
        "已完成",
      )
      expect(screen.getByTestId("scrape-dialog-task-status-fanart").textContent).toContain(
        "未下载",
      )
    })

    expect(screen.getByTestId("scrape-dialog-cancel")).not.toBeDisabled()
    fireEvent.click(screen.getByTestId("scrape-dialog-cancel"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("disables cancel while scrape is running", async () => {
    getJobViaCoreMock
      .mockResolvedValueOnce(
        scrapeJob({
          status: "running",
          tasks: {
            poster: { status: "running" },
            fanart: { status: "pending" },
            thumbnails: { status: "skipped" },
            nfo: { status: "pending" },
          },
        }),
      )
      .mockImplementation(() => new Promise(() => {}))

    renderDialog(<Harness isOpen onClose={vi.fn()} mediaMetadata={movieMetadata()} />)

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-task-status-poster").textContent).toContain(
        "未下载",
      )
    })

    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-cancel")).toBeDisabled()
      expect(screen.getByTestId("scrape-dialog-task-status-poster").textContent).toContain(
        "运行中",
      )
    })
  })
})

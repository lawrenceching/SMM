import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ScrapeDialog } from "./ScrapeDialog"

const scrapePosterMock = vi.fn()
const scrapeFanartMock = vi.fn()
const scrapeThumbnailMock = vi.fn()
const scrapeNfoMock = vi.fn()
const refreshMediaMetadataMock = vi.fn().mockResolvedValue(undefined)
const listFilesMock = vi.fn().mockResolvedValue({ data: { items: [] } })
const userConfigMock = { preferMediaLanguage: "zh-CN" }

vi.mock("@/hooks/useScrapeNfoMutation", () => ({
  useScrapeNfoMutation: () => ({ mutateAsync: scrapeNfoMock }),
}))
vi.mock("@/hooks/useScrapePosterMutation", () => ({
  useScrapePosterMutation: () => ({ mutateAsync: scrapePosterMock }),
}))
vi.mock("@/hooks/useScrapeFanartMutation", () => ({
  useScrapeFanartMutation: () => ({ mutateAsync: scrapeFanartMock }),
}))
vi.mock("@/hooks/useScrapeThumbnailMutation", () => ({
  useScrapeThumbnailMutation: () => ({ mutateAsync: scrapeThumbnailMock }),
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

describe("ScrapeDialog — movie folder tasks", () => {
  const mediaMetadata = {
    type: "movie-folder",
    mediaFolderPath: "/media/Movie",
    mediaFiles: [{ absolutePath: "/media/Movie/movie.mkv" }],
    movie: { id: "1", name: "Movie", database: "TMDB" },
  } as any

  beforeEach(() => {
    listFilesMock.mockReset()
    listFilesMock.mockResolvedValue({ data: { items: [] } })
  })

  it("does not show the thumbnails row for movie folders", async () => {
    render(<ScrapeDialog isOpen onClose={vi.fn()} mediaMetadata={mediaMetadata} />)

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-task-row-poster")).toBeInTheDocument()
    })

    expect(screen.queryByTestId("scrape-dialog-task-row-thumbnails")).not.toBeInTheDocument()
    expect(screen.queryByText("每集封面")).not.toBeInTheDocument()
  })
})

describe("ScrapeDialog — error propagation", () => {
  const mediaMetadata = {
    type: "movie-folder",
    mediaFolderPath: "/media/Movie",
    mediaFiles: [{ absolutePath: "/media/Movie/movie.mkv" }],
    movie: { id: "1", name: "Movie", database: "TMDB" },
  } as any

  beforeEach(() => {
    scrapePosterMock.mockReset()
    scrapeFanartMock.mockReset()
    scrapeThumbnailMock.mockReset()
    scrapeNfoMock.mockReset()
    refreshMediaMetadataMock.mockClear()
    listFilesMock.mockClear()
    listFilesMock.mockResolvedValue({ data: { items: [] } })
  })

  it("captures the server's raw error message and shows the localized error in the status column", async () => {
    scrapePosterMock.mockRejectedValue(
      new Error(
        "Image URL fetch failed: Unable to connect. Is the computer able to access the url? (ConnectionRefused)",
      ),
    )
    scrapeFanartMock.mockResolvedValue(undefined)
    scrapeThumbnailMock.mockResolvedValue(undefined)
    scrapeNfoMock.mockResolvedValue(undefined)

    const onClose = vi.fn()
    render(
      <ScrapeDialog isOpen onClose={onClose} mediaMetadata={mediaMetadata} />,
    )

    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    await waitFor(() => {
      const posterStatus = screen.getByTestId("scrape-dialog-task-status-poster")
      expect(posterStatus.textContent).toContain("图片链接连接被拒绝")
    })

    const fanartStatus = screen.getByTestId("scrape-dialog-task-status-fanart")
    expect(fanartStatus.textContent).toContain("已完成")
  })

  it("shows 'Failed' (no localized reason) when the error message is empty", async () => {
    scrapePosterMock.mockRejectedValue(new Error(""))
    scrapeFanartMock.mockResolvedValue(undefined)
    scrapeThumbnailMock.mockResolvedValue(undefined)
    scrapeNfoMock.mockResolvedValue(undefined)

    const onClose = vi.fn()
    render(
      <ScrapeDialog isOpen onClose={onClose} mediaMetadata={mediaMetadata} />,
    )

    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    await waitFor(() => {
      const posterStatus = screen.getByTestId("scrape-dialog-task-status-poster")
      expect(posterStatus.textContent).toContain("失败")
    })
  })

  it("captures ETIMEDOUT and localizes it as '图片链接访问超时'", async () => {
    scrapePosterMock.mockRejectedValue(
      new Error(
        "Failed to download image: fetch failed (ETIMEDOUT: connect ETIMEDOUT)",
      ),
    )
    scrapeFanartMock.mockResolvedValue(undefined)
    scrapeThumbnailMock.mockResolvedValue(undefined)
    scrapeNfoMock.mockResolvedValue(undefined)

    const onClose = vi.fn()
    render(
      <ScrapeDialog isOpen onClose={onClose} mediaMetadata={mediaMetadata} />,
    )

    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    await waitFor(() => {
      const posterStatus = screen.getByTestId("scrape-dialog-task-status-poster")
      expect(posterStatus.textContent).toContain("图片链接访问超时")
    })
  })
})

describe("ScrapeDialog — cancel button", () => {
  const mediaMetadata = {
    type: "movie-folder",
    mediaFolderPath: "/media/Movie",
    mediaFiles: [{ absolutePath: "/media/Movie/movie.mkv" }],
    movie: { id: "1", name: "Movie", database: "TMDB" },
  } as any

  beforeEach(() => {
    scrapePosterMock.mockReset()
    scrapeFanartMock.mockReset()
    scrapeThumbnailMock.mockReset()
    scrapeNfoMock.mockReset()
    refreshMediaMetadataMock.mockClear()
    listFilesMock.mockClear()
    listFilesMock.mockResolvedValue({ data: { items: [] } })
    scrapePosterMock.mockResolvedValue(undefined)
    scrapeFanartMock.mockResolvedValue(undefined)
    scrapeThumbnailMock.mockResolvedValue(undefined)
    scrapeNfoMock.mockResolvedValue(undefined)
  })

  it("keeps cancel enabled with pending tasks and closes on cancel click", async () => {
    const onClose = vi.fn()
    render(
      <ScrapeDialog isOpen onClose={onClose} mediaMetadata={mediaMetadata} />,
    )

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
    render(
      <ScrapeDialog isOpen onClose={onClose} mediaMetadata={mediaMetadata} />,
    )

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
    let resolvePoster!: () => void
    scrapePosterMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePoster = resolve
        }),
    )

    render(
      <ScrapeDialog isOpen onClose={vi.fn()} mediaMetadata={mediaMetadata} />,
    )

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

    resolvePoster()

    await waitFor(() => {
      expect(screen.getByTestId("scrape-dialog-task-status-poster").textContent).toContain(
        "已完成",
      )
    })
  })
})

import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ScrapeDialog } from "./ScrapeDialog"

// Mock the mutations. We simulate a server error by making
// `mutateAsync` reject with the raw error message that
// `apps/cli/src/route/DownloadImageAsFile.ts` (now backed by
// `packages/core-routes/src/downloadImageAsFile.ts:describeFetchError`)
// returns.
const scrapePosterMock = vi.fn()
const scrapeFanartMock = vi.fn()
const scrapeThumbnailMock = vi.fn()
const scrapeNfoMock = vi.fn()
const refreshMediaMetadataMock = vi.fn().mockResolvedValue(undefined)
const listFilesMock = vi.fn().mockResolvedValue({ data: { items: [] } })
const configMock = { folders: [] }
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

// Mock i18n with a deterministic t() that uses the keys we expect.
// IMPORTANT: useTranslation must return a stable t reference across
// renders, otherwise the ScrapeDialog useEffect that depends on `t`
// will re-fire on every render and cause "Maximum update depth
// exceeded".
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
  "cancel": "取消",
}

const stableT = (key: string) => I18N_KEYS[key] ?? key
const stableI18n = { t: stableT }

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => stableI18n,
}))

describe("ScrapeDialog V1 — error propagation", () => {
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
    // Simulate the server returning the new cause-bearing error
    // (the one we now produce from `doDownloadImageAsFile`).
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

    // Click "Start"
    fireEvent.click(screen.getByRole("button", { name: "开始" }))

    // Wait for the poster row to show "Failed" status with the
    // localized error message.
    await waitFor(() => {
      const posterStatus = screen.getByTestId("scrape-dialog-task-status-poster")
      expect(posterStatus.textContent).toContain("图片链接连接被拒绝")
    })

    // Other tasks should be completed.
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
import { describe, expect, it, vi, beforeEach } from "vitest"
import type { MediaMetadata } from "@smm/types"
import type { ScrapeJob } from "@/api/getJob"
import {
  areAllTasksDone,
  checkTaskCompletion,
  deriveScrapeTasks,
  getScrapeTaskIdsForMedia,
} from "@/lib/scrapeDialog"

const listFilesMock = vi.fn()

vi.mock("@/api/listFiles", () => ({
  listFiles: (...args: unknown[]) => listFilesMock(...args),
}))

describe("ScrapeDialog task list by media type", () => {
  it("excludes thumbnails for movie folders", () => {
    expect(getScrapeTaskIdsForMedia({ type: "movie-folder" } as MediaMetadata)).toEqual([
      "poster",
      "fanart",
      "nfo",
    ])
  })

  it("includes thumbnails for tv show folders", () => {
    expect(getScrapeTaskIdsForMedia({ type: "tvshow-folder" } as MediaMetadata)).toEqual([
      "poster",
      "fanart",
      "thumbnails",
      "nfo",
    ])
  })
})

describe("deriveScrapeTasks", () => {
  const movieMeta = { type: "movie-folder" as const }

  it("applies completion map onto the baseline task list", () => {
    const tasks = deriveScrapeTasks({
      mediaMetadata: movieMeta,
      completion: { poster: true, fanart: false, thumbnails: true, nfo: false },
    })

    expect(tasks.find((t) => t.id === "poster")?.status).toBe("completed")
    expect(tasks.find((t) => t.id === "fanart")?.status).toBe("pending")
    expect(tasks.find((t) => t.id === "nfo")?.status).toBe("pending")
    expect(tasks.find((t) => t.id === "thumbnails")).toBeUndefined()
  })

  it("lets scrape job statuses override completion", () => {
    const scrapeJob: ScrapeJob = {
      kind: "scrape",
      id: "job-1",
      folderPath: "/media/Movie",
      status: "running",
      tasks: {
        poster: { status: "completed" },
        fanart: { status: "running" },
        thumbnails: { status: "skipped" },
        nfo: { status: "failed", error: "scrape.errors.tmdbUnavailable" },
      },
      createdAt: 0,
      updatedAt: 0,
    }

    const tasks = deriveScrapeTasks({
      mediaMetadata: movieMeta,
      completion: { poster: false, fanart: false, nfo: false },
      scrapeJob,
    })

    expect(tasks.find((t) => t.id === "poster")?.status).toBe("completed")
    expect(tasks.find((t) => t.id === "fanart")?.status).toBe("running")
    expect(tasks.find((t) => t.id === "nfo")?.status).toBe("failed")
    expect(tasks.find((t) => t.id === "nfo")?.failedReason).toBe("scrape.errors.tmdbUnavailable")
  })

  it("marks pending rows failed from startError without clearing completed ones", () => {
    const tasks = deriveScrapeTasks({
      mediaMetadata: movieMeta,
      completion: { poster: true, fanart: false, nfo: false },
      startError: new TypeError("Cannot read properties of undefined (reading 'status')"),
    })

    expect(tasks.find((t) => t.id === "poster")?.status).toBe("completed")
    expect(tasks.find((t) => t.id === "fanart")?.status).toBe("failed")
    expect(tasks.find((t) => t.id === "fanart")?.failedReason).toBe("scrape.errors.internal")
    expect(tasks.find((t) => t.id === "nfo")?.status).toBe("failed")
  })

  it("ignores startError when a scrape job is present", () => {
    const scrapeJob: ScrapeJob = {
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
    }

    const tasks = deriveScrapeTasks({
      mediaMetadata: movieMeta,
      scrapeJob,
      startError: new Error("should be ignored"),
    })

    expect(tasks.every((t) => t.status === "completed")).toBe(true)
  })
})

describe("ScrapeDialog selectors", () => {
  it("areAllTasksDone returns true when all are completed/failed", () => {
    expect(
      areAllTasksDone([
        { id: "poster", status: "completed" },
        { id: "fanart", status: "failed" },
      ]),
    ).toBe(true)

    expect(
      areAllTasksDone([
        { id: "poster", status: "completed" },
        { id: "fanart", status: "running" },
      ]),
    ).toBe(false)
  })
})

describe("ScrapeDialog completion checks", () => {
  beforeEach(() => {
    listFilesMock.mockReset()
  })

  it("marks movie nfo completion using movie.nfo", async () => {
    listFilesMock.mockResolvedValue({
      data: {
        items: [
          { path: "/media/Movie/poster.jpg" },
          { path: "/media/Movie/fanart.jpg" },
          { path: "/media/Movie/movie.nfo" },
          { path: "/media/Movie/movie.jpg" },
        ],
      },
    })

    const mediaMetadata = {
      type: "movie-folder",
      mediaFolderPath: "/media/Movie",
      mediaFiles: [{ absolutePath: "/media/Movie/movie.mkv" }],
      movie: { id: "1", name: "Movie", database: "TMDB" },
    } as MediaMetadata

    const completion = await checkTaskCompletion(mediaMetadata)
    expect(completion.poster).toBe(true)
    expect(completion.fanart).toBe(true)
    expect(completion.nfo).toBe(true)
  })

  it("does not mark thumbnails complete when no episodes have season/episode", async () => {
    listFilesMock.mockResolvedValue({
      data: {
        items: [{ path: "/media/Movie/the-jester-f.mp4" }],
      },
    })

    const mediaMetadata = {
      type: "movie-folder",
      mediaFolderPath: "/media/Movie",
      mediaFiles: [{ absolutePath: "/media/Movie/the-jester-f.mp4" }],
      movie: { id: "1", name: "Movie", database: "TMDB" },
    } as MediaMetadata

    const completion = await checkTaskCompletion(mediaMetadata)
    expect(completion.thumbnails).toBe(false)
  })
})

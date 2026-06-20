import { describe, expect, it, vi, beforeEach } from "vitest"
import type { MediaMetadata } from "@core/types"
import { areAllTasksDone, checkTaskCompletion, getScrapeTaskIdsForMedia, taskReducer } from "@/lib/scrapeDialog"

const listFilesMock = vi.fn()

vi.mock("@/api/listFiles", () => ({
  listFiles: (...args: unknown[]) => listFilesMock(...args),
}))

describe("ScrapeDialog task list by media type", () => {
  it("excludes thumbnails for movie folders", () => {
    expect(
      getScrapeTaskIdsForMedia({ type: "movie-folder" } as MediaMetadata),
    ).toEqual(["poster", "fanart", "nfo"])
  })

  it("includes thumbnails for tv show folders", () => {
    expect(
      getScrapeTaskIdsForMedia({ type: "tvshow-folder" } as MediaMetadata),
    ).toEqual(["poster", "fanart", "thumbnails", "nfo"])
  })
})

describe("ScrapeDialog state reducer", () => {
  it("initializes tasks and applies completion map", () => {
    const initState = taskReducer(
      { tasks: [], isRunning: false },
      {
        type: "INIT",
        tasks: [
          { id: "poster", status: "pending" },
          { id: "fanart", status: "pending" },
          { id: "thumbnails", status: "pending" },
          { id: "nfo", status: "pending" },
        ],
      },
    )

    const completed = taskReducer(initState, {
      type: "SET_COMPLETION",
      completion: { poster: true, fanart: false, thumbnails: true, nfo: false },
    })

    expect(completed.tasks.find((t) => t.id === "poster")?.status).toBe("completed")
    expect(completed.tasks.find((t) => t.id === "fanart")?.status).toBe("pending")
    expect(completed.tasks.find((t) => t.id === "thumbnails")?.status).toBe("completed")
    expect(completed.tasks.find((t) => t.id === "nfo")?.status).toBe("pending")
  })

  it("tracks running and finish states", () => {
    const started = taskReducer({ tasks: [], isRunning: false }, { type: "START_RUN" })
    expect(started.isRunning).toBe(true)

    const running = taskReducer(
      {
        tasks: [{ id: "poster", status: "pending" }],
        isRunning: true,
      },
      { type: "MARK_RUNNING", id: "poster" },
    )
    expect(running.tasks[0]?.status).toBe("running")

    const failed = taskReducer(running, { type: "MARK_FAILED", id: "poster" })
    expect(failed.tasks[0]?.status).toBe("failed")
    expect(failed.tasks[0]?.failedReason).toBeUndefined()

    const failedWithReason = taskReducer(running, {
      type: "MARK_FAILED",
      id: "poster",
      reason: "fetch failed (ETIMEDOUT: connect ETIMEDOUT)",
    })
    expect(failedWithReason.tasks[0]?.status).toBe("failed")
    expect(failedWithReason.tasks[0]?.failedReason).toBe(
      "fetch failed (ETIMEDOUT: connect ETIMEDOUT)",
    )

    const finished = taskReducer(failed, { type: "FINISH_RUN" })
    expect(finished.isRunning).toBe(false)
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

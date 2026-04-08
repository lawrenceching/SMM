import { describe, expect, it, vi, beforeEach } from "vitest"
import type { MediaMetadata } from "@core/types"
import { areAllTasksDone, checkTaskCompletion, taskReducer } from "./ScrapeDialogV2"

const listFilesMock = vi.fn()

vi.mock("@/api/listFiles", () => ({
  listFiles: (...args: unknown[]) => listFilesMock(...args),
}))

describe("ScrapeDialogV2 state reducer", () => {
  it("initializes tasks and applies completion map", () => {
    const initState = taskReducer(
      { tasks: [], isRunning: false },
      {
        type: "INIT",
        tasks: [
          { id: "poster", name: "Poster", status: "pending" },
          { id: "fanart", name: "Fanart", status: "pending" },
          { id: "thumbnails", name: "Thumbnails", status: "pending" },
          { id: "nfo", name: "NFO", status: "pending" },
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
        tasks: [{ id: "poster", name: "Poster", status: "pending" }],
        isRunning: true,
      },
      { type: "MARK_RUNNING", id: "poster" },
    )
    expect(running.tasks[0]?.status).toBe("running")

    const failed = taskReducer(running, { type: "MARK_FAILED", id: "poster" })
    expect(failed.tasks[0]?.status).toBe("failed")

    const finished = taskReducer(failed, { type: "FINISH_RUN" })
    expect(finished.isRunning).toBe(false)
  })
})

describe("ScrapeDialogV2 selectors", () => {
  it("areAllTasksDone returns true when all are completed/failed", () => {
    expect(
      areAllTasksDone([
        { id: "poster", name: "Poster", status: "completed" },
        { id: "fanart", name: "Fanart", status: "failed" },
      ] as any),
    ).toBe(true)

    expect(
      areAllTasksDone([
        { id: "poster", name: "Poster", status: "completed" },
        { id: "fanart", name: "Fanart", status: "running" },
      ] as any),
    ).toBe(false)
  })
})

describe("ScrapeDialogV2 completion checks", () => {
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
})


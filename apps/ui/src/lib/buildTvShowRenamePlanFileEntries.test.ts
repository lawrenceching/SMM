import { describe, it, expect, vi } from "vitest"
import { buildTvShowRenamePlanFileEntries } from "./buildTvShowRenamePlanFileEntries"
import type { MediaMetadata } from "@core/types"

vi.mock("@/lib/renameRules", () => ({
  generateNewFileName: vi.fn((_rule: string, ctx: { seasonNumber: number; episodeNumber: number }) => {
    return `Season ${String(ctx.seasonNumber).padStart(2, "0")}/Show - S${String(ctx.seasonNumber).padStart(2, "0")}E${String(ctx.episodeNumber).padStart(2, "0")}.mkv`
  }),
}))

function makeMediaMetadata(
  mediaFiles: Array<{ seasonNumber: number; episodeNumber: number; absolutePath: string }>,
): MediaMetadata {
  return {
    mediaFolderPath: "/media/show",
    mediaFiles,
    tvShow: {
      id: 1,
      name: "Show",
      airDate: "2020",
      seasons: [
        {
          season: 1,
          name: "Season 1",
          episodes: [
            { season: 1, episode: 1, name: "Pilot" },
            { season: 1, episode: 2, name: "Ep 2" },
          ],
        },
      ],
    },
  } as MediaMetadata
}

describe("buildTvShowRenamePlanFileEntries", () => {
  it("includes only episodes whose generated path differs from current path", () => {
    const mm = makeMediaMetadata([
      {
        seasonNumber: 1,
        episodeNumber: 1,
        absolutePath: "/media/show/Season 01/S01E01.mkv",
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        absolutePath: "/media/show/Season 01/Show - S01E02.mkv",
      },
    ])

    const entries = buildTvShowRenamePlanFileEntries(mm, "plex")

    expect(entries).toHaveLength(1)
    expect(entries[0]?.from).toBe("/media/show/Season 01/S01E01.mkv")
    expect(entries[0]?.to).toBe("/media/show/Season 01/Show - S01E01.mkv")
  })

  it("returns empty array when all generated paths match current paths", () => {
    const mm = makeMediaMetadata([
      {
        seasonNumber: 1,
        episodeNumber: 1,
        absolutePath: "/media/show/Season 01/Show - S01E01.mkv",
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        absolutePath: "/media/show/Season 01/Show - S01E02.mkv",
      },
    ])

    const entries = buildTvShowRenamePlanFileEntries(mm, "plex")

    expect(entries).toEqual([])
  })
})

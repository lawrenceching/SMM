import { describe, it, expect } from "vitest"
import { transcribeDialogRowsFromMediaFiles } from "./transcribeDialogRows"
import type { MediaMetadata } from "@core/types"

describe("transcribeDialogRowsFromMediaFiles", () => {
  it("returns empty array when no metadata or no mediaFiles", () => {
    expect(transcribeDialogRowsFromMediaFiles(undefined)).toEqual([])
    expect(
      transcribeDialogRowsFromMediaFiles({
        type: "tvshow-folder",
        mediaFolderPath: "/show",
      } as MediaMetadata),
    ).toEqual([])
  })

  it("maps TV episode files with titles and display paths", () => {
    const md = {
      type: "tvshow-folder",
      mediaFolderPath: "/library/show",
      tvShow: {
        database: "TMDB",
        id: "1",
        name: "Test Show",
        seasons: [
          {
            season: 1,
            episodes: [{ episode: 2, name: "Pilot" }],
          },
        ],
      },
      mediaFiles: [
        {
          absolutePath: "/library/show/S01/E02.mkv",
          seasonNumber: 1,
          episodeNumber: 2,
        },
      ],
    } as MediaMetadata

    const rows = transcribeDialogRowsFromMediaFiles(md)
    expect(rows).toHaveLength(1)
    expect(rows[0].path).toBe("/library/show/S01/E02.mkv")
    expect(rows[0].displayPath).toBe("S01/E02.mkv")
    expect(rows[0].title).toContain("S01E02")
    expect(rows[0].title).toContain("Pilot")
    expect(rows[0].status).toBe("pending")
  })

  it("maps movie file using movie name", () => {
    const md = {
      type: "movie-folder",
      mediaFolderPath: "/library/movie",
      movie: { database: "TMDB", id: "9", name: "Example Movie" },
      mediaFiles: [{ absolutePath: "/library/movie/video.mkv" }],
    } as MediaMetadata

    const rows = transcribeDialogRowsFromMediaFiles(md)
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe("Example Movie")
    expect(rows[0].path).toBe("/library/movie/video.mkv")
  })
})

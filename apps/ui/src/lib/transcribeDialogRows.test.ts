import { describe, it, expect } from "vitest"
import {
  transcribeDialogRowsFromMediaFiles,
  transcribeDialogRowsFromMusicFileRows,
  absolutePosixMusicFilePath,
} from "./transcribeDialogRows"
import type { MediaMetadata } from "@core/types"
import type { LocalFileTableRowData } from "@/components/MusicFileTable"

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

describe("absolutePosixMusicFilePath", () => {
  it("returns undefined when path is missing", () => {
    expect(absolutePosixMusicFilePath({ path: undefined }, "/lib")).toBeUndefined()
  })

  it("normalizes absolute posix path", () => {
    expect(absolutePosixMusicFilePath({ path: "/music/a.mp3" })).toBe("/music/a.mp3")
  })

  it("joins relative path with media folder", () => {
    expect(absolutePosixMusicFilePath({ path: "sub/a.mp3" }, "/library/music")).toBe(
      "/library/music/sub/a.mp3",
    )
  })

  it("returns undefined for relative path without folder", () => {
    expect(absolutePosixMusicFilePath({ path: "sub/a.mp3" })).toBeUndefined()
  })
})

describe("transcribeDialogRowsFromMusicFileRows", () => {
  const baseRow = (overrides: Partial<LocalFileTableRowData>): LocalFileTableRowData => ({
    kind: "local",
    id: 1,
    index: 0,
    title: "T",
    artist: "A",
    duration: 60,
    path: "/z/default.mp3",
    ...overrides,
  })

  it("skips rows without resolvable path", () => {
    const rows = [
      baseRow({ id: 1, path: "" }),
      baseRow({ id: 2, path: "/z/b.mp3", title: "B" }),
    ]
    const out = transcribeDialogRowsFromMusicFileRows(rows)
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe("/z/b.mp3")
    expect(out[0].id).toBe("/z/b.mp3")
  })

  it("uses stable id equal to posix path", () => {
    const rows = [baseRow({ id: 9, path: "/album/track.flac", title: "Song" })]
    const out = transcribeDialogRowsFromMusicFileRows(rows, "/album")
    expect(out[0].id).toBe(out[0].path)
  })

  it("sets displayPath relative to folder when possible", () => {
    const rows = [baseRow({ path: "/lib/music/sub/x.mp3", title: "X" })]
    const out = transcribeDialogRowsFromMusicFileRows(rows, "/lib/music")
    expect(out[0].displayPath).toBe("sub/x.mp3")
  })
})

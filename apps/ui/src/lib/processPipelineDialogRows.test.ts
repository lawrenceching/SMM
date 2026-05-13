import { describe, expect, it } from "vitest"
import type { MediaMetadata } from "@core/types"
import { processPipelineDialogRowsFromMediaFiles, processPipelineDialogRowsFromMusicFileRows } from "./processPipelineDialogRows"
import type { MusicFileRow } from "@/components/MusicFileTable"

describe("processPipelineDialogRowsFromMediaFiles", () => {
  it("returns empty when metadata is undefined", () => {
    expect(processPipelineDialogRowsFromMediaFiles(undefined)).toEqual([])
  })

  it("maps media files to stable ids (POSIX absolute path)", () => {
    const meta = {
      mediaFolderPath: "/show",
      mediaFiles: [{ absolutePath: "/show/ep1.mkv" }],
    } as unknown as MediaMetadata
    const rows = processPipelineDialogRowsFromMediaFiles(meta)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe("/show/ep1.mkv")
    expect(rows[0].mediaPath).toBe("/show/ep1.mkv")
    expect(rows[0].eligible).toBe(true)
  })
})

describe("processPipelineDialogRowsFromMusicFileRows", () => {
  it("skips rows without a resolvable path", () => {
    const rows: MusicFileRow[] = [
      { id: 1, index: 0, title: "A", artist: "", duration: 0, path: undefined },
    ]
    expect(processPipelineDialogRowsFromMusicFileRows(rows, "/music")).toEqual([])
  })

  it("uses POSIX absolute path as id", () => {
    const rows: MusicFileRow[] = [
      { id: 1, index: 0, title: "A", artist: "", duration: 0, path: "song.mkv" },
    ]
    const out = processPipelineDialogRowsFromMusicFileRows(rows, "/music")
    expect(out).toHaveLength(1)
    expect(out[0].id).toContain("song.mkv")
    expect(out[0].eligible).toBe(true)
  })
})

import { describe, it, expect } from "vitest"
import {
  isPosixPathVideoForSynthesize,
  synthesizeSubtitleDialogRowsFromMediaFiles,
  synthesizeSubtitleDialogRowsFromMusicFileRows,
} from "./synthesizeSubtitleDialogRows"
import type { LocalFileTableRowData } from "@/components/MusicFileTable"

describe("isPosixPathVideoForSynthesize", () => {
  it("returns true for common video extensions", () => {
    expect(isPosixPathVideoForSynthesize("/m/a.mp4")).toBe(true)
    expect(isPosixPathVideoForSynthesize("/m/a.MKV")).toBe(true)
  })
  it("returns false for audio", () => {
    expect(isPosixPathVideoForSynthesize("/m/a.mp3")).toBe(false)
  })
})

describe("synthesizeSubtitleDialogRowsFromMusicFileRows", () => {
  const baseRow = (over: Partial<LocalFileTableRowData>): LocalFileTableRowData => ({
    kind: "local",
    id: 1,
    index: 0,
    title: "t",
    artist: "a",
    duration: 1,
    path: "/folder/v.mp4",
    ...over,
  })

  it("marks audio-only track ineligible with notVideoFile", () => {
    const rows = synthesizeSubtitleDialogRowsFromMusicFileRows(
      [baseRow({ path: "/folder/song.mp3" })],
      "/folder",
      ["/folder/song.mp3", "/folder/song.srt"],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.eligible).toBe(false)
    expect(rows[0]!.disabledReason).toBe("synthesizeSubtitleDialog.notVideoFile")
  })

  it("creates eligible row when video and sibling subtitle exist in folder", () => {
    const rows = synthesizeSubtitleDialogRowsFromMusicFileRows(
      [baseRow({ path: "/folder/v.mp4" })],
      "/folder",
      ["/folder/v.mp4", "/folder/v.srt"],
    )
    expect(rows.some((r) => r.eligible && r.subtitlePath.endsWith(".srt"))).toBe(true)
  })

  it("uses stable id for video+subtitle pair", () => {
    const rows = synthesizeSubtitleDialogRowsFromMusicFileRows(
      [baseRow({ path: "/folder/v.mp4" })],
      "/folder",
      ["/folder/v.mp4", "/folder/v.srt"],
    )
    const eligible = rows.find((r) => r.eligible)
    expect(eligible?.id).toBe("/folder/v.mp4\n/folder/v.srt")
  })
})

describe("synthesizeSubtitleDialogRowsFromMediaFiles", () => {
  it("uses stable id matching video and subtitle paths", () => {
    const rows = synthesizeSubtitleDialogRowsFromMediaFiles({
      status: "ok",
      mediaFolderPath: "/m",
      mediaFiles: [
        {
          absolutePath: "/m/ep1.mp4",
          subtitleFilePaths: ["/m/ep1.zh.srt"],
        },
      ],
    } as any)
    const eligible = rows.filter((r) => r.eligible)
    expect(eligible).toHaveLength(1)
    expect(eligible[0]!.id).toBe("/m/ep1.mp4\n/m/ep1.zh.srt")
  })
})

import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook, cleanup } from "@testing-library/react"
import type { MediaMetadata } from "@smm/types"
import { UI_AskForFormatConverter } from "@/types/eventTypes"
import { useTvShowEpisodeFormatConvert } from "./useTvShowEpisodeFormatConvert"

interface MediaFileFixture {
  seasonNumber: number
  episodeNumber: number
  absolutePath: string
}

function makeMetadata(mediaFiles: MediaFileFixture[]): MediaMetadata {
  return { mediaFiles } as unknown as MediaMetadata
}

describe("useTvShowEpisodeFormatConvert", () => {
  afterEach(() => {
    cleanup()
  })

  it("dispatches UI_AskForFormatConverter with the episode's video file", () => {
    const listener = vi.fn()
    document.addEventListener(UI_AskForFormatConverter, listener)
    try {
      const mm = makeMetadata([
        { seasonNumber: 1, episodeNumber: 1, absolutePath: "/media/show/S01E01.mkv" },
      ])
      const { result } = renderHook(() => useTvShowEpisodeFormatConvert(mm))

      result.current.handleFormatConvertForRow({ season: 1, episode: 1 })

      expect(listener).toHaveBeenCalledTimes(1)
      const event = listener.mock.calls[0]?.[0] as CustomEvent<{ filePath?: string }>
      expect(event.type).toBe(UI_AskForFormatConverter)
      expect(event.detail.filePath).toBe("/media/show/S01E01.mkv")
    } finally {
      document.removeEventListener(UI_AskForFormatConverter, listener)
    }
  })

  it("warns and dispatches nothing when no video file matches the episode", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const listener = vi.fn()
    document.addEventListener(UI_AskForFormatConverter, listener)
    try {
      const mm = makeMetadata([
        { seasonNumber: 1, episodeNumber: 1, absolutePath: "/media/show/S01E01.mkv" },
      ])
      const { result } = renderHook(() => useTvShowEpisodeFormatConvert(mm))

      result.current.handleFormatConvertForRow({ season: 4, episode: 8 })

      expect(listener).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("S4E8"))
    } finally {
      document.removeEventListener(UI_AskForFormatConverter, listener)
      warn.mockRestore()
    }
  })
})

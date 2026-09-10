import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook, cleanup } from "@testing-library/react"
import type { MediaMetadata } from "@smm/types"
import { UI_AskForVideoCompression } from "@/types/eventTypes"
import { useTvShowEpisodeVideoCompress } from "./useTvShowEpisodeVideoCompress"

interface MediaFileFixture {
  seasonNumber: number
  episodeNumber: number
  absolutePath: string
}

function makeMetadata(mediaFiles: MediaFileFixture[]): MediaMetadata {
  return { mediaFiles } as unknown as MediaMetadata
}

describe("useTvShowEpisodeVideoCompress", () => {
  afterEach(() => {
    cleanup()
  })

  it("dispatches UI_AskForVideoCompression with the episode's video file and title", () => {
    const listener = vi.fn()
    document.addEventListener(UI_AskForVideoCompression, listener)
    try {
      const mm = makeMetadata([
        { seasonNumber: 1, episodeNumber: 2, absolutePath: "/media/show/S01E02.mkv" },
      ])
      const { result } = renderHook(() => useTvShowEpisodeVideoCompress(mm))

      result.current.handleVideoCompressForRow({ season: 1, episode: 2, episodeTitle: "Pilot" })

      expect(listener).toHaveBeenCalledTimes(1)
      const event = listener.mock.calls[0]?.[0] as CustomEvent<{
        filePath?: string
        title?: string
      }>
      expect(event.type).toBe(UI_AskForVideoCompression)
      expect(event.detail.filePath).toBe("/media/show/S01E02.mkv")
      expect(event.detail.title).toBe("Pilot")
    } finally {
      document.removeEventListener(UI_AskForVideoCompression, listener)
    }
  })

  it("falls back to an SxxExx title when episodeTitle is missing", () => {
    const listener = vi.fn()
    document.addEventListener(UI_AskForVideoCompression, listener)
    try {
      const mm = makeMetadata([
        { seasonNumber: 2, episodeNumber: 3, absolutePath: "/media/show/S02E03.mkv" },
      ])
      const { result } = renderHook(() => useTvShowEpisodeVideoCompress(mm))

      result.current.handleVideoCompressForRow({ season: 2, episode: 3 })

      const event = listener.mock.calls[0]?.[0] as CustomEvent<{ title?: string }>
      expect(event.detail.title).toBe("S2E3")
    } finally {
      document.removeEventListener(UI_AskForVideoCompression, listener)
    }
  })

  it("warns and dispatches nothing when no video file matches the episode", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const listener = vi.fn()
    document.addEventListener(UI_AskForVideoCompression, listener)
    try {
      const mm = makeMetadata([
        { seasonNumber: 1, episodeNumber: 1, absolutePath: "/media/show/S01E01.mkv" },
      ])
      const { result } = renderHook(() => useTvShowEpisodeVideoCompress(mm))

      result.current.handleVideoCompressForRow({ season: 5, episode: 99 })

      expect(listener).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("S5E99"),
      )
    } finally {
      document.removeEventListener(UI_AskForVideoCompression, listener)
      warn.mockRestore()
    }
  })
})

import { describe, it, expect } from "vitest"
import { Path } from "@core/path"
import { buildTranscribeJob } from "./transcribeJobFactory"

const MEDIA_FOLDER_PLATFORM = "C:\\path\\to\\music"
const NESTED_FILE_POSIX = "/path/to/music/a/b/c/d/test.mp4"

describe("buildTranscribeJob", () => {
  it("creates a pending videoCaptioner job with platform paths", () => {
    const job = buildTranscribeJob({
      folder: "D:\\lib",
      mediaPath: "/media/x/song.mp3",
      title: "Song",
      provider: "videoCaptioner",
    })
    expect(job.type).toBe("transcribe")
    expect(job.status).toBe("pending")
    expect(job.progress).toBe(0)
    expect(job.data.folder).toBe("D:\\lib")
    expect(job.data.title).toBe("Song")
    expect(job.data.provider).toBe("videoCaptioner")
    expect(job.data.mediaPath).toMatch(/song\.mp3/)
    expect(job.data.mediaPathPlatform.length).toBeGreaterThan(0)
    expect(job.data.tencentAsr).toBeUndefined()
    expect(job.data.videoCaptioner).toBeUndefined()
  })

  it("includes tencentAsr payload when provider is tencentAsr", () => {
    const job = buildTranscribeJob({
      folder: "/mnt/media",
      mediaPath: "/mnt/media/a.flac",
      title: "A",
      provider: "tencentAsr",
      tencentAsr: { baseUrl: "https://asr.example", apiKey: "k" },
    })
    expect(job.data.provider).toBe("tencentAsr")
    expect(job.data.tencentAsr).toEqual({ baseUrl: "https://asr.example", apiKey: "k" })
  })

  it("includes optional videoCaptioner options", () => {
    const job = buildTranscribeJob({
      folder: "C:\\m",
      mediaPath: "/m/v.mkv",
      title: "V",
      provider: "videoCaptioner",
      videoCaptioner: {
        asr: "jianying",
        language: "zh",
        wordTimestamps: true,
        format: "ass",
      },
    })
    expect(job.data.videoCaptioner).toEqual({
      asr: "jianying",
      language: "zh",
      wordTimestamps: true,
      format: "ass",
    })
  })

  it("preserves deeply nested posix mediaPath and platform path for executeCmd", () => {
    const job = buildTranscribeJob({
      folder: MEDIA_FOLDER_PLATFORM,
      mediaPath: NESTED_FILE_POSIX,
      title: "test",
      provider: "videoCaptioner",
    })
    expect(job.data.mediaPath).toBe(NESTED_FILE_POSIX)
    expect(job.data.mediaPathPlatform).toBe(Path.toPlatformPath(NESTED_FILE_POSIX))
    expect(job.data.mediaPathPlatform).toContain("a")
    expect(job.data.mediaPathPlatform).toContain("test.mp4")
    expect(job.data.mediaPathPlatform).not.toBe("test.mp4")
  })
})

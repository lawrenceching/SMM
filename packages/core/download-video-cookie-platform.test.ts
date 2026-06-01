import { describe, it, expect } from "vitest"
import {
  getDownloadVideoCookiePlatformDisplayName,
  isYoutubeDownloadUrl,
} from "./download-video-cookie-platform"

describe("getDownloadVideoCookiePlatformDisplayName", () => {
  it("returns empty string for empty or invalid URL", () => {
    expect(getDownloadVideoCookiePlatformDisplayName("")).toBe("")
    expect(getDownloadVideoCookiePlatformDisplayName("   ")).toBe("")
    expect(getDownloadVideoCookiePlatformDisplayName("not-a-url")).toBe("")
  })

  it("returns Youtube for YouTube hosts", () => {
    expect(
      getDownloadVideoCookiePlatformDisplayName("https://www.youtube.com/watch?v=abc"),
    ).toBe("Youtube")
    expect(getDownloadVideoCookiePlatformDisplayName("https://youtu.be/abc")).toBe("Youtube")
    expect(
      getDownloadVideoCookiePlatformDisplayName("https://music.youtube.com/watch?v=abc"),
    ).toBe("Youtube")
  })

  it("returns Bilibili for Bilibili hosts", () => {
    expect(
      getDownloadVideoCookiePlatformDisplayName("https://www.bilibili.com/video/BV1xx"),
    ).toBe("Bilibili")
    expect(getDownloadVideoCookiePlatformDisplayName("https://b23.tv/abc")).toBe("Bilibili")
    expect(
      getDownloadVideoCookiePlatformDisplayName("https://space.bilibili.com/123/lists/456"),
    ).toBe("Bilibili")
  })

  it("returns empty string for unsupported hosts", () => {
    expect(getDownloadVideoCookiePlatformDisplayName("https://vimeo.com/123")).toBe("")
  })
})

describe("isYoutubeDownloadUrl", () => {
  it("is true for YouTube URLs", () => {
    expect(isYoutubeDownloadUrl("https://www.youtube.com/watch?v=abc")).toBe(true)
    expect(isYoutubeDownloadUrl("https://youtu.be/abc")).toBe(true)
  })

  it("is false for other URLs", () => {
    expect(isYoutubeDownloadUrl("https://www.bilibili.com/video/BV1")).toBe(false)
    expect(isYoutubeDownloadUrl("")).toBe(false)
  })
})

import { describe, expect, it } from "vitest"
import { is1080pAvailable, parseYtdlpListFormatsStdout } from "./parseYtdlpListFormats"

/** Trimmed content from docs/ytdlp/list-formats-example.txt */
const EXAMPLE_STDOUT = `[BiliBili] Extracting URL: https://www.bilibili.com/video/BV174421S7tZ
[BiliBili] 174421S7tZ: Downloading webpage
[BiliBili] BV174421S7tZ: Extracting videos in anthology
[BiliBili] BV174421S7tZ: Downloading wbi sign
[BiliBili] BV174421S7tZ: Downloading video formats for cid 1639913629
[BiliBili] Format(s) 1080P 高码率, 1080P 高清, 720P 准高清 are missing; you have to become a premium member to download them.
[BiliBili] 1756357537: Extracting chapters
[info] Available formats for BV174421S7tZ:
ID     EXT RESOLUTION FPS │ FILESIZE  TBR PROTO │ VCODEC         VBR ACODEC      ABR
────────────────────────────────────────────────────────────────────────────────────
30216  m4a audio only     │ ≈1.59MiB  55k https │ audio only         mp4a.40.5   55k
30232  m4a audio only     │ ≈3.46MiB 121k https │ audio only         mp4a.40.2  121k
30280  m4a audio only     │ ≈6.18MiB 215k https │ audio only         mp4a.40.2  215k
100046 mp4 640x360     30 │ ≈6.00MiB 209k https │ avc1.64001E   209k video only
100109 mp4 640x360     30 │ ≈3.86MiB 135k https │ hev1.1.6.L120 135k video only
100022 mp4 640x360     30 │ ≈3.92MiB 137k https │ av01.0.00M.10 137k video only
100047 mp4 852x480     30 │ ≈9.71MiB 339k https │ avc1.64001F   339k video only
100110 mp4 852x480     30 │ ≈5.31MiB 185k https │ hev1.1.6.L120 185k video only
100023 mp4 852x480     30 │ ≈5.38MiB 188k https │ av01.0.00M.10 188k video only
`

const EXAMPLE_WITH_1080_STDOUT = `[info] Available formats for TEST:
ID  EXT RESOLUTION FPS │ FILESIZE  TBR PROTO │ VCODEC    VBR ACODEC  ABR
────────────────────────────────────────────────────────
137 mp4 1920x1080  30  │ ≈50MiB  3000k https │ avc1.640028 3000k video only
299 mp4 1280x720   30  │ ≈30MiB  2000k https │ avc1.64001F 2000k video only
140 m4a audio only     │ ≈5MiB    128k https │ audio only       mp4a.40.2 128k
`

describe("parseYtdlpListFormatsStdout", () => {
  it("parses example file: returns 360 and 480 heights, no 1080", () => {
    const result = parseYtdlpListFormatsStdout(EXAMPLE_STDOUT)
    expect(result.availableHeights).toContain(360)
    expect(result.availableHeights).toContain(480)
    expect(result.availableHeights).not.toContain(1080)
    expect(result.hasAudioOnly).toBe(true)
  })

  it("parses sample with 1080p line: returns 720 and 1080 heights", () => {
    const result = parseYtdlpListFormatsStdout(EXAMPLE_WITH_1080_STDOUT)
    expect(result.availableHeights).toContain(720)
    expect(result.availableHeights).toContain(1080)
    expect(result.hasAudioOnly).toBe(true)
  })

  it("audio only rows do not contribute a height", () => {
    const result = parseYtdlpListFormatsStdout(EXAMPLE_STDOUT)
    // audio-only rows have no WxH — heights should only be 360 and 480
    expect(result.availableHeights).toEqual([360, 480])
  })

  it("returns empty result for empty stdout", () => {
    const result = parseYtdlpListFormatsStdout("")
    expect(result.availableHeights).toEqual([])
    expect(result.hasAudioOnly).toBe(false)
  })

  it("returns empty result when no Available formats section found", () => {
    const result = parseYtdlpListFormatsStdout("[BiliBili] Some error occurred\n")
    expect(result.availableHeights).toEqual([])
  })

  it("deduplicates heights from multiple rows at the same resolution", () => {
    const result = parseYtdlpListFormatsStdout(EXAMPLE_STDOUT)
    const count360 = result.availableHeights.filter((h) => h === 360).length
    expect(count360).toBe(1)
  })

  it("returns heights in ascending order", () => {
    const result = parseYtdlpListFormatsStdout(EXAMPLE_STDOUT)
    for (let i = 1; i < result.availableHeights.length; i++) {
      expect(result.availableHeights[i]).toBeGreaterThan(result.availableHeights[i - 1]!)
    }
  })
})

describe("is1080pAvailable", () => {
  it("returns false when 1080 not in list", () => {
    expect(is1080pAvailable({ availableHeights: [360, 480], hasAudioOnly: true })).toBe(false)
  })

  it("returns true when 1080 is in list", () => {
    expect(is1080pAvailable({ availableHeights: [720, 1080], hasAudioOnly: false })).toBe(true)
  })

  it("returns false for empty list", () => {
    expect(is1080pAvailable({ availableHeights: [], hasAudioOnly: false })).toBe(false)
  })
})

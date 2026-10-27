import { describe, expect, it } from "vitest"
import { filterAssociatedFiles } from "./useGetAssociatedFiles"

describe("filterAssociatedFiles", () => {
  const folder = "/media/music"
  const stem =
    "China vs America： The Reality Is Nothing Like The Headlines [KaxRB_vgkBw]"
  const video = `${folder}/${stem}.mp4`

  it("matches exact-stem and dot language-tagged subtitles", () => {
    const files = [
      video,
      `${folder}/${stem}.srt`,
      `${folder}/${stem}.en.srt`,
    ]
    const subs = filterAssociatedFiles(files, video).filter((f) => f.type === "subtitle")
    expect(subs.map((f) => f.path)).toEqual([
      `${folder}/${stem}.srt`,
      `${folder}/${stem}.en.srt`,
    ])
  })

  it("matches underscore language-tagged subtitles (yt-dlp style)", () => {
    const files = [
      video,
      `${folder}/${stem}.srt`,
      `${folder}/${stem}_zh-Hans.srt`,
    ]
    const subs = filterAssociatedFiles(files, video).filter((f) => f.type === "subtitle")
    expect(subs.map((f) => f.path)).toEqual([
      `${folder}/${stem}.srt`,
      `${folder}/${stem}_zh-Hans.srt`,
    ])
  })

  it("classifies _summary.txt as summary, not subtitle", () => {
    const summary = `${folder}/${stem}_summary.txt`
    const files = [video, summary, `${folder}/${stem}.srt`]
    const associated = filterAssociatedFiles(files, video)

    expect(associated.filter((f) => f.type === "subtitle").map((f) => f.path)).toEqual([
      `${folder}/${stem}.srt`,
    ])
    expect(associated.filter((f) => f.type === "summary").map((f) => f.path)).toEqual([
      summary,
    ])
  })
})

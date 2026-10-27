import { describe, expect, it } from "vitest"
import { featureToggles } from "./featureToggles.ts"

describe("featureToggles", () => {
  it("turns yt-dlp and VideoCaptioner off", () => {
    expect(featureToggles()).toEqual({
      ytdlp: false,
      videocaptioner: false,
    })
  })
})

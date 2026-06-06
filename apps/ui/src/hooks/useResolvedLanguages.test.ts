import { describe, it, expect } from "vitest"
import { getResolvedLanguages } from "./useResolvedLanguages"

describe("getResolvedLanguages", () => {
  it("uses explicit applicationLanguage for app and media language", () => {
    const result = getResolvedLanguages(
      { applicationLanguage: "zh-CN" },
      { browserLocale: "en-US", osLocale: "en-US" },
    )
    expect(result.appLanguage).toBe("zh-CN")
    expect(result.mediaLanguage).toBe("zh-CN")
  })

  it("falls back to browser locale when applicationLanguage is unset", () => {
    const result = getResolvedLanguages(
      {},
      { browserLocale: "en-GB", osLocale: "zh-CN" },
    )
    expect(result.appLanguage).toBe("en")
    expect(result.mediaLanguage).toBe("en-US")
  })

  it("prefers explicit preferMediaLanguage", () => {
    const result = getResolvedLanguages(
      { applicationLanguage: "en", preferMediaLanguage: "ja-JP" },
      { browserLocale: "en-US" },
    )
    expect(result.mediaLanguage).toBe("ja-JP")
  })
})

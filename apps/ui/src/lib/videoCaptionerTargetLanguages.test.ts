import { describe, it, expect } from "vitest"
import {
  formatVideoCaptionerTargetLanguage,
  normalizeVideoCaptionerTargetLanguage,
} from "./videoCaptionerTargetLanguages"

describe("normalizeVideoCaptionerTargetLanguage", () => {
  it("keeps supported codes", () => {
    expect(normalizeVideoCaptionerTargetLanguage("zh-Hant")).toBe("zh-Hant")
    expect(normalizeVideoCaptionerTargetLanguage("es-419")).toBe("es-419")
  })

  it("matches supported codes case-insensitively", () => {
    expect(normalizeVideoCaptionerTargetLanguage(" pt-br ")).toBe("pt-BR")
  })

  it("maps common aliases to supported codes", () => {
    expect(normalizeVideoCaptionerTargetLanguage("zh-CN")).toBe("zh-Hans")
    expect(normalizeVideoCaptionerTargetLanguage("zh-TW")).toBe("zh-Hant")
    expect(normalizeVideoCaptionerTargetLanguage("zh-HK")).toBe("zh-Hant")
  })

  it("falls back to zh-Hans for empty or unknown codes", () => {
    expect(normalizeVideoCaptionerTargetLanguage(undefined)).toBe("zh-Hans")
    expect(normalizeVideoCaptionerTargetLanguage("")).toBe("zh-Hans")
    expect(normalizeVideoCaptionerTargetLanguage("xx-YY")).toBe("zh-Hans")
  })
})

describe("formatVideoCaptionerTargetLanguage", () => {
  it("appends the code to the localized language name", () => {
    expect(formatVideoCaptionerTargetLanguage("ja", "en")).toBe("Japanese (ja)")
  })
})

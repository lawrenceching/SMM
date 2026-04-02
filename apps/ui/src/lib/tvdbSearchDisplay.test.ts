import { describe, it, expect } from "vitest"
import {
  getTvdbSearchResultName,
  getTvdbSearchResultOverview,
  tvdbTranslationCodesForMediaLanguage,
  tvdbTranslationCodesForUiLanguage,
} from "./tvdbSearchDisplay"

describe("tvdbSearchDisplay", () => {
  it("maps UI languages to TVDB code preference lists", () => {
    expect(tvdbTranslationCodesForUiLanguage("en")).toEqual(["eng"])
    expect(tvdbTranslationCodesForUiLanguage("zh-CN")[0]).toBe("zho")
    expect(tvdbTranslationCodesForUiLanguage("zh-HK")[0]).toBe("yue")
  })

  it("maps media search languages to TVDB code preference lists", () => {
    expect(tvdbTranslationCodesForMediaLanguage("en-US")).toEqual(["eng"])
    expect(tvdbTranslationCodesForMediaLanguage("zh-CN")[0]).toBe("zho")
    expect(tvdbTranslationCodesForMediaLanguage("ja-JP")[0]).toBe("jpn")
  })

  it("picks name from translations map by language order", () => {
    const item = {
      translations: { eng: "English Title", zho: "中文名" },
      name: "Fallback",
    }
    expect(getTvdbSearchResultName(item, ["zho", "eng"], "tv")).toBe("中文名")
    expect(getTvdbSearchResultName(item, ["eng", "zho"], "tv")).toBe("English Title")
  })

  it("parses JSON name_translated and picks by code", () => {
    const item = {
      name_translated: '{"eng":"Oshi no Ko","jpn":"推しの子"}',
      name: "推しの子",
    }
    expect(getTvdbSearchResultName(item, ["eng"], "tv")).toBe("Oshi no Ko")
    expect(getTvdbSearchResultName(item, ["jpn"], "tv")).toBe("推しの子")
  })

  it("picks overview from overviews map", () => {
    const item = {
      overviews: { eng: "English overview", zho: "中文简介" },
      overview: "Default",
    }
    expect(getTvdbSearchResultOverview(item, ["zho", "eng"])).toBe("中文简介")
  })

  it("parses overview_translated prefixed lines", () => {
    const item = {
      overview_translated: ["eng: Hello", "zho: 你好"],
    }
    expect(getTvdbSearchResultOverview(item, ["zho", "eng"])).toBe("你好")
  })
})

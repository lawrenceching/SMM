import { describe, expect, it } from "vitest"
import {
  DEFAULT_TMDB_SEARCH_LANGUAGE,
  DEFAULT_TVDB_SEARCH_LANGUAGE,
  preferMediaLanguageToTvdbCode,
} from "./searchLanguage"

describe("preferMediaLanguageToTvdbCode", () => {
  it("maps zh-CN to zho", () => {
    expect(preferMediaLanguageToTvdbCode("zh-CN")).toBe("zho")
  })

  it("maps en-US to eng", () => {
    expect(preferMediaLanguageToTvdbCode("en-US")).toBe("eng")
  })

  it("maps ja-JP to jpn", () => {
    expect(preferMediaLanguageToTvdbCode("ja-JP")).toBe("jpn")
  })
})

describe("default search language constants", () => {
  it("TMDB default is en-US", () => {
    expect(DEFAULT_TMDB_SEARCH_LANGUAGE).toBe("en-US")
  })

  it("TVDB default is eng", () => {
    expect(DEFAULT_TVDB_SEARCH_LANGUAGE).toBe("eng")
  })
})

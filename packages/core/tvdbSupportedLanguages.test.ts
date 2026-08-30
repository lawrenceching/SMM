import { describe, expect, it } from "vitest";
import {
  isTvdbLanguageCode,
  parseTvdbSearchLanguage,
  TVDB_SUPPORTED_LANGUAGES,
} from "./tvdbSupportedLanguages";
import { resolveTvdbSearchLanguage } from "./locale";

describe("tvdbSupportedLanguages", () => {
  it("contains 185 codes including eng/zho/yue", () => {
    expect(TVDB_SUPPORTED_LANGUAGES).toHaveLength(185);
    for (const code of ["eng", "zho", "yue", "jpn", "fra"]) {
      expect(TVDB_SUPPORTED_LANGUAGES).toContain(code);
    }
  });

  it("isTvdbLanguageCode matches known codes and rejects unknown", () => {
    expect(isTvdbLanguageCode("zho")).toBe(true);
    expect(isTvdbLanguageCode("zh-CN")).toBe(false);
    expect(isTvdbLanguageCode("xx")).toBe(false);
  });

  it("parseTvdbSearchLanguage returns the canonical code", () => {
    expect(parseTvdbSearchLanguage("zho")).toBe("zho");
    expect(parseTvdbSearchLanguage(" ENG ")).toBe("eng");
  });

  it("parseTvdbSearchLanguage throws for unknown codes", () => {
    expect(() => parseTvdbSearchLanguage("zh-CN")).toThrow(/ISO 639-3/);
    expect(() => parseTvdbSearchLanguage("zzz")).toThrow(/ISO 639-3/);
  });
});

describe("resolveTvdbSearchLanguage", () => {
  it("maps preferMediaLanguage IETF to ISO 639-3", () => {
    expect(resolveTvdbSearchLanguage({ preferMediaLanguage: "zh-CN" })).toBe("zho");
    expect(resolveTvdbSearchLanguage({ preferMediaLanguage: "en-US" })).toBe("eng");
    expect(resolveTvdbSearchLanguage({ preferMediaLanguage: "ja-JP" })).toBe("jpn");
  });

  it("falls back to eng when nothing is configured", () => {
    expect(resolveTvdbSearchLanguage({})).toBe("eng");
  });
});

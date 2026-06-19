/**
 * Regression tests for the i18n catalog of the TvShowPanel "Link file"
 * (a.k.a. "Select File" context menu) flow.
 *
 * The orchestrator in apps/ui/src/components/TvShowPanel.tsx#handleEpisodeFileSelect
 * uses this i18n key for the directory-error toast:
 *   - tvShowEpisodeTable.linkFileDirectoryError
 *
 * If the key is missing from any locale, the i18n runtime falls back to the
 * key string itself, which would render an English/bracketed "toast" to
 * Chinese-speaking users. These tests ensure the key exists in all four
 * supported locales.
 */
import { describe, it, expect } from "vitest"
import en from "../../public/locales/en/components.json"
import zhCN from "../../public/locales/zh-CN/components.json"
import zhHK from "../../public/locales/zh-HK/components.json"
import zhTW from "../../public/locales/zh-TW/components.json"

interface TvShowEpisodeTable {
  linkFileDirectoryError: string
}

const locales: { readonly name: string; readonly data: { tvShowEpisodeTable: TvShowEpisodeTable } }[] =
  [
    { name: "en", data: en as unknown as { tvShowEpisodeTable: TvShowEpisodeTable } },
    { name: "zh-CN", data: zhCN as unknown as { tvShowEpisodeTable: TvShowEpisodeTable } },
    { name: "zh-HK", data: zhHK as unknown as { tvShowEpisodeTable: TvShowEpisodeTable } },
    { name: "zh-TW", data: zhTW as unknown as { tvShowEpisodeTable: TvShowEpisodeTable } },
  ]

describe("TvShowPanel locale catalog — Link file directory-error toast key", () => {
  for (const { name, data } of locales) {
    describe(`${name}`, () => {
      it("defines linkFileDirectoryError as a non-empty string", () => {
        expect(typeof data.tvShowEpisodeTable.linkFileDirectoryError).toBe("string")
        expect(data.tvShowEpisodeTable.linkFileDirectoryError.length).toBeGreaterThan(0)
      })
    })
  }
})

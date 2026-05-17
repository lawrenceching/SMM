import { describe, expect, it, vi } from "vitest"
import {
  buildYtdlpCookiesFilePath,
  normalizeYtdlpCookieText,
  writeYtdlpCookiesFile,
} from "./ytdlpCookiesFile"

vi.mock("@/api/writeFile", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

import { writeFile } from "@/api/writeFile"

describe("normalizeYtdlpCookieText", () => {
  it("converts CRLF and CR to LF", () => {
    expect(normalizeYtdlpCookieText("a\r\nb\rc")).toBe("a\nb\nc")
  })
})

describe("buildYtdlpCookiesFilePath", () => {
  it("places file under userData/temp with job id", () => {
    expect(buildYtdlpCookiesFilePath("/data/user", "job-123")).toBe(
      "/data/user/temp/ytdlp-cookies-job-123.txt",
    )
  })
})

describe("writeYtdlpCookiesFile", () => {
  it("writes normalized content via writeFile API", async () => {
    const path = await writeYtdlpCookiesFile("/data/user", "job-1", "line1\r\nline2")
    expect(path).toBe("/data/user/temp/ytdlp-cookies-job-1.txt")
    expect(writeFile).toHaveBeenCalledWith(path, "line1\nline2")
  })
})

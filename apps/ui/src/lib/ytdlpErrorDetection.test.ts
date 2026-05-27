import { afterEach, describe, expect, it, vi } from "vitest"
import {
  classifyYtdlpError,
  logYtdlpError,
  reportYtdlpError,
} from "./ytdlpErrorDetection"

describe("ytdlpErrorDetection", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("classifies cookie-expired errors", () => {
    const result = classifyYtdlpError(
      "ERROR: The provided YouTube account cookies are no longer valid",
    )
    expect(result.type).toBe("cookie-expired")
  })

  it("classifies format-unavailable errors", () => {
    const result = classifyYtdlpError("ERROR: Requested format is not available")
    expect(result.type).toBe("format-unavailable")
  })

  it("classifies connection-timeout errors", () => {
    const result = classifyYtdlpError(
      "yt-dlp command timed out\nWARNING: [youtube] (<HTTPSConnection(host='www.youtube.com', port=443) at 0x2145b8be3b0>, 'Connection to www.youtube.com timed out. (connect timeout=20.0)'). Retrying (1/3)...",
    )
    expect(result.type).toBe("connection-timeout")
  })

  it("returns unknown for unrecognized errors", () => {
    const result = classifyYtdlpError("some unexpected failure")
    expect(result.type).toBe("unknown")
  })

  it("logYtdlpError prints message and stack for Error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const err = new Error("probe failed")
    logYtdlpError("list-formats", err)
    expect(consoleError).toHaveBeenCalledWith("[yt-dlp] list-formats: probe failed")
    expect(consoleError).toHaveBeenCalledWith(err.stack)
  })

  it("reportYtdlpError logs unknown errors with cause", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const err = new Error("network timeout")
    reportYtdlpError("list-formats", err.message, err)
    expect(consoleError).toHaveBeenCalledWith("[yt-dlp] list-formats: network timeout")
    expect(consoleError).toHaveBeenCalledWith(err.stack)
  })

  it("reportYtdlpError does not log known errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    reportYtdlpError(
      "list-formats",
      "ERROR: The provided YouTube account cookies are no longer valid",
      new Error("cookie"),
    )
    expect(consoleError).not.toHaveBeenCalled()
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  classifyYtdlpError,
  getYtdlpErrorMessage,
  logYtdlpError,
  reportYtdlpError,
  YTDLP_ERROR_I18N_MAP,
} from "./ytdlpErrorDetection"
// Helper to build the input
function classify(
  stderr: string,
  stdout = "",
  exitCode: number | null = null,
) {
  return classifyYtdlpError({ stderr, stdout, exitCode })
}

describe("classifyYtdlpError", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Exit code based ──────────────────────────────────────────────

  it("exitCode 101 → download-cancelled", () => {
    const r = classify("", "", 101)
    expect(r.type).toBe("download-cancelled")
  })

  it("exitCode 2 → options-error", () => {
    const r = classify("", "", 2)
    expect(r.type).toBe("options-error")
  })

  // ── Cookie / Auth ────────────────────────────────────────────────

  it("cookie-expired", () => {
    const r = classify("ERROR: The provided YouTube account cookies are no longer valid")
    expect(r.type).toBe("cookie-expired")
  })

  it("bot-detection (after cookie)", () => {
    const r = classify("ERROR: [youtube] xyz: Sign in to confirm you're not a bot")
    expect(r.type).toBe("bot-detection")
  })

  it("age-restricted", () => {
    const r = classify("ERROR: This video is age-restricted and only available on YouTube.")
    expect(r.type).toBe("age-restricted")
  })

  it("confirm your age", () => {
    const r = classify("ERROR: Sign in to confirm your age")
    expect(r.type).toBe("age-restricted")
  })

  it("login-required (generic)", () => {
    const r = classify("ERROR: Sign in to confirm your access")
    expect(r.type).toBe("login-required")
  })

  // ── Format / URL ─────────────────────────────────────────────────

  it("format-unavailable", () => {
    const r = classify("ERROR: [youtube] xyz: Requested format is not available")
    expect(r.type).toBe("format-unavailable")
  })

  it("unsupported-url", () => {
    const r = classify("ERROR: Unsupported URL: https://mock.invalid/video")
    expect(r.type).toBe("unsupported-url")
  })

  // ── Video availability ───────────────────────────────────────────

  it("video-unavailable (private)", () => {
    const r = classify("ERROR: [youtube] xyz: Private video. Sign in if you've been granted access.")
    expect(r.type).toBe("video-unavailable")
  })

  it("video-unavailable (generic)", () => {
    const r = classify("ERROR: [youtube] xyz: Video unavailable")
    expect(r.type).toBe("video-unavailable")
  })

  it("video-unavailable (live ended)", () => {
    const r = classify("ERROR: [youtube] xyz: This live event has ended.")
    expect(r.type).toBe("video-unavailable")
  })

  // ── Geo restriction ──────────────────────────────────────────────

  it("geo-restricted", () => {
    const r = classify("ERROR: [youtube] xyz: Geo-restricted")
    expect(r.type).toBe("geo-restricted")
  })

  // ── HTTP status codes ────────────────────────────────────────────

  it("http-403", () => {
    const r = classify("ERROR: HTTP Error 403: Forbidden")
    expect(r.type).toBe("http-403")
  })

  it("http-404", () => {
    const r = classify("ERROR: HTTP Error 404: Not Found")
    expect(r.type).toBe("http-404")
  })

  it("http-410", () => {
    const r = classify("ERROR: HTTP Error 410: Gone")
    expect(r.type).toBe("http-410")
  })

  it("http-412", () => {
    const r = classify("ERROR: [BiliBili] xxx: HTTP Error 412: Precondition Failed")
    expect(r.type).toBe("http-412")
  })

  it("http-429", () => {
    const r = classify("ERROR: HTTP Error 429: Too Many Requests")
    expect(r.type).toBe("http-429")
  })

  it("http-5xx", () => {
    const r = classify("ERROR: HTTP Error 502: Bad Gateway")
    expect(r.type).toBe("http-5xx")
  })

  // ── Network / Timeout ────────────────────────────────────────────

  it("connection-timeout with hostname context", () => {
    const r = classify(
      "WARNING: [youtube] Connection to www.youtube.com timed out. (connect timeout=20.0)",
    )
    expect(r.type).toBe("connection-timeout")
    expect(r.context).toBe("www.youtube.com")
  })

  it("connection-timeout with different host", () => {
    const r = classify("Connection to api.bilibili.com timed out")
    expect(r.type).toBe("connection-timeout")
    expect(r.context).toBe("api.bilibili.com")
  })

  it("network-error (unable to download webpage)", () => {
    const r = classify("ERROR: [extractor] URL: Unable to download webpage")
    expect(r.type).toBe("network-error")
  })

  it("network-error (urlopen)", () => {
    const r = classify("urlopen error [Errno 111] Connection refused")
    expect(r.type).toBe("network-error")
  })

  it("network-error (SSL)", () => {
    const r = classify("SSL: CERTIFICATE_VERIFY_FAILED certificate verify failed")
    expect(r.type).toBe("network-error")
  })

  it("network-error (DNS)", () => {
    const r = classify("Temporary failure in name resolution")
    expect(r.type).toBe("network-error")
  })

  // ── FFmpeg ───────────────────────────────────────────────────────

  it("ffmpeg-missing", () => {
    const r = classify("ERROR: Post-processing: ffprobe and ffmpeg not found")
    expect(r.type).toBe("ffmpeg-missing")
  })

  it("mkvmerge missing", () => {
    const r = classify("ERROR: Post-processing: mkvmerge not found")
    expect(r.type).toBe("ffmpeg-missing")
  })

  // ── Post-processing ──────────────────────────────────────────────

  it("postprocessing-error", () => {
    const r = classify("ERROR: Post-processing: conversion failed")
    expect(r.type).toBe("postprocessing-error")
  })

  // ── Same file ────────────────────────────────────────────────────

  it("same-file-error", () => {
    const r = classify("ERROR: fixed file name already exists")
    expect(r.type).toBe("same-file-error")
  })

  // ── Keyboard interrupt ───────────────────────────────────────────

  it("keyboard-interrupt", () => {
    const r = classify("ERROR: Interrupted by user")
    expect(r.type).toBe("keyboard-interrupt")
  })

  // ── Content too short ────────────────────────────────────────────

  it("content-too-short", () => {
    const r = classify("ERROR: Incomplete data received")
    expect(r.type).toBe("content-too-short")
  })

  // ── Player request ───────────────────────────────────────────────

  it("player-request-failed", () => {
    const r = classify("ERROR: [youtube] xyz: Player request failed")
    expect(r.type).toBe("player-request-failed")
  })

  // ── Unknown ──────────────────────────────────────────────────────

  it("unknown for unrecognized errors", () => {
    const r = classify("some unexpected failure")
    expect(r.type).toBe("unknown")
  })
})

// ── getYtdlpErrorMessage ─────────────────────────────────────────────

describe("getYtdlpErrorMessage", () => {
  const mockT = ((key: string, opts?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      "downloadVideo.errors.cookieExpired": "Cookies expired or invalid. [i18n]",
      "downloadVideo.errors.connectionTimeout": "Connection to {{host}} timed out [i18n]",
      "downloadVideo.errors.unknown": "Unknown error. [i18n]",
    }
    const template = map[key]
    if (!template) return key
    // Simple interpolation
    if (opts && opts.host) {
      return template.replace("{{host}}", String(opts.host))
    }
    return template
  }) as (key: string, opts?: Record<string, unknown>) => string

  it("returns i18n message when t is provided", () => {
    const msg = getYtdlpErrorMessage(
      { type: "cookie-expired" },
      mockT,
    )
    expect(msg).toBe("Cookies expired or invalid. [i18n]")
  })

  it("returns fallback for connection-timeout with context", () => {
    const msg = getYtdlpErrorMessage(
      { type: "connection-timeout", context: "www.youtube.com" },
      mockT,
    )
    expect(msg).toBe("Connection to www.youtube.com timed out [i18n]")
  })

  it("returns fallback for unknown error without t", () => {
    const msg = getYtdlpErrorMessage({ type: "unknown" })
    expect(msg).toBe(YTDLP_ERROR_I18N_MAP["unknown"].fallback)
  })

  it("returns fallback for connection-timeout context without t", () => {
    const msg = getYtdlpErrorMessage({
      type: "connection-timeout",
      context: "example.com",
    })
    expect(msg).toBe("连接 example.com 超时")
  })
})

// ── logYtdlpError ───────────────────────────────────────────────────

describe("logYtdlpError", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("prints message and stack for Error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const err = new Error("probe failed")
    logYtdlpError("list-formats", err)
    expect(consoleError).toHaveBeenCalledWith("[yt-dlp] list-formats: probe failed")
    expect(consoleError).toHaveBeenCalledWith(err.stack)
  })

  it("prints fallback for non-Error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    logYtdlpError("download", "something went wrong")
    expect(consoleError).toHaveBeenCalledWith("[yt-dlp] download:", "something went wrong")
  })
})

// ── reportYtdlpError ────────────────────────────────────────────────

describe("reportYtdlpError", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("logs unknown errors (string input)", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const err = new Error("network timeout")
    reportYtdlpError("list-formats", "network timeout", err)
    expect(consoleError).toHaveBeenCalledWith("[yt-dlp] list-formats: network timeout")
    expect(consoleError).toHaveBeenCalledWith(err.stack)
  })

  it("logs unknown errors (object input)", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const err = new Error("something unexpected")
    reportYtdlpError("download", { stderr: "weird error", stdout: "", exitCode: 1 }, err)
    // When cause is an Error, logYtdlpError prints its message and stack
    expect(consoleError).toHaveBeenCalledWith("[yt-dlp] download: something unexpected")
  })

  it("does not log known errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    reportYtdlpError(
      "list-formats",
      "ERROR: The provided YouTube account cookies are no longer valid",
      new Error("cookie"),
    )
    expect(consoleError).not.toHaveBeenCalled()
  })
})

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

  // ── CLI / executeCmd boundary errors ──────────────────────────────
  // These cover the case where the CLI's own `/api/executeCmd` HTTP
  // endpoint (or the browser's fetch wrapper) reports a non-success.

  it("http-error (HTTP 500 from CLI, no body)", () => {
    const r = classify("HTTP 500: Internal Server Error")
    expect(r.type).toBe("http-error")
    expect(r.context).toBe("500")
  })

  it("http-error (HTTP 502, statusText-only fallback)", () => {
    const r = classify("HTTP 502")
    expect(r.type).toBe("http-error")
    expect(r.context).toBe("502")
  })

  it("http-error (HTTP 503)", () => {
    const r = classify("HTTP 503: Service Unavailable")
    expect(r.type).toBe("http-error")
    expect(r.context).toBe("503")
  })

  it("http-error (HTTP 504)", () => {
    const r = classify("HTTP 504: Gateway Timeout")
    expect(r.type).toBe("http-error")
    expect(r.context).toBe("504")
  })

  it("http-error (HTTP 400 with JSON body — test scenario)", () => {
    // The CLI fetch wrapper always prefixes the error with the status:
    // "HTTP 400: <body>". This must classify as http-error so the user
    // sees a meaningful message with the status code, not the generic
    // "Unknown error (...body)" fallback.
    const r = classify("HTTP 400: test")
    expect(r.type).toBe("http-error")
    expect(r.context).toBe("400")
  })

  it("http-error (HTTP 404 with JSON body — e.g. executable not found)", () => {
    const r = classify("HTTP 404: yt-dlp executable not found")
    expect(r.type).toBe("http-error")
    expect(r.context).toBe("404")
  })

  it("http-error (HTTP 401)", () => {
    const r = classify("HTTP 401: Unauthorized")
    expect(r.type).toBe("http-error")
    expect(r.context).toBe("401")
  })

  it("does NOT classify yt-dlp's 'HTTP Error 502' as http-error", () => {
    // yt-dlp's own "HTTP Error 5xx" form must keep mapping to http-5xx
    // so the user gets the "目标服务器故障" hint instead of the CLI
    // http-error message (which suggests restarting the app).
    const r = classify("ERROR: HTTP Error 502: Bad Gateway")
    expect(r.type).toBe("http-5xx")
  })

  it("does NOT classify yt-dlp's 'HTTP Error 404' as http-error", () => {
    const r = classify("ERROR: HTTP Error 404: Not Found")
    expect(r.type).toBe("http-404")
  })

  it("executable-not-found (yt-dlp)", () => {
    const r = classify("yt-dlp executable not found")
    expect(r.type).toBe("executable-not-found")
  })

  it("executable-not-found (ffmpeg)", () => {
    const r = classify("ffmpeg executable not found")
    expect(r.type).toBe("executable-not-found")
  })

  it("api-network-error (Failed to fetch)", () => {
    const r = classify("TypeError: Failed to fetch")
    expect(r.type).toBe("api-network-error")
  })

  it("api-network-error (NetworkError)", () => {
    const r = classify("NetworkError when attempting to fetch resource")
    expect(r.type).toBe("api-network-error")
  })

  it("api-network-error (Load failed)", () => {
    const r = classify("Load failed")
    expect(r.type).toBe("api-network-error")
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
      "downloadVideo.errors.httpError": "Unknown error (HTTP {{status}}). Please restart. [i18n]",
      "downloadVideo.errors.executableNotFound": "Executable not found. [i18n]",
      "downloadVideo.errors.apiNetworkError": "API network error. [i18n]",
    }
    const template = map[key]
    if (!template) return key
    // Simple interpolation for all `{{var}}` placeholders from opts.
    return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
      const v = opts?.[name]
      return v == null ? `{{${name}}}` : String(v)
    })
  }) as (key: string, opts?: Record<string, unknown>) => string

  it("returns i18n message when t is provided", () => {
    const msg = getYtdlpErrorMessage(
      { type: "cookie-expired" },
      mockT,
    )
    expect(msg).toBe("Cookies expired or invalid. [i18n]")
  })

  it("returns i18n message for http-error with status interpolation", () => {
    const msg = getYtdlpErrorMessage(
      { type: "http-error", context: "400" },
      mockT,
    )
    expect(msg).toBe("Unknown error (HTTP 400). Please restart. [i18n]")
  })

  it("returns fallback for http-error with status when no t", () => {
    const msg = getYtdlpErrorMessage({ type: "http-error", context: "500" })
    expect(msg).toBe(
      "未知错误(HTTP 500), 请尝试重启本应用. 如果问题持续, 请联系开发者修复.",
    )
  })

  it("returns i18n message for executable-not-found", () => {
    const msg = getYtdlpErrorMessage({ type: "executable-not-found" }, mockT)
    expect(msg).toBe("Executable not found. [i18n]")
  })

  it("returns i18n message for api-network-error", () => {
    const msg = getYtdlpErrorMessage({ type: "api-network-error" }, mockT)
    expect(msg).toBe("API network error. [i18n]")
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

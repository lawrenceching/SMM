// ---------------------------------------------------------------------------
// Error Type Definitions
// ---------------------------------------------------------------------------

/**
 * Known yt-dlp error types that can occur during `--list-formats` or download.
 * Ordered by detection priority (check more specific patterns first).
 */
export type YtdlpErrorType =
  | "cookie-expired"
  | "bot-detection"
  | "age-restricted"
  | "login-required"
  | "format-unavailable"
  | "unsupported-url"
  | "video-unavailable"
  | "geo-restricted"
  | "http-403"
  | "http-404"
  | "http-410"
  | "http-412"
  | "http-429"
  | "http-5xx"
  | "connection-timeout"
  | "network-error"
  | "ffmpeg-missing"
  | "postprocessing-error"
  | "same-file-error"
  | "keyboard-interrupt"
  | "content-too-short"
  | "player-request-failed"
  | "options-error"
  | "download-cancelled"
  | "unknown"

export interface ClassifyYtdlpErrorInput {
  /** Combined stderr from yt-dlp. */
  stderr: string
  /** Combined stdout from yt-dlp. */
  stdout: string
  /** Process exit code, or null if unknown. */
  exitCode: number | null
}

export interface YtdlpErrorResult {
  type: YtdlpErrorType
  /** Optional context extracted from error text (e.g. hostname for timeouts). */
  context?: string
}

// ---------------------------------------------------------------------------
// i18n Key Mapping
// ---------------------------------------------------------------------------

export interface YtdlpErrorI18nConfig {
  /** i18n key under `downloadVideo.errors.*`. */
  key: string
  /** Default fallback message (used when t-function is not available). */
  fallback: string
}

export const YTDLP_ERROR_I18N_MAP: Record<YtdlpErrorType, YtdlpErrorI18nConfig> = {
  "cookie-expired": {
    key: "cookieExpired",
    fallback: "Cookies 过期或无效, 请重新配置",
  },
  "bot-detection": {
    key: "botDetection",
    fallback: "YouTube 检测到异常流量请求, 请提供有效的 Cookies",
  },
  "age-restricted": {
    key: "ageRestricted",
    fallback: "该视频有年龄限制, 请提供已登录的 Cookies",
  },
  "login-required": {
    key: "loginRequired",
    fallback: "该视频需要登录, 请提供有效的 Cookies",
  },
  "format-unavailable": {
    key: "formatUnavailable",
    fallback: "请求格式不可用, 请尝试选择格式码",
  },
  "unsupported-url": {
    key: "unsupportedUrl",
    fallback: "暂不支持该网站",
  },
  "video-unavailable": {
    key: "videoUnavailable",
    fallback: "该视频不可用 (已删除、私密或已结束)",
  },
  "geo-restricted": {
    key: "geoRestricted",
    fallback: "该视频有地区限制, 无法在当前地区访问",
  },
  "http-403": {
    key: "http403",
    fallback: "服务器拒绝访问 (HTTP 403), 可能需要提供 Cookies 或更换网络",
  },
  "http-404": {
    key: "http404",
    fallback: "视频不存在 (HTTP 404)",
  },
  "http-410": {
    key: "http410",
    fallback: "视频已被删除 (HTTP 410)",
  },
  "http-412": {
    key: "http412",
    fallback: "请求被网站反爬虫系统拦截 (HTTP 412), 建议提供 Cookies 或等待后重试",
  },
  "http-429": {
    key: "http429",
    fallback: "请求过于频繁, 请稍后重试 (HTTP 429)",
  },
  "http-5xx": {
    key: "http5xx",
    fallback: "服务器错误, 请稍后重试 (HTTP 5xx)",
  },
  "connection-timeout": {
    key: "connectionTimeout",
    fallback: "连接超时",
  },
  "network-error": {
    key: "networkError",
    fallback: "网络连接失败, 请检查网络设置",
  },
  "ffmpeg-missing": {
    key: "ffmpegMissing",
    fallback: "缺少 FFmpeg, 请安装 FFmpeg",
  },
  "postprocessing-error": {
    key: "postprocessingError",
    fallback: "后处理失败, 请查看日志",
  },
  "same-file-error": {
    key: "sameFileError",
    fallback: "文件已存在",
  },
  "keyboard-interrupt": {
    key: "keyboardInterrupt",
    fallback: "下载被用户中断",
  },
  "content-too-short": {
    key: "contentTooShort",
    fallback: "下载数据不完整, 请重试",
  },
  "player-request-failed": {
    key: "playerRequestFailed",
    fallback: "播放器请求失败, 请重试",
  },
  "options-error": {
    key: "optionsError",
    fallback: "yt-dlp 命令行参数有误",
  },
  "download-cancelled": {
    key: "downloadCancelled",
    fallback: "下载已被取消",
  },
  "unknown": {
    key: "unknown",
    fallback: "未知错误, 请从状态栏任务列表中查看详细日志",
  },
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classifies a yt-dlp error from its stderr, stdout and exit code into a known
 * error type. Applies to both `--list-formats` and download execution errors.
 *
 * Pattern matching priority: more specific patterns are checked first.
 *
 * @param input - The stderr, stdout, and exit code from the yt-dlp process.
 * @returns The classified error type with optional context.
 */
export function classifyYtdlpError(input: ClassifyYtdlpErrorInput): YtdlpErrorResult {
  const { stderr, stdout, exitCode } = input
  const text = [stderr ?? "", stdout ?? ""].filter(Boolean).join("\n")

  // ── Exit code based detection ──────────────────────────────────
  if (exitCode === 101) {
    return { type: "download-cancelled" }
  }

  if (exitCode === 2) {
    return { type: "options-error" }
  }

  // ── Content-based detection (exit code 1 or null) ──────────────

  // Cookie expired — YouTube specific
  if (/The provided YouTube account cookies are no longer valid/i.test(text)) {
    return { type: "cookie-expired" }
  }

  // Bot detection (after cookie check)
  // 'you\'re' is 'you' + "'re", so the alternation must account for both parts
  if (/confirm you('re| are) not a bot/i.test(text)) {
    return { type: "bot-detection" }
  }

  // Age restricted
  if (/age-restricted|confirm your age/i.test(text)) {
    return { type: "age-restricted" }
  }

  // Generic login required
  if (/Sign in to confirm/i.test(text)) {
    return { type: "login-required" }
  }

  // Format not available
  if (/Requested format is not available/i.test(text)) {
    return { type: "format-unavailable" }
  }

  // Unsupported URL
  if (/Unsupported URL/i.test(text)) {
    return { type: "unsupported-url" }
  }

  // Video unavailable (private, deleted, live ended)
  if (/Private video|Video unavailable|this video (is|has been) removed|live event has ended/i.test(text)) {
    return { type: "video-unavailable" }
  }

  // Geo restricted
  if (/Geo-restricted|This content is (not available|geo-restricted)/i.test(text)) {
    return { type: "geo-restricted" }
  }

  // HTTP status code errors
  if (/HTTP Error 403/i.test(text)) {
    return { type: "http-403" }
  }

  if (/HTTP Error 404/i.test(text)) {
    return { type: "http-404" }
  }

  if (/HTTP Error 410/i.test(text)) {
    return { type: "http-410" }
  }

  if (/HTTP Error 412/i.test(text)) {
    return { type: "http-412" }
  }

  if (/HTTP Error 429/i.test(text)) {
    return { type: "http-429" }
  }

  if (/HTTP Error 5\d\d/i.test(text)) {
    return { type: "http-5xx" }
  }

  // Connection timeout — extract hostname if available
  const connectionTimeoutMatch = /Connection to (\S+?) timed out/i.exec(text)
  if (connectionTimeoutMatch) {
    return { type: "connection-timeout", context: connectionTimeoutMatch[1] }
  }

  // Network errors (generic)
  if (
    /Unable to download webpage/i.test(text) ||
    /urlopen error/i.test(text) ||
    /getaddrinfo/i.test(text) ||
    /SSL: CERTIFICATE_VERIFY_FAILED/i.test(text) ||
    /Failed to resolve/i.test(text) ||
    /Temporary failure in name resolution/i.test(text) ||
    /No address associated with hostname/i.test(text)
  ) {
    return { type: "network-error" }
  }

  // FFmpeg missing
  if (/ffprobe and ffmpeg not found/i.test(text) || /mkvmerge not found/i.test(text)) {
    return { type: "ffmpeg-missing" }
  }

  // Post-processing error
  if (/Post-processing/i.test(text) && /ERROR/i.test(text)) {
    return { type: "postprocessing-error" }
  }

  // Same file error
  if (/already exists/i.test(text) && /ERROR/i.test(text)) {
    return { type: "same-file-error" }
  }

  // Keyboard interrupt
  if (/Interrupted by user/i.test(text)) {
    return { type: "keyboard-interrupt" }
  }

  // Content too short
  if (/Incomplete data received/i.test(text)) {
    return { type: "content-too-short" }
  }

  // Player request failed
  if (/Player request failed/i.test(text)) {
    return { type: "player-request-failed" }
  }

  // Fallback for exit code 1 or null with no pattern match
  return { type: "unknown" }
}

// ---------------------------------------------------------------------------
// i18n helper
// ---------------------------------------------------------------------------

/**
 * Returns a user-friendly, localised error message for a given yt-dlp error type.
 *
 * @param result - The classified error result.
 * @param t      - An optional i18n `t` function.
 *   Can be any functions that accepts (key, options) and returns a string.
 * @returns Localised error message string.
 */
export function getYtdlpErrorMessage(
  result: YtdlpErrorResult,
  t?: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const config = YTDLP_ERROR_I18N_MAP[result.type]
  const ctx = result.context

  if (t) {
    const key = `downloadVideo.errors.${config.key}`

    // For errors with dynamic context (e.g. hostname in connection-timeout),
    // pass it as an interpolation variable. i18next's `context` option has
    // special meaning (grammatical context), so we use `host` instead.
    if (ctx) {
      const msg = t(key, { defaultValue: config.fallback, host: ctx })
      if (msg !== key) return msg
    }

    const msg = t(key, { defaultValue: config.fallback })
    if (msg !== key) return msg
  }

  // Fallback when t is not available
  if (ctx) {
    return `连接 ${ctx} 超时`
  }

  return config.fallback
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/** Log yt-dlp failure details to the browser console for debugging. */
export function logYtdlpError(context: string, err: unknown): void {
  const prefix = `[yt-dlp] ${context}`
  if (err instanceof Error) {
    console.error(`${prefix}: ${err.message}`)
    if (err.stack) {
      console.error(err.stack)
    }
    return
  }
  console.error(`${prefix}:`, err)
}

/**
 * Classify a yt-dlp error and log unknown failures (message + stack when available).
 * Returns the classified result (type only, no hardcoded message).
 */
export function reportYtdlpError(
  context: string,
  input: ClassifyYtdlpErrorInput | string,
  cause?: unknown,
): YtdlpErrorResult {
  const result = typeof input === "string"
    ? classifyYtdlpError({ stderr: input, stdout: "", exitCode: null })
    : classifyYtdlpError(input)

  if (result.type === "unknown") {
    const errorText = typeof input === "string" ? input : `${input.stderr}\n${input.stdout}`
    logYtdlpError(context, cause ?? errorText)
  }
  return result
}

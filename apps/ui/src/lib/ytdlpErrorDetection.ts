// Classification lives in @smm/core; this module keeps UI i18n + resolve helpers.
import type {
  ClassifyYtdlpErrorInput,
  YtdlpErrorResult,
  YtdlpErrorType,
} from "@smm/core/pipeline/ytdlp/classifyYtdlpError"
import { classifyYtdlpError } from "@smm/core/pipeline/ytdlp/classifyYtdlpError"

export type {
  YtdlpErrorType,
  ClassifyYtdlpErrorInput,
  YtdlpErrorResult,
} from "@smm/core/pipeline/ytdlp/classifyYtdlpError"
export { classifyYtdlpError } from "@smm/core/pipeline/ytdlp/classifyYtdlpError"

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
  "http-error": {
    key: "httpError",
    // {{status}} is interpolated with the actual HTTP status code (e.g. "400").
    // The 401/4xx/5xx here comes from SMM's own /api/executeCmd endpoint (see
    // `executeCmdStream` in apps/ui/src/api/executeCmd.ts), NOT from the
    // target URL — yt-dlp's own HTTP errors use a different format and are
    // classified into the dedicated `http-403/404/410/412/429/5xx` types.
    fallback: "内部 API 服务器返回错误 (HTTP {{status}}), 请尝试重启本应用. 如果问题持续, 请联系开发者修复.",
  },
  "executable-not-found": {
    key: "executableNotFound",
    fallback: "可执行文件未找到, 请检查 CLI 安装",
  },
  "api-network-error": {
    key: "apiNetworkError",
    fallback: "无法连接到服务, 请检查网络",
  },
  "unknown": {
    key: "unknown",
    fallback: "未知错误, 请从状态栏任务列表中查看详细日志",
  },
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

    // For errors with dynamic context (e.g. hostname in connection-timeout,
    // HTTP status code in http-error), pass it as an interpolation variable.
    // i18next's `context` option has special meaning (grammatical context),
    // so we expose the value under semantic names (`host`, `status`)
    // depending on the error type. Templates use the one they need.
    if (ctx) {
      const msg = t(key, { defaultValue: config.fallback, host: ctx, status: ctx })
      if (msg !== key) return msg
    }

    const msg = t(key, { defaultValue: config.fallback })
    if (msg !== key) return msg
  }

  // Fallback when t is not available
  if (ctx) {
    if (result.type === "connection-timeout") {
      return `连接 ${ctx} 超时`
    }
    if (result.type === "http-error") {
      return `内部 API 服务器返回错误 (HTTP ${ctx}), 请尝试重启本应用. 如果问题持续, 请联系开发者修复.`
    }
  }

  return config.fallback
}

// ---------------------------------------------------------------------------
// Unified error resolution
//
// All DVD error-handling callers (listing banner, download toast) MUST use
// this single function instead of calling classifyYtdlpError +
// getYtdlpErrorMessage + unknown-fallback logic manually.  Adding a new
// error type, improving the unknown fallback, or adjusting the classification
// strategy here will automatically benefit every call site.
// ---------------------------------------------------------------------------

/**
 * Source of a yt-dlp failure, either:
 * - an exception message (HTTP fetch error, timeout, etc.), **or**
 * - the stderr / stdout / exitCode from a completed process.
 */
export interface YtdlpErrorSource {
  /** Exception message (e.g. HTTP fetch error, TypeError). */
  message?: string
  /** stderr captured from a completed process. */
  stderr?: string
  /** stdout captured from a completed process. */
  stdout?: string
  /** Process exit code, or null if unknown. */
  exitCode?: number | null
}

/** Resolved error ready for display. */
export interface ResolvedYtdlpError {
  /** Classified error type (used by the download toast to decide phrasing). */
  type: YtdlpErrorType
  /** Localised, user-facing error message (may include the raw cause). */
  message: string
}

/**
 * Single entry point for resolving a yt-dlp failure into a localised,
 * user-actionable message.
 *
 * Handles classification (stderr / exitCode / message), i18n lookup, and the
 * `unknown` fallback that appends the raw cause text.  All DVD callers —
 * listing banner and download toast — share this one function so the error
 * presentation is always consistent.
 */
export function resolveYtdlpError(
  source: YtdlpErrorSource,
  t: (key: string, opts?: Record<string, unknown>) => string,
): ResolvedYtdlpError {
  // Build the text used for classification.  When `source.message` is
  // present (exception path) it already contains the relevant details;
  // otherwise we use the captured stderr / stdout.
  const classificationStderr =
    source.message ?? source.stderr ?? ''
  const classificationStdout =
    source.message ? '' : (source.stdout ?? '')
  const exitCode = source.exitCode ?? null

  const result = classifyYtdlpError({
    stderr: classificationStderr,
    stdout: classificationStdout,
    exitCode,
  })

  const localisedMessage = getYtdlpErrorMessage(result, t)

  // Raw text that supplements the `unknown` fallback so the user can see the
  // actual cause (e.g. a CLI HTTP error).
  const rawText = source.message?.trim()
    ?? [source.stderr ?? '', source.stdout ?? '']
      .filter(Boolean)
      .join('\n')
      .trim()

  const message =
    result.type === 'unknown' && rawText.length > 0
      ? `${localisedMessage} (${rawText})`
      : localisedMessage

  return { type: result.type, message }
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

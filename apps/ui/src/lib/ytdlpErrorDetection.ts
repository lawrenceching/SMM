/** Known error types that can occur during `--list-formats` or download. */
export type YtdlpErrorType = "cookie-expired" | "format-unavailable" | "connection-timeout" | "unknown"

export interface YtdlpErrorResult {
  type: YtdlpErrorType
  message: string
}

/**
 * Classifies a yt-dlp error message from stdout/stderr into a known error type.
 * Applies to both `--list-formats` and download execution errors.
 */
export function classifyYtdlpError(errorText: string): YtdlpErrorResult {
  const text = errorText ?? ""

  if (/The provided YouTube account cookies are no longer valid/i.test(text)) {
    return { type: "cookie-expired", message: "Cookies 过期或无效, 请重新配置" }
  }

  if (/Requested format is not available/i.test(text)) {
    return { type: "format-unavailable", message: "请求格式不可用, 请尝试选择格式码" }
  }

  if (/Connection to www\.youtube\.com timed out/i.test(text)) {
    return { type: "connection-timeout", message: "无法获取视频格式, 连接 Youtube 超时" }
  }

  return { type: "unknown", message: "未知错误, 请从状态栏任务列表中查看详细日志" }
}

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
 */
export function reportYtdlpError(
  context: string,
  errorText: string,
  cause?: unknown,
): YtdlpErrorResult {
  const result = classifyYtdlpError(errorText)
  if (result.type === "unknown") {
    logYtdlpError(context, cause ?? errorText)
  }
  return result
}

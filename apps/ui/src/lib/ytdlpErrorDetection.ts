/** Known error types that can occur during `--list-formats` or download. */
export type YtdlpErrorType = "cookie-expired" | "format-unavailable" | "unknown"

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

  return { type: "unknown", message: "未知错误, 请从状态栏任务列表中查看详细日志" }
}

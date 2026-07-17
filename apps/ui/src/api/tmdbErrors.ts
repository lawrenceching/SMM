import { SMM_TMDB_DEFAULT_UPSTREAM } from "./tmdb"

/**
 * High-level classification of a TMDB fetch error.
 */
export type TmdbErrorKind = "no-response" | "unauthorized" | "reverse-proxy" | "upstream"

interface TmdbErrorInfo {
  kind: TmdbErrorKind
  statusCode: number
  statusText: string
  /** Cached response body text (empty when no response or body already consumed). */
  responseBodyText: string
  /** The `detail` field from a ProblemDetails body on 502, or empty string. */
  problemDetail: string
}

/**
 * Preserves rich HTTP error metadata through the throw / catch chain.
 *
 * The default `.message` matches the generic strings previously thrown by the
 * API functions in `tmdb.ts`, ensuring backward compatibility for callers that
 * only read `error.message`.
 */
export class TmdbFetchError extends Error {
  public readonly info: TmdbErrorInfo

  constructor(info: TmdbErrorInfo, message?: string) {
    super(
      message ??
        (info.kind === "no-response"
          ? "Failed to search TMDB: all attempts failed"
          : `Failed to search TMDB: ${info.statusCode} ${info.statusText}`),
    )
    this.name = "TmdbFetchError"
    this.info = info
  }
}

/**
 * Read a raw `Response` (or `undefined` for network failures) and produce a
 * `TmdbFetchError` with the body text and ProblemDetails detail cached.
 *
 * Call this in the `!resp || !resp.ok` branch.  The response body is read once
 * inside this function so the caller must NOT also read it.
 */
export async function buildTmdbErrorFromResponse(
  resp: Response | undefined,
): Promise<TmdbFetchError> {
  if (!resp) {
    return new TmdbFetchError({
      kind: "no-response",
      statusCode: 0,
      statusText: "",
      responseBodyText: "",
      problemDetail: "",
    })
  }

  let bodyText = ""
  let problemDetail = ""
  try {
    bodyText = await resp.text()
    if (resp.status === 502) {
      try {
        const parsed = JSON.parse(bodyText)
        if (parsed?.detail) problemDetail = String(parsed.detail)
      } catch {
        // ignore parse failure — body may be plain text
      }
    }
  } catch {
    // ignore body-read failure
  }

  // Full body helps diagnose reverse-proxy 502 (ProblemDetails) and upstream errors.
  console.log("[TMDB] reverse proxy / upstream error response", {
    url: resp.url,
    status: resp.status,
    statusText: resp.statusText,
    body: bodyText,
  })

  const kind: TmdbErrorKind =
    resp.status === 401 ? "unauthorized"
      : resp.status === 502 ? "reverse-proxy"
      : "upstream"

  return new TmdbFetchError({
    kind,
    statusCode: resp.status,
    statusText: resp.statusText,
    responseBodyText: bodyText,
    problemDetail,
  })
}

// ---------------------------------------------------------------------------
// Display layer
// ---------------------------------------------------------------------------

export interface TmdbErrorDisplay {
  kind: TmdbErrorKind
  /** i18n key for the primary message. */
  messageKey: string
  /** Interpolation params for the i18n key. */
  messageParams: Record<string, string>
  statusCode: number
  statusText: string
  /** Raw body text (may be JSON). */
  responseBodyText: string
  /** Extracted ProblemDetails.detail (only meaningful for reverse-proxy kind). */
  problemDetail: string
}

/**
 * Classify any error (TmdbFetchError or unknown) into structured display info.
 *
 * The caller is responsible for providing `tmdbUrl` (the upstream host) so it
 * can be interpolated into the reverse-proxy error message.
 */
export function classifyTmdbError(
  error: unknown,
  tmdbUrl?: string,
): TmdbErrorDisplay {
  if (error instanceof TmdbFetchError) {
    const info = error.info
    switch (info.kind) {
      case "no-response":
        return {
          kind: "no-response",
          messageKey: "errors:searchFailed",
          messageParams: {},
          statusCode: 0,
          statusText: "",
          responseBodyText: "",
          problemDetail: "",
        }
      case "unauthorized":
        return {
          kind: "unauthorized",
          messageKey: "errors:searchFailedUnauthorizedTmdb",
          messageParams: {},
          statusCode: info.statusCode,
          statusText: info.statusText,
          responseBodyText: "",
          problemDetail: "",
        }
      case "reverse-proxy":
        return {
          kind: "reverse-proxy",
          messageKey: "errors:searchFailedReverseProxy",
          messageParams: {
            url: tmdbUrl ?? SMM_TMDB_DEFAULT_UPSTREAM,
            detail: info.problemDetail,
          },
          statusCode: info.statusCode,
          statusText: info.statusText,
          responseBodyText: info.responseBodyText,
          problemDetail: info.problemDetail,
        }
      case "upstream":
        return {
          kind: "upstream",
          messageKey: "errors:searchFailedUpstream",
          messageParams: {},
          statusCode: info.statusCode,
          statusText: info.statusText,
          responseBodyText: info.responseBodyText,
          problemDetail: info.problemDetail,
        }
    }
  }
  // Non-TMDB errors (network errors, TVDB errors, etc.)
  return {
    kind: "no-response",
    messageKey: "errors:searchFailed",
    messageParams: {},
    statusCode: 0,
    statusText: "",
    responseBodyText: "",
    problemDetail: "",
  }
}

/**
 * Read the response body and format it for display in the search error UI.
 * If the body is valid JSON, return a pretty-printed version; otherwise
 * return the raw text, truncated to 2000 characters.
 */
export function formatResponseBodyText(bodyText: string): string {
  if (!bodyText) return ""
  try {
    const parsed = JSON.parse(bodyText)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return bodyText.length > 2000 ? `${bodyText.slice(0, 2000)}...` : bodyText
  }
}

/**
 * Produce the final display string using the i18n `t()` function.
 *
 * For upstream errors the status line and pretty-printed body text are appended
 * after the i18n message; for all other error kinds the result is just the
 * translated message.
 */
export function formatTmdbErrorForDisplay(
  display: TmdbErrorDisplay,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (...args: any[]) => string,
): string {
  switch (display.kind) {
    case "no-response":
    case "unauthorized":
    case "reverse-proxy":
      return t(display.messageKey, display.messageParams)
    case "upstream": {
      const statusLine = `HTTP ${display.statusCode} ${display.statusText}`
      const body = formatResponseBodyText(display.responseBodyText)
      return body
        ? `${t(display.messageKey)}\n${statusLine}\n${body}`
        : `${t(display.messageKey)}\n${statusLine}`
    }
  }
}

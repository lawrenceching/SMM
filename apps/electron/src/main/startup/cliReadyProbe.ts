/**
 * Permanent Electron→CLI readiness probes.
 *
 * Mac Electron e2e has intermittently failed with Startup Error even after the
 * CLI logged `ui-server-start-done`. Probes then saw HTTP 406 + application/json
 * instead of text/html. Keep these probes and body snippets so the next flake
 * can be attributed (wrong Accept, missing index.html, wrong process on port, …).
 */

export const CLI_UI_READY_ACCEPT = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"

export const CLI_UI_READY_PATHS = ["/", "/index.html"] as const

const BODY_SNIPPET_MAX = 400

export interface CliHttpProbeResult {
  url: string
  accept: string
  ok: boolean
  status: number | null
  contentType: string | null
  bodySnippet: string | null
  error: string | null
  /** True when status is 2xx and Content-Type looks like HTML. */
  isHtmlReady: boolean
}

export function isHtmlReadyResponse(
  status: number,
  contentType: string | null | undefined,
): boolean {
  if (status < 200 || status >= 300) {
    return false
  }
  return (contentType ?? "").toLowerCase().includes("text/html")
}

export function formatProbeResult(result: CliHttpProbeResult): string {
  if (result.error) {
    return `${result.url} Accept=${JSON.stringify(result.accept)} → error=${result.error}`
  }
  const body =
    result.bodySnippet && result.bodySnippet.length > 0
      ? ` body=${JSON.stringify(result.bodySnippet)}`
      : " body=(empty)"
  return (
    `${result.url} Accept=${JSON.stringify(result.accept)} → ` +
    `status=${result.status} content-type=${result.contentType ?? "(none)"}` +
    body
  )
}

function snippetFromBody(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim()
  if (compact.length <= BODY_SNIPPET_MAX) {
    return compact
  }
  return `${compact.slice(0, BODY_SNIPPET_MAX)}…`
}

export async function probeCliHttp(
  port: number,
  path: string,
  options?: {
    accept?: string
    timeoutMs?: number
    fetchImpl?: typeof fetch
  },
): Promise<CliHttpProbeResult> {
  const accept = options?.accept ?? CLI_UI_READY_ACCEPT
  const timeoutMs = options?.timeoutMs ?? 2000
  const fetchImpl = options?.fetchImpl ?? fetch
  const url = `http://127.0.0.1:${port}${path.startsWith("/") ? path : `/${path}`}`

  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: accept },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const contentType = res.headers.get("content-type")
    let bodySnippet: string | null = null
    try {
      bodySnippet = snippetFromBody(await res.text())
    } catch {
      bodySnippet = "(failed to read body)"
    }
    return {
      url,
      accept,
      ok: res.ok,
      status: res.status,
      contentType,
      bodySnippet,
      error: null,
      isHtmlReady: isHtmlReadyResponse(res.status, contentType),
    }
  } catch (error) {
    return {
      url,
      accept,
      ok: false,
      status: null,
      contentType: null,
      bodySnippet: null,
      error: error instanceof Error ? error.message : String(error),
      isHtmlReady: false,
    }
  }
}

export async function probeCliUiReady(
  port: number,
  options?: {
    accept?: string
    timeoutMs?: number
    fetchImpl?: typeof fetch
  },
): Promise<{ ready: boolean; probes: CliHttpProbeResult[] }> {
  const probes: CliHttpProbeResult[] = []
  for (const path of CLI_UI_READY_PATHS) {
    const probe = await probeCliHttp(port, path, options)
    probes.push(probe)
    if (probe.isHtmlReady) {
      return { ready: true, probes }
    }
  }
  return { ready: false, probes }
}

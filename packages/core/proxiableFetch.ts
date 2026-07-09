export function _joinUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, "")
  const cleanPath = path.startsWith("/") ? path : `/${path}`
  return cleanBase + cleanPath
}

export function _mergeHeaders(
  init: RequestInit,
  extra: Record<string, string> | void,
): void {
  if (!extra) return
  const incoming = init.headers
  if (incoming instanceof Headers) {
    for (const [k, v] of Object.entries(extra)) incoming.set(k, v)
    return
  }
  // init.headers is undefined | Record<string,string> | string[][]. We only
  // support the object form for the merge path; the spec forbids the rest here.
  const obj: Record<string, string> = (incoming as Record<string, string> | undefined) ?? {}
  for (const [k, v] of Object.entries(extra)) obj[k] = v
  init.headers = obj
}

export function _cloneRequestInit(init: RequestInit): RequestInit {
  const out: RequestInit = {
    method: init.method,
    credentials: init.credentials,
    mode: init.mode,
    cache: init.cache,
    redirect: init.redirect,
    referrer: init.referrer,
    referrerPolicy: init.referrerPolicy,
    integrity: init.integrity,
    keepalive: init.keepalive,
    signal: init.signal,
    window: init.window,
  }
  if (init.headers === undefined) {
    out.headers = undefined
  } else if (init.headers instanceof Headers) {
    out.headers = new Headers(init.headers)
  } else if (Array.isArray(init.headers)) {
    // array form: deep-copy the tuples
    out.headers = init.headers.map(([k, v]) => [k, v] as [string, string])
  } else {
    out.headers = { ...init.headers }
  }
  if (init.body === undefined || init.body === null) {
    out.body = undefined
  } else if (typeof init.body === "string") {
    out.body = init.body
  } else if (init.body instanceof URLSearchParams) {
    out.body = new URLSearchParams(init.body.toString())
  } else if (init.body instanceof FormData) {
    const fd = new FormData()
    init.body.forEach((value, key) => {
      fd.append(key, value)
    })
    out.body = fd
  } else if (init.body instanceof Blob) {
    out.body = new Blob([init.body], { type: init.body.type })
  } else if (init.body instanceof ArrayBuffer) {
    const copy = new ArrayBuffer(init.body.byteLength)
    new Uint8Array(copy).set(new Uint8Array(init.body))
    out.body = copy
  } else if (ArrayBuffer.isView(init.body)) {
    const view = init.body as ArrayBufferView
    const copy = new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice()
    out.body = copy
  } else {
    // Anything else (ReadableStream, etc.) — pass through. Documented limitation
    // in the spec: subsequent attempts will fail at fetchFn with a stream-lock
    // error, which the catch path records as a normal failure.
    out.body = init.body
  }
  return out
}

export interface ProxiableFetchContext {
  attemptIndex: number
  urlIndex: number
  proxyIndex: number | null
  totalAttempts: number
  path: string
  targetUrl: string
}

export type ProxiableFetchBeforeFetch = (input: {
  url: string
  proxy: string | undefined
  context: ProxiableFetchContext
}) => Record<string, string> | void

export interface ProxiableFetchOptions {
  path: string
  urls: string[]
  reverseProxies?: string[]
  abortOnHttpError?: boolean
  fetchFn?: typeof fetch
  beforeFetch?: ProxiableFetchBeforeFetch
}

export async function proxiableFetch(
  options: ProxiableFetchOptions,
  init: RequestInit = {},
): Promise<Response> {
  if (options.urls.length === 0) {
    throw new Error("proxiableFetch: urls is empty")
  }
  const fetchFn = options.fetchFn ?? (globalThis.fetch as typeof fetch | undefined)
  if (!fetchFn) {
    throw new Error(
      "proxiableFetch: no fetch implementation available; pass `fetchFn`",
    )
  }
  const reverseProxies = options.reverseProxies ?? []
  const totalAttempts = options.urls.length * (1 + reverseProxies.length)
  let attemptIndex = 0
  let lastError: unknown

  for (let urlIndex = 0; urlIndex < options.urls.length; urlIndex++) {
    const targetUrl = options.urls[urlIndex]!
    const attemptUrls: Array<{ callUrl: string; proxyIndex: number | null }> = [
      { callUrl: targetUrl, proxyIndex: null },
      ...reverseProxies.map((p, i) => ({ callUrl: p, proxyIndex: i })),
    ]

    for (const { callUrl, proxyIndex } of attemptUrls) {
      if (init.signal?.aborted) {
        throw init.signal.reason ?? new DOMException("aborted", "AbortError")
      }
      const perAttemptInit = _cloneRequestInit(init)
      const fullCallUrl = _joinUrl(callUrl, options.path)
      if (options.beforeFetch) {
        const extra = options.beforeFetch({
          url: fullCallUrl,
          proxy: proxyIndex === null ? undefined : reverseProxies[proxyIndex],
          context: {
            attemptIndex,
            urlIndex,
            proxyIndex,
            totalAttempts,
            path: options.path,
            targetUrl,
          },
        })
        _mergeHeaders(perAttemptInit, extra)
      }

      let response: Response
      try {
        response = await fetchFn(fullCallUrl, perAttemptInit)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err
        if (err instanceof Error && err.name === "AbortError") throw err
        lastError = err
        attemptIndex++
        continue
      }

      if (response.ok) return response

      if (options.abortOnHttpError === false) return response

      lastError = new Error(`HTTP ${response.status} ${response.statusText}`)
      attemptIndex++
    }
  }

  throw lastError ?? new Error("proxiableFetch: no attempts made")
}

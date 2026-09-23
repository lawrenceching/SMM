import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'

/**
 * Electron main-process port / leftover diagnostics for Mac CI flakes where
 * WDIO main.log does not capture Electron console, but Startup Error / tmp
 * files are uploaded (or pasted from the error page).
 *
 * Log file: `{tmpdir}/smm-port-startup.log`
 * Line prefix: `[SMM-PORT]` (also mirrored to console.error).
 */

const PORT_STARTUP_LOG_BASENAME = 'smm-port-startup.log'

export function portStartupLogPath(tmpDir: string = tmpdir()): string {
  return join(tmpDir, PORT_STARTUP_LOG_BASENAME)
}

export type PortOccupantKind = 'free' | 'mcp' | 'html' | 'other' | 'error'

export interface PortOccupantProbe {
  kind: PortOccupantKind
  status: number | null
  contentType: string | null
  bodySnippet: string | null
  error: string | null
}

const BODY_SNIPPET_MAX = 200

export function classifyPortOccupant(input: {
  status: number | null
  contentType: string | null
  bodySnippet: string | null
  error: string | null
}): PortOccupantKind {
  if (input.error) {
    const err = input.error.toLowerCase()
    if (
      err.includes('econnrefused') ||
      err.includes('fetch failed') ||
      err.includes('network') ||
      err.includes('abort')
    ) {
      // Connection refused / nothing listening → treat as free for diag.
      if (err.includes('econnrefused') || err.includes('fetch failed')) {
        return 'free'
      }
      return 'error'
    }
    return 'error'
  }
  const status = input.status ?? 0
  const ct = (input.contentType ?? '').toLowerCase()
  const body = (input.bodySnippet ?? '').toLowerCase()
  if (
    status === 406 ||
    body.includes('text/event-stream') ||
    body.includes('"jsonrpc"') ||
    body.includes('jsonrpc')
  ) {
    return 'mcp'
  }
  if (status >= 200 && status < 300 && ct.includes('text/html')) {
    return 'html'
  }
  if (status > 0) {
    return 'other'
  }
  return 'free'
}

export function formatPortOccupantProbe(port: number, probe: PortOccupantProbe): string {
  if (probe.kind === 'free' && !probe.error) {
    return `port=${port} occupant=free`
  }
  return (
    `port=${port} occupant=${probe.kind}` +
    ` status=${probe.status ?? 'null'}` +
    ` content-type=${probe.contentType ?? '(none)'}` +
    (probe.error ? ` error=${probe.error}` : '') +
    (probe.bodySnippet ? ` body=${JSON.stringify(probe.bodySnippet)}` : '')
  )
}

function snippet(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= BODY_SNIPPET_MAX) {
    return compact
  }
  return `${compact.slice(0, BODY_SNIPPET_MAX)}…`
}

/**
 * GET http://127.0.0.1:{port}/ with an HTML Accept header.
 * Used after getFreePort and before spawning CLI to detect leftover MCP
 * (0.0.0.0 bind) that Node's 127.0.0.1 listen probe may miss on macOS.
 */
export async function probePortOccupant(
  port: number,
  options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<PortOccupantProbe> {
  const fetchImpl = options?.fetchImpl ?? fetch
  const timeoutMs = options?.timeoutMs ?? 1500
  const url = `http://127.0.0.1:${port}/`
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const contentType = res.headers.get('content-type')
    let bodySnippet: string | null = null
    try {
      bodySnippet = snippet(await res.text())
    } catch {
      bodySnippet = '(failed to read body)'
    }
    const probe: PortOccupantProbe = {
      kind: 'other',
      status: res.status,
      contentType,
      bodySnippet,
      error: null,
    }
    probe.kind = classifyPortOccupant(probe)
    return probe
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const probe: PortOccupantProbe = {
      kind: 'error',
      status: null,
      contentType: null,
      bodySnippet: null,
      error: message,
    }
    probe.kind = classifyPortOccupant(probe)
    return probe
  }
}

export function appendPortStartupLog(
  message: string,
  options?: { logPath?: string; consoleError?: (line: string) => void },
): void {
  const line = `[SMM-PORT] ${message}`
  const logPath = options?.logPath ?? portStartupLogPath()
  const consoleError = options?.consoleError ?? console.error.bind(console)
  consoleError(line)
  try {
    mkdirSync(dirname(logPath), { recursive: true })
    appendFileSync(logPath, `${line}\n`, 'utf8')
  } catch {
    // Diagnostics must not break startup.
  }
}

export function resetPortStartupLog(options?: { logPath?: string }): void {
  const logPath = options?.logPath ?? portStartupLogPath()
  try {
    writeFileSync(logPath, '', 'utf8')
  } catch {
    // ignore
  }
}

/** Best-effort `lsof` / empty string when unavailable (Windows / no lsof). */
export function describeListenersOnPort(
  port: number,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform === 'win32') {
    return '(lsof skipped on win32)'
  }
  try {
    const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
      timeout: 2000,
    })
    const compact = out.replace(/\s+/g, ' ').trim()
    return compact.length > 0 ? compact.slice(0, 500) : '(no LISTEN)'
  } catch (error) {
    const err = error as { status?: number; message?: string }
    // lsof exits 1 when nothing is listening.
    if (err.status === 1) {
      return '(no LISTEN)'
    }
    return `(lsof failed: ${err.message ?? String(error)})`
  }
}

export function readPortStartupLogTail(
  maxBytes = 32 * 1024,
  logPath: string = portStartupLogPath(),
): string | null {
  if (!existsSync(logPath)) {
    return null
  }
  try {
    const { size } = statSync(logPath)
    if (size === 0) {
      return ''
    }
    const raw = readFileSync(logPath, 'utf8')
    if (raw.length <= maxBytes) {
      return raw
    }
    return raw.slice(raw.length - maxBytes)
  } catch {
    return null
  }
}

export const DEFAULT_FREE_PORT_RANGE = { min: 30000, max: 65535 } as const

export type PortSniffOutcome =
  | { port: number; outcome: 'excluded'; reason: 'exclude-set' }
  | { port: number; outcome: 'busy'; code: string }
  | { port: number; outcome: 'free' }

export function formatPortSniffOutcome(sniff: PortSniffOutcome): string {
  if (sniff.outcome === 'excluded') {
    return `port=${sniff.port} sniff=excluded reason=${sniff.reason}`
  }
  if (sniff.outcome === 'busy') {
    return `port=${sniff.port} sniff=busy code=${sniff.code}`
  }
  return `port=${sniff.port} sniff=free`
}

export type ListenProbeFactory = () => Server

/**
 * Sequential 127.0.0.1 listen probe over [minPort, maxPort], skipping `exclude`.
 * Collects every sniff outcome so CI can see why UI did not start at 30000.
 */
export function findFreePortWithSniff(
  minPort: number,
  maxPort: number,
  exclude: ReadonlySet<number> = new Set(),
  createListenServer: ListenProbeFactory = () => createServer(),
): Promise<{ port: number | null; sniffs: PortSniffOutcome[] }> {
  return new Promise((resolve) => {
    const sniffs: PortSniffOutcome[] = []

    function tryPort(port: number): void {
      if (port > maxPort) {
        resolve({ port: null, sniffs })
        return
      }

      if (exclude.has(port)) {
        sniffs.push({ port, outcome: 'excluded', reason: 'exclude-set' })
        tryPort(port + 1)
        return
      }

      const server = createListenServer()
      server.listen(port, '127.0.0.1', () => {
        sniffs.push({ port, outcome: 'free' })
        server.once('close', () => {
          resolve({ port, sniffs })
        })
        server.close()
      })
      server.on('error', (err) => {
        const code = (err as NodeJS.ErrnoException).code ?? err.message
        sniffs.push({ port, outcome: 'busy', code })
        tryPort(port + 1)
      })
    }

    tryPort(minPort)
  })
}

/**
 * Log a full sniff pass (one line per port) plus summary. Busy ports also get lsof.
 */
export function logPortSniffPass(options: {
  purpose: string
  minPort: number
  maxPort: number
  exclude: ReadonlySet<number>
  sniffs: readonly PortSniffOutcome[]
  selected: number | null
  describeBusyListeners?: (port: number) => string
}): void {
  const excludeList = [...options.exclude].sort((a, b) => a - b).join(',')
  appendPortStartupLog(
    `sniff-begin purpose=${options.purpose} range=[${options.minPort},${options.maxPort}] ` +
      `exclude=[${excludeList || '(none)'}]`,
  )
  const describeBusy = options.describeBusyListeners ?? describeListenersOnPort
  for (const sniff of options.sniffs) {
    let line = `sniff-step purpose=${options.purpose} ${formatPortSniffOutcome(sniff)}`
    if (sniff.outcome === 'busy') {
      line += ` lsof=${describeBusy(sniff.port)}`
    }
    appendPortStartupLog(line)
  }
  const busy = options.sniffs.filter((s) => s.outcome === 'busy').map((s) => s.port)
  const excluded = options.sniffs.filter((s) => s.outcome === 'excluded').map((s) => s.port)
  appendPortStartupLog(
    `sniff-end purpose=${options.purpose} selected=${options.selected ?? 'null'} ` +
      `tried=${options.sniffs.length} busy=[${busy.join(',') || '(none)'}] ` +
      `excluded=[${excluded.join(',') || '(none)'}]`,
  )
}

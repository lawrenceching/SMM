import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Same reports tree as HiLog capture (gitignored). */
export const OHOS_FRONTEND_CONSOLE_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'reports',
    'ohos-hilog',
)

export const OHOS_FRONTEND_CONSOLE_FILE = path.join(
    OHOS_FRONTEND_CONSOLE_DIR,
    'frontend-console.log',
)

const DEFAULT_DEBUGGER = process.env.OHOS_REMOTE_DEBUG_PORT
    ? `127.0.0.1:${process.env.OHOS_REMOTE_DEBUG_PORT}`
    : '127.0.0.1:9222'

// Default on; set OHOS_FRONTEND_CONSOLE_CAPTURE=false to skip.
const CAPTURE_ENABLED = process.env.OHOS_FRONTEND_CONSOLE_CAPTURE !== 'false'

type CdpRemoteObject = {
    type?: string
    subtype?: string
    value?: unknown
    description?: string
    unserializableValue?: string
}

type CdpConsoleEvent = {
    type?: string
    args?: CdpRemoteObject[]
    timestamp?: number
}

type CdpExceptionEvent = {
    exceptionDetails?: {
        text?: string
        exception?: CdpRemoteObject
        lineNumber?: number
        columnNumber?: number
        url?: string
    }
}

type JsonListTarget = {
    id: string
    type: string
    title?: string
    url?: string
    webSocketDebuggerUrl?: string
}

let ws: WebSocket | null = null
let logStream: fs.WriteStream | null = null
let nextId = 1
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

function redactSecrets(text: string): string {
    return text
        .replace(/("apiKey"\s*:\s*")[^"]*(")/g, '$1***$2')
        .replace(/\bsk-[a-zA-Z0-9_-]{8,}/g, 'sk-***')
}

function writeLine(line: string): void {
    logStream?.write(redactSecrets(line) + '\n')
}

function formatRemoteObject(obj: CdpRemoteObject): string {
    if (obj.unserializableValue !== undefined) return String(obj.unserializableValue)
    if (obj.value !== undefined) {
        return typeof obj.value === 'string' ? obj.value : JSON.stringify(obj.value)
    }
    if (obj.description) return obj.description
    return JSON.stringify(obj)
}

function send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error('CDP WebSocket not open'))
    }
    const id = nextId++
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        ws!.send(JSON.stringify({ id, method, params }))
    })
}

async function pickPageTarget(debuggerHost: string): Promise<JsonListTarget> {
    const res = await fetch(`http://${debuggerHost}/json/list`)
    if (!res.ok) {
        throw new Error(`CDP /json/list failed: ${res.status} ${res.statusText}`)
    }
    const targets = (await res.json()) as JsonListTarget[]
    const pages = targets.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl)
    const preferred =
        pages.find((t) => t.url?.includes(':18081')) ??
        pages.find((t) => /smm/i.test(t.title ?? '')) ??
        pages[0]
    if (!preferred?.webSocketDebuggerUrl) {
        throw new Error(
            `No CDP page target with webSocketDebuggerUrl (found ${targets.length} targets)`,
        )
    }
    return preferred
}

/**
 * Attach a second CDP client to the HarmonyOS Electron page and stream
 * Runtime.consoleAPICalled / exceptionThrown to a local file.
 *
 * Uses the same debugger port as Chromedriver attach (`debuggerAddress`).
 */
export async function startFrontendConsoleCapture(
    debuggerAddress: string = DEFAULT_DEBUGGER,
): Promise<void> {
    if (!CAPTURE_ENABLED) {
        console.log('[ohos] Frontend console capture disabled (OHOS_FRONTEND_CONSOLE_CAPTURE=false)')
        return
    }
    if (ws) {
        console.warn('[ohos] Frontend console capture already running')
        return
    }

    fs.mkdirSync(OHOS_FRONTEND_CONSOLE_DIR, { recursive: true })
    if (fs.existsSync(OHOS_FRONTEND_CONSOLE_FILE)) {
        fs.unlinkSync(OHOS_FRONTEND_CONSOLE_FILE)
    }
    logStream = fs.createWriteStream(OHOS_FRONTEND_CONSOLE_FILE, { flags: 'a' })

    const target = await pickPageTarget(debuggerAddress)
    writeLine(
        `# ohos frontend console capture started at ${new Date().toISOString()} ` +
            `url=${target.url ?? ''} title=${target.title ?? ''}`,
    )

    await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(target.webSocketDebuggerUrl!)
        ws = socket

        const onFail = (err: unknown) => {
            reject(err instanceof Error ? err : new Error(String(err)))
        }

        socket.addEventListener('error', onFail)
        socket.addEventListener('open', () => {
            socket.removeEventListener('error', onFail)
            resolve()
        })
    })

    ws!.addEventListener('message', (ev) => {
        let msg: {
            id?: number
            error?: { message?: string }
            result?: unknown
            method?: string
            params?: unknown
        }
        try {
            msg = JSON.parse(String(ev.data))
        } catch {
            return
        }

        if (msg.id != null && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id)!
            pending.delete(msg.id)
            if (msg.error) {
                reject(new Error(msg.error.message ?? JSON.stringify(msg.error)))
            } else {
                resolve(msg.result)
            }
            return
        }

        if (msg.method === 'Runtime.consoleAPICalled') {
            const params = msg.params as CdpConsoleEvent
            const level = params.type ?? 'log'
            const text = (params.args ?? []).map(formatRemoteObject).join(' ')
            writeLine(`${new Date().toISOString()} [${level}] ${text}`)
            return
        }

        if (msg.method === 'Runtime.exceptionThrown') {
            const params = msg.params as CdpExceptionEvent
            const d = params.exceptionDetails
            const text =
                d?.exception?.description ??
                d?.text ??
                JSON.stringify(d ?? params)
            writeLine(
                `${new Date().toISOString()} [exception] ${d?.url ?? ''} ` +
                    `${d?.lineNumber ?? '?'}:${d?.columnNumber ?? '?'} ${text}`,
            )
        }
    })

    await send('Runtime.enable')
    try {
        await send('Log.enable')
    } catch {
        // optional domain
    }

    // Marker so verification can assert capture is live under WDIO attach.
    try {
        await send('Runtime.evaluate', {
            expression: `console.log("[e2e-cdp-capture] attached", Date.now())`,
        })
    } catch (err) {
        console.warn(
            '[ohos] Failed to inject CDP marker log:',
            err instanceof Error ? err.message : err,
        )
    }

    console.log(`[ohos] Frontend console capture → ${OHOS_FRONTEND_CONSOLE_FILE}`)
}

export async function stopFrontendConsoleCapture(): Promise<void> {
    if (!CAPTURE_ENABLED) return

    const socket = ws
    ws = null
    for (const [, p] of pending) {
        p.reject(new Error('CDP capture stopped'))
    }
    pending.clear()

    if (socket) {
        try {
            if (socket.readyState === WebSocket.OPEN) {
                socket.close()
            }
        } catch {
            // ignore
        }
    }

    const stream = logStream
    logStream = null
    if (stream) {
        await new Promise<void>((resolve) => {
            stream.write(
                `\n# ohos frontend console capture stopped at ${new Date().toISOString()}\n`,
            )
            stream.end(() => resolve())
        })
    }

    if (fs.existsSync(OHOS_FRONTEND_CONSOLE_FILE)) {
        const bytes = fs.statSync(OHOS_FRONTEND_CONSOLE_FILE).size
        console.log(
            `[ohos] Frontend console capture saved (${bytes} bytes): ${OHOS_FRONTEND_CONSOLE_FILE}`,
        )
    } else {
        console.warn('[ohos] Frontend console capture file missing after stop')
    }
}

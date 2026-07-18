import { execSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Host-side directory for streamed device HiLog (gitignored under reports/). */
export const OHOS_HILOG_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'reports',
    'ohos-hilog',
)

export const OHOS_HILOG_FILE = path.join(OHOS_HILOG_DIR, 'device-hilog.log')

/** HiLog tag used by HarmonyOS Electron main process console. */
const HILOG_TAG = process.env.OHOS_HILOG_TAG ?? 'Electron'

// Default on; set OHOS_HILOG_CAPTURE=false to skip.
const HILOG_CAPTURE_ENABLED = process.env.OHOS_HILOG_CAPTURE !== 'false'

let hilogChild: ChildProcessWithoutNullStreams | null = null
let logStream: fs.WriteStream | null = null

function hdcSync(cmd: string): string {
    return execSync(`hdc ${cmd}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
}

/** Mask secrets that core-routes may dump when logging writeFile bodies. */
function redactSecrets(text: string): string {
    return text
        .replace(/("apiKey"\s*:\s*")[^"]*(")/g, '$1***$2')
        .replace(/\bsk-[a-zA-Z0-9_-]{8,}/g, 'sk-***')
}

function writeCaptured(chunk: Buffer | string): void {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    logStream?.write(redactSecrets(text))
}

/**
 * Clear device HiLog buffer, then stream `hilog -T Electron` to a local file
 * for the duration of the WDIO run.
 */
export function startHilogCapture(): void {
    if (!HILOG_CAPTURE_ENABLED) {
        console.log('[ohos] HiLog capture disabled (OHOS_HILOG_CAPTURE=false)')
        return
    }

    fs.mkdirSync(OHOS_HILOG_DIR, { recursive: true })
    if (fs.existsSync(OHOS_HILOG_FILE)) {
        fs.unlinkSync(OHOS_HILOG_FILE)
    }

    try {
        const cleared = hdcSync('shell hilog -r')
        console.log(`[ohos] hilog -r: ${cleared || 'ok'}`)
    } catch (err) {
        console.warn(
            '[ohos] Failed to clear hilog buffer (continuing):',
            err instanceof Error ? err.message : err,
        )
    }

    logStream = fs.createWriteStream(OHOS_HILOG_FILE, { flags: 'a' })
    // Device-side tag filter keeps noise down; multi-line object dumps still pass.
    hilogChild = spawn('hdc', ['shell', 'hilog', '-T', HILOG_TAG], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    })

    logStream.write(
        `# ohos hilog capture started at ${new Date().toISOString()} tag=${HILOG_TAG}\n`,
    )

    hilogChild.stdout.on('data', (chunk: Buffer) => {
        writeCaptured(chunk)
    })
    hilogChild.stderr.on('data', (chunk: Buffer) => {
        writeCaptured(chunk)
    })
    hilogChild.on('error', (err) => {
        console.warn('[ohos] hilog capture process error:', err.message)
    })
    hilogChild.on('exit', (code, signal) => {
        console.log(`[ohos] hilog capture exited code=${code} signal=${signal}`)
    })

    console.log(`[ohos] HiLog capture → ${OHOS_HILOG_FILE}`)
}

export function stopHilogCapture(): void {
    if (!HILOG_CAPTURE_ENABLED) return

    const child = hilogChild
    hilogChild = null
    if (child && !child.killed) {
        try {
            child.kill()
        } catch {
            // ignore
        }
    }

    const stream = logStream
    logStream = null
    if (stream) {
        stream.write(`\n# ohos hilog capture stopped at ${new Date().toISOString()}\n`)
        stream.end()
    }

    if (fs.existsSync(OHOS_HILOG_FILE)) {
        const bytes = fs.statSync(OHOS_HILOG_FILE).size
        console.log(`[ohos] HiLog capture saved (${bytes} bytes): ${OHOS_HILOG_FILE}`)
    } else {
        console.warn('[ohos] HiLog capture file missing after stop')
    }
}

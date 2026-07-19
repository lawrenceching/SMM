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

/** Raw, unfiltered device HiLog stream. */
export const OHOS_HILOG_FILE = path.join(OHOS_HILOG_DIR, 'hilog.log')

/** Electron-tag lines derived from hilog.log with HiLog metadata stripped. */
export const OHOS_ELECTRON_LOG_FILE = path.join(OHOS_HILOG_DIR, 'electron.log')

/**
 * HiLog identity tag used when deriving electron.log from hilog.log.
 * Matches lines like: `... A00001/com.huawei.ohos_electron/Electron: message`
 */
const ELECTRON_HILOG_TAG = process.env.OHOS_ELECTRON_HILOG_TAG ?? 'Electron'

// Default on; set OHOS_HILOG_CAPTURE=false to skip.
const HILOG_CAPTURE_ENABLED = process.env.OHOS_HILOG_CAPTURE !== 'false'

/**
 * MM-DD HH:mm:ss.mmm  pid  tid  LEVEL  domain/bundle/Tag: rest
 * Capture timestamp + message; drop pid/tid/level/identity.
 */
const HILOG_LINE_RE =
    /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+\d+\s+\d+\s+[A-Z]\s+(\S+):\s?(.*)$/

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

function endLogStream(): Promise<void> {
    const stream = logStream
    logStream = null
    if (!stream) return Promise.resolve()
    return new Promise((resolve) => {
        stream.write(`\n# ohos hilog capture stopped at ${new Date().toISOString()}\n`)
        stream.end(() => resolve())
    })
}

/**
 * Convert a raw HiLog line to electron.log form when it belongs to the Electron tag.
 * Returns null for non-Electron / non-matching lines.
 *
 * Input:  `07-19 00:44:42.187 22229 22463 I A00001/com.huawei.ohos_electron/Electron: msg`
 * Output: `07-19 00:44:42.187 msg`
 */
export function toElectronLogLine(
    rawLine: string,
    tag: string = ELECTRON_HILOG_TAG,
): string | null {
    const line = rawLine.replace(/\r$/, '')
    if (!line || line.startsWith('#')) return null

    const m = line.match(HILOG_LINE_RE)
    if (!m) return null

    const [, timestamp, identity, message] = m
    // identity is e.g. A00001/com.huawei.ohos_electron/Electron
    const identityTag = identity.includes('/') ? identity.slice(identity.lastIndexOf('/') + 1) : identity
    if (identityTag !== tag) return null

    return `${timestamp} ${message}`
}

/** Read hilog.log and write filtered electron.log. */
export function writeElectronLogFromHilog(
    hilogPath: string = OHOS_HILOG_FILE,
    electronPath: string = OHOS_ELECTRON_LOG_FILE,
    tag: string = ELECTRON_HILOG_TAG,
): { inputBytes: number; outputLines: number } {
    if (!fs.existsSync(hilogPath)) {
        throw new Error(`hilog file missing: ${hilogPath}`)
    }

    const raw = fs.readFileSync(hilogPath, 'utf8')
    const out: string[] = [
        `# ohos electron.log derived from hilog.log at ${new Date().toISOString()} tag=${tag}`,
    ]

    let outputLines = 0
    for (const line of raw.split(/\n/)) {
        const converted = toElectronLogLine(line, tag)
        if (converted === null) continue
        out.push(converted)
        outputLines++
    }
    out.push('')

    fs.writeFileSync(electronPath, out.join('\n'), 'utf8')
    return { inputBytes: Buffer.byteLength(raw, 'utf8'), outputLines }
}

/**
 * Clear device HiLog buffer, then stream unfiltered `hilog` to hilog.log
 * for the duration of the WDIO run.
 */
export function startHilogCapture(): void {
    if (!HILOG_CAPTURE_ENABLED) {
        console.log('[ohos] HiLog capture disabled (OHOS_HILOG_CAPTURE=false)')
        return
    }

    fs.mkdirSync(OHOS_HILOG_DIR, { recursive: true })
    for (const file of [OHOS_HILOG_FILE, OHOS_ELECTRON_LOG_FILE]) {
        if (fs.existsSync(file)) fs.unlinkSync(file)
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
    // Unfiltered: keep ArkTS / system / Electron — post-process into electron.log on stop.
    hilogChild = spawn('hdc', ['shell', 'hilog'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    })

    logStream.write(`# ohos hilog capture started at ${new Date().toISOString()} (unfiltered)\n`)

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

export async function stopHilogCapture(): Promise<void> {
    if (!HILOG_CAPTURE_ENABLED) return

    const child = hilogChild
    hilogChild = null
    if (child && !child.killed) {
        try {
            child.kill()
        } catch {
            // ignore
        }
        // Allow final stdout flush before closing the file.
        await new Promise((r) => setTimeout(r, 300))
    }

    await endLogStream()

    if (fs.existsSync(OHOS_HILOG_FILE)) {
        const bytes = fs.statSync(OHOS_HILOG_FILE).size
        console.log(`[ohos] HiLog capture saved (${bytes} bytes): ${OHOS_HILOG_FILE}`)
    } else {
        console.warn('[ohos] HiLog capture file missing after stop')
        return
    }

    try {
        const { outputLines } = writeElectronLogFromHilog()
        const bytes = fs.statSync(OHOS_ELECTRON_LOG_FILE).size
        console.log(
            `[ohos] Electron log derived (${outputLines} lines, ${bytes} bytes): ${OHOS_ELECTRON_LOG_FILE}`,
        )
    } catch (err) {
        console.warn(
            '[ohos] Failed to derive electron.log:',
            err instanceof Error ? err.message : err,
        )
    }
}

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const E2E_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const REPO_ROOT = path.resolve(E2E_ROOT, '../..')

let envLoaded = false

function loadE2eEnv(): void {
    if (envLoaded) return
    dotenv.config({ path: path.join(REPO_ROOT, '.env.local') })
    dotenv.config({ path: path.join(E2E_ROOT, '.env.local'), override: true })
    envLoaded = true
}

function looksLikeBilibiliNetscapeCookies(text: string): boolean {
    return text.includes('.bilibili.com') && text.includes('SESSDATA')
}

function resolveCookiesFilePath(rawPath: string): string {
    if (path.isAbsolute(rawPath)) {
        return rawPath
    }
    const fromRepo = path.join(REPO_ROOT, rawPath)
    if (fs.existsSync(fromRepo)) {
        return fromRepo
    }
    return path.join(E2E_ROOT, rawPath)
}

/** Netscape cookie text when configured; otherwise `null`. */
export function getOptionalNetscapeCookies(
    inlineKey: string,
    fileKey: string,
): string | null {
    loadE2eEnv()

    const inline = (process.env[inlineKey] ?? '').trim()
    if (inline) {
        return inline
    }

    const fileRaw = (process.env[fileKey] ?? '').trim()
    if (!fileRaw) {
        return null
    }

    const filePath = resolveCookiesFilePath(fileRaw)
    if (!fs.existsSync(filePath)) {
        return null
    }

    return fs.readFileSync(filePath, 'utf-8').trim()
}
/** Netscape cookie text for Bilibili manual download e2e tests. */
export function getBilibiliCookiesText(): string {
    const text = getOptionalNetscapeCookies('BILIBILI_COOKIES', 'BILIBILI_COOKIES_FILE')
    if (!text) {
        throw new Error(
            'Bilibili cookies are required. Set BILIBILI_COOKIES_FILE or BILIBILI_COOKIES in .env.local.',
        )
    }
    if (!looksLikeBilibiliNetscapeCookies(text)) {
        throw new Error(
            'Bilibili cookies are invalid (expected .bilibili.com and SESSDATA).',
        )
    }
    return text
}

/**
 * Throws if Bilibili cookies are not configured for manual download e2e tests.
 *
 * Configure via root `.env.local` (loaded by the e2e runner):
 * - `BILIBILI_COOKIES_FILE` — path to a Netscape cookies file (e.g. `bin/yt-dlp/bilibili.txt`)
 * - `BILIBILI_COOKIES` — inline Netscape cookie text
 */
export function assertBilibiliCookiesProvided(): void {
    getBilibiliCookiesText()
}

export function hasFirefoxCookieStore(): boolean {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')
    return fs.existsSync(path.join(appData, 'Mozilla', 'Firefox', 'Profiles'))
}

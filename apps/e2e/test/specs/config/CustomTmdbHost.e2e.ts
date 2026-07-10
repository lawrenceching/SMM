/**
 * E2E test: when a custom TMDB host is configured, the MediaMetadataSearchbox
 * must route the search through the internal SMM reverse proxy, not via any of
 * the discovered mediaDatabases or general reverseProxies.
 *
 * Inputs:
 *   apps/e2e/.env.local
 *     TMDB_HOST=https://api.themoviedb.org/3
 *     TMDB_API_KEY=...
 *
 * Discovered mediaDatabases and reverseProxies URLs are fetched at test time
 * by calling the CLI's `/api/discover` endpoint, so the assertions use the
 * real values the UI sees.
 *
 * Scenario:
 *   1. Import a TV show folder.
 *   2. Set TMDB host and API key in user config (no http proxy).
 *   3. Search in the MediaMetadataSearchbox.
 *   4. Verify the search request was sent to the internal reverse proxy.
 *   5. Verify no request was sent to any discovered mediaDatabases URL.
 *   6. Verify no request was sent to any discovered reverseProxies URL.
 */
import { expect, browser } from '@wdio/globals'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hello } from '@smm/test'
import { setup, cleanup, updateUserConfig } from '../../lib/testbed'
import { given, when, then, and, resetStepContext } from '../../lib/gherkin'
import SearchboxCO from '../../componentobjects/Searchbox.co'
import Page from '../../pageobjects/page'
import StatusBar from '../../componentobjects/StatusBar'
import '../../steps'

// ---------------------------------------------------------------------------
// .env.local pre-flight check
// ---------------------------------------------------------------------------
// testbed.ts already loads apps/e2e/.env.local with `override: true` (so the
// e2e-specific values win over the root .env.local). Here we only need to
// validate that every required var is present and non-empty. Report all
// problems (missing + empty) in a single error so the user can fix everything
// in one edit instead of running the test repeatedly.
const envFilePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '.env.local',
)

interface RequiredEnvVar {
    name: string
    example: string
    description: string
}

const REQUIRED_ENV_VARS: RequiredEnvVar[] = [
    {
        name: 'TMDB_HOST',
        example: 'https://api.themoviedb.org/3',
        description: 'TMDB API host (must include the /3 path)',
    },
    {
        name: 'TMDB_API_KEY',
        example: '<your TMDB v3 read access token or v4 API key>',
        description: 'TMDB API key (v3 token or v4 key)',
    },
]

function validateRequiredEnvVars(): Record<string, string> {
    const missing: string[] = []
    const empty: string[] = []
    const values: Record<string, string> = {}

    for (const v of REQUIRED_ENV_VARS) {
        const raw = process.env[v.name]
        if (raw === undefined) {
            missing.push(v.name)
        } else if (!raw.trim()) {
            empty.push(v.name)
        } else {
            values[v.name] = raw.trim()
        }
    }

    if (missing.length === 0 && empty.length === 0) {
        return values
    }

    const lines: string[] = []
    lines.push(
        `CustomTmdbHost.e2e.ts: required env vars not properly set in ${envFilePath}`,
    )
    if (missing.length > 0) {
        lines.push(`  Missing (variable not declared): ${missing.join(', ')}`)
    }
    if (empty.length > 0) {
        lines.push(`  Empty (declared but has no value): ${empty.join(', ')}`)
    }
    lines.push('')
    lines.push('Add these entries to apps/e2e/.env.local:')
    for (const v of REQUIRED_ENV_VARS) {
        if (missing.includes(v.name) || empty.includes(v.name)) {
            lines.push(`  ${v.name}=${v.example}  # ${v.description}`)
        }
    }
    lines.push('')
    lines.push('See apps/e2e/.env.example for the full list of e2e env vars.')
    throw new Error(lines.join('\n'))
}

const env = validateRequiredEnvVars()
const TMDB_HOST = env.TMDB_HOST
const TMDB_API_KEY = env.TMDB_API_KEY

interface DiscoverMediaDatabase {
    type: string
    url: string
    authorizationMethod: string
}

interface DiscoverReverseProxy {
    id: string
    type: string
    url: string
    authorizationMethod: string
}

interface DiscoverResponseBody {
    data?: {
        mediaDatabases: DiscoverMediaDatabase[]
        reverseProxies: DiscoverReverseProxy[]
    }
}

/**
 * Call the CLI's `/api/discover` endpoint and return the discovered
 * mediaDatabases and reverseProxies. This is the same data the UI consumes
 * to decide which fallback hosts to use.
 */
async function fetchDiscoverConfig(): Promise<DiscoverResponseBody> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    const token = process.env.SMM_AUTH_TOKEN
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }
    const resp = await fetch('http://localhost:30000/api/discover', {
        method: 'GET',
        headers,
    })
    if (!resp.ok) {
        throw new Error(`Discover request failed: ${resp.status} ${resp.statusText}`)
    }
    return await resp.json() as DiscoverResponseBody
}

function normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '').toLowerCase()
}

/**
 * Match `target` against any URL prefix in `prefixes`. A boundary check
 * (`/`, `?`, `#`, or end-of-string after the prefix) avoids false positives
 * like `https://example.com/api/tmdb-evil` matching the prefix
 * `https://example.com/api/tmdb`.
 */
function urlMatchesAnyPrefix(targetUrl: string, prefixes: ReadonlySet<string>): boolean {
    const lower = targetUrl.toLowerCase()
    for (const prefix of prefixes) {
        if (lower === prefix) return true
        if (lower.startsWith(prefix)) {
            const next = lower.charAt(prefix.length)
            if (next === '/' || next === '?' || next === '#') return true
        }
    }
    return false
}

interface CapturedRequest {
    url: string
    method: string
}

function extractRequest(event: unknown): CapturedRequest | undefined {
    if (!event || typeof event !== 'object') return undefined
    const request = (event as Record<string, unknown>).request
    if (!request || typeof request !== 'object') return undefined
    const req = request as Record<string, unknown>
    const url = req.url
    if (typeof url !== 'string' || url.length === 0) return undefined
    const method = typeof req.method === 'string' && req.method.length > 0 ? req.method : 'GET'
    return { url, method }
}

describe('Feature: Custom TMDB Host routes search through internal reverse proxy', () => {

    let internalReverseProxyUrl = ''
    const blockedMediaDatabaseUrls: Set<string> = new Set()
    const blockedReverseProxyUrls: Set<string> = new Set()
    let capturedRequests: CapturedRequest[] = []

    before(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            openBrowserPage: true,
        })

        // Resolve the internal SMM reverse proxy URL via hello (used to assert
        // that the search request was routed through the local proxy).
        const helloResp = await hello()
        if (!helloResp.reverseProxyUrl) {
            throw new Error('Internal reverse proxy URL is not available from hello API')
        }
        internalReverseProxyUrl = normalizeBaseUrl(helloResp.reverseProxyUrl)

        // Fetch the real discovered mediaDatabases and reverseProxies from
        // /api/discover. This test is about TMDB search, so only block TMDB
        // mediaDatabases URLs — the searchbox also fetches TVDB language
        // options eagerly, and those calls to the TVDB mediaDatabases are
        // expected and unrelated to the TMDB search under test.
        const discover = await fetchDiscoverConfig()
        for (const db of discover.data?.mediaDatabases ?? []) {
            if (db.type === 'tmdb') {
                blockedMediaDatabaseUrls.add(normalizeBaseUrl(db.url))
            }
        }
        for (const proxy of discover.data?.reverseProxies ?? []) {
            blockedReverseProxyUrls.add(normalizeBaseUrl(proxy.url))
        }

        console.log(`[CustomTmdbHost] internalReverseProxyUrl=${internalReverseProxyUrl}`)
        console.log(`[CustomTmdbHost] blockedMediaDatabaseUrls (tmdb only)=${[...blockedMediaDatabaseUrls].join(', ') || '(none)'}`)
        console.log(`[CustomTmdbHost] blockedReverseProxyUrls=${[...blockedReverseProxyUrls].join(', ') || '(none)'}`)

        // Guard against vacuous passes: if the discover API returned no
        // TMDB mediaDatabases and no reverseProxies, the "no request was
        // sent to blocked URLs" assertions would trivially hold, masking a
        // real regression. Fail fast with a clear message so the test stays
        // meaningful even if the discover config changes upstream.
        if (blockedMediaDatabaseUrls.size === 0) {
            throw new Error(
                '[CustomTmdbHost] discover API returned no TMDB mediaDatabases — ' +
                'cannot verify that the search avoids discovered hosts. ' +
                'Check /api/discover or the remote config it consumes.',
            )
        }
        if (blockedReverseProxyUrls.size === 0) {
            throw new Error(
                '[CustomTmdbHost] discover API returned no reverseProxies — ' +
                'cannot verify that the search avoids general reverse proxies. ' +
                'Check /api/discover or the remote config it consumes.',
            )
        }

        // Subscribe to network events to capture every request URL the browser
        // attempts to fetch during the scenario.
        await browser.sessionSubscribe({ events: ['network.beforeRequestSent'] })
        browser.on('network.beforeRequestSent', (event: unknown) => {
            const captured = extractRequest(event)
            if (captured) capturedRequests.push(captured)
        })
    })

    beforeEach(() => {
        resetStepContext()
        capturedRequests = []
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
        })
    })

    it('Scenario: TMDB search with a custom host is proxied via the internal SMM reverse proxy and never hits discovered mediaDatabases or reverseProxies', async function () {
        this.timeout(60 * 1000)

        const folderName = 'Custom TMDB Host Folder 123123123'

        // GIVEN: a TV show folder was imported (page open, folder in sidebar).
        await given('TV show folder "' + folderName + '" was imported with no media files')

        // AND: the custom TMDB host and API key are written to the user config
        // (no http proxy, per the test specification).
        await given('TMDB host and API key are configured in user config', async () => {
            await updateUserConfig((userConfig) => {
                userConfig.tmdb = {
                    ...(userConfig.tmdb ?? {}),
                    host: TMDB_HOST,
                    apiKey: TMDB_API_KEY,
                }
                return userConfig
            })
        })

        // AND: the page is reloaded so the new TMDB config is picked up.
        await and('page is reloaded to load the new TMDB config', async () => {
            await Page.refresh()
            await browser.waitUntil(async () => StatusBar.isDisplayed(), {
                timeout: 10000,
                timeoutMsg: 'Status bar was not displayed after page reload',
            })
            await browser.pause(500)
        })

        // AND: the imported folder is selected so the searchbox is shown.
        await and('folder "' + folderName + '" was selected')

        // WHEN: I type a keyword in the searchbox.
        const keyword = 'WATATEN'
        await when('I type "' + keyword + '" in the searchbox', async () => {
            const input = await SearchboxCO.input
            await input.waitForDisplayed({ timeout: 10000 })
            await input.click()
            await input.setValue(keyword)
            await browser.pause(300)
        })

        // AND: I click the search button to trigger the TMDB search.
        await and('I click the search button in the searchbox', async () => {
            // Reset the captured-requests list right before triggering the
            // search. The 500ms pause lets any in-flight background fetches
            // (e.g. TVDB language options from the searchbox mount) land in
            // the new array so they don't overlap with the search-click
            // timing. The post-click assertions only check for blocked URLs
            // (TMDB mediaDatabases and reverseProxies), and TVDB URLs are
            // intentionally not in that blocked set, so any leftover
            // background requests are harmless.
            capturedRequests = []
            await browser.pause(500)
            const button = await SearchboxCO.searchButton
            await button.waitForClickable({ timeout: 5000 })
            await button.click()
        })

        // THEN: a TMDB search GET request is sent to the internal reverse proxy.
        // Filter for GET so a CORS OPTIONS preflight can't satisfy this check
        // on its own — a CORS-rejected GET would still fail the test.
        await then('a TMDB search GET request is sent to the internal reverse proxy', async () => {
            const internalProxySet = new Set([internalReverseProxyUrl])
            await browser.waitUntil(
                () => capturedRequests.some(
                    (req) => req.method === 'GET' && urlMatchesAnyPrefix(req.url, internalProxySet),
                ),
                {
                    timeout: 15000,
                    interval: 200,
                    timeoutMsg: `No GET request was sent to internal reverse proxy (${internalReverseProxyUrl}) within 15s`,
                },
            )
            const hit = capturedRequests.some(
                (req) => req.method === 'GET' && urlMatchesAnyPrefix(req.url, internalProxySet),
            )
            expect(hit).toBe(true)
        })

        // AND: no request was sent to any discovered mediaDatabases URL.
        await and('no request was sent to any discovered mediaDatabases URL', async () => {
            const hits = capturedRequests
                .filter((req) => req.method === 'GET')
                .filter((req) => urlMatchesAnyPrefix(req.url, blockedMediaDatabaseUrls))
                .map((req) => `${req.method} ${req.url}`)
            if (hits.length > 0) {
                console.log(`[CustomTmdbHost] Unexpected mediaDatabases hits: ${hits.join(', ')}`)
            }
            expect(hits).toEqual([])
        })

        // AND: no request was sent to any discovered reverseProxies URL.
        await and('no request was sent to any discovered reverseProxies URL', async () => {
            const hits = capturedRequests
                .filter((req) => req.method === 'GET')
                .filter((req) => urlMatchesAnyPrefix(req.url, blockedReverseProxyUrls))
                .map((req) => `${req.method} ${req.url}`)
            if (hits.length > 0) {
                console.log(`[CustomTmdbHost] Unexpected reverseProxies hits: ${hits.join(', ')}`)
            }
            expect(hits).toEqual([])
        })
    })
})

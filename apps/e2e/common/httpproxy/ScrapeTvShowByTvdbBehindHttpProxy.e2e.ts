import { expect, browser } from '@wdio/globals'
import {
    setup,
    cleanup,
    isReverseProxyAccessible,
    isHttpProxyAccessible,
    useEmbeddedHttpProxy,
    startEmbeddedHttpProxy,
    stopEmbeddedHttpProxy,
    getConfiguredHttpProxyAddress,
    DEFAULT_EMBEDDED_PROXY_ADDRESS,
} from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    fileExistsViaBrowser,
    getFileSizeViaBrowser,
    joinPlatformPath,
    listFilesViaBrowser,
    readFileViaBrowser,
    resolveSmmTestFolderViaBrowser,
    basenamePlatformPath,
    updateUserConfigViaBrowser,
} from 'test/lib/browser-fs'
import { given, when, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import type { UserConfig } from '@smm/core/types'
import { env } from 'node:process'
import { testbedOs } from 'test/lib/e2e-platform'
import page from 'test/pageobjects/page'
import Sidebar from 'test/componentobjects/Sidebar'

// Intentionally dead proxy: port 1 is closed on every host / container /
// device, so any request routed through it fails fast with ECONNREFUSED.
const WRONG_HTTP_PROXY = 'http://127.0.0.1:1'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

async function getImagePathWithPrefix(folderPath: string, prefix: string): Promise<string | undefined> {
    const items = await listFilesViaBrowser(folderPath)
    const match = items.find((item) => {
        if (item.isDirectory) return false
        const name = basenamePlatformPath(item.path)
        return (
            name.startsWith(`${prefix}.`) &&
            IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
        )
    })
    return match?.path
}

/**
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('Scrape TV Show via TVDB Behind HTTP Proxy', () => {
    let testFolder = ''

    before(async () => {
        const proxyAccessible = await isReverseProxyAccessible()
        if (!proxyAccessible) {
            throw new Error('Reverse proxy is not accessible — CLI proxy may have failed to start')
        }

        if (useEmbeddedHttpProxy()) {
            await startEmbeddedHttpProxy(DEFAULT_EMBEDDED_PROXY_ADDRESS)
        } else {
            const tvdbHttpProxy = (process.env.TVDB_HTTP_PROXY || '').trim()
            if (!tvdbHttpProxy) {
                throw new Error('TVDB_HTTP_PROXY is not set in the e2e environment')
            }
            const httpProxyUp = await isHttpProxyAccessible(tvdbHttpProxy)
            if (!httpProxyUp) {
                throw new Error(`TVDB HTTP proxy is not reachable: ${tvdbHttpProxy}`)
            }
        }
    })

    after(async () => {
        await stopEmbeddedHttpProxy()
    })

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config: UserConfig) => {
                config.tvdb = {
                    host: 'https://api4.thetvdb.com/v4',
                    apiKey: process.env.TVDB_API_KEY || '',
                    httpProxy: WRONG_HTTP_PROXY,
                }
                config.preferMediaLanguage = 'zh-CN'
                return config
            },
            os: testbedOs,
        })
        resetStepContext()

        testFolder = await resolveSmmTestFolderViaBrowser()
        await clearFolderViaBrowser(testFolder)
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Scenario: TV show scraped via TVDB behind HTTP proxy (dead proxy fails, live proxy succeeds)', async function () {
        this.timeout(240 * 1000)

        // Phase A — dead proxy: scrape must FAIL (proves the proxy is wired).
        await given('TV show folder with TVDB id 355969 and one episode was imported')
        await when('folder from context was selected')
        await when('I click "Scrape" button in TV show panel')
        await then('scrape dialog shows all tasks pending')
        await when('I start scrape')
        await then('scrape dialog shows all TV show tasks failed')
        await when('I close scrape dialog')

        // Phase B — fix the proxy to the working one, scrape again: must succeed.
        const liveProxy = getConfiguredHttpProxyAddress('tvdb')
        if (!liveProxy) {
            throw new Error('No working TVDB HTTP proxy available for Phase B')
        }
        await updateUserConfigViaBrowser((config: UserConfig) => {
            if (config.tvdb) {
                config.tvdb.httpProxy = liveProxy
            }
            return config
        })
        await page.refresh()

        const folder = getStepContext()._folder as {
            folderName: string
            translations?: { title?: Record<string, string> }
        }
        await Sidebar.waitForFolderName(folder.folderName)

        await when('folder from context was selected')
        await when('I click "Scrape" button in TV show panel')
        await then('scrape dialog shows all tasks pending')
        await when('I start scrape')
        await then('scrape dialog shows all TV show tasks completed')
        await when('I close scrape dialog')

        await then('TVDB TV show scrape outputs are written to disk', async () => {
            const folderPath = (getStepContext()._folder as { path: string }).path

            const thumbnailPath = joinPlatformPath(folderPath, 'S01E01.jpg')
            expect(await fileExistsViaBrowser(thumbnailPath)).toBe(true)
            expect(await getFileSizeViaBrowser(thumbnailPath)).toBeGreaterThan(0)

            const posterPath = await getImagePathWithPrefix(folderPath, 'poster')
            const fanartPath = await getImagePathWithPrefix(folderPath, 'fanart')
            expect(posterPath).toBeDefined()
            expect(fanartPath).toBeDefined()
            expect(await getFileSizeViaBrowser(posterPath!)).toBeGreaterThan(0)
            expect(await getFileSizeViaBrowser(fanartPath!)).toBeGreaterThan(0)
            expect(await fileExistsViaBrowser(joinPlatformPath(folderPath, 'S01E02.jpg'))).toBe(false)

            const tvshowNfoPath = joinPlatformPath(folderPath, 'tvshow.nfo')
            expect(await fileExistsViaBrowser(tvshowNfoPath)).toBe(true)
            expect(await readFileViaBrowser(tvshowNfoPath)).toContain('天使降临到了我身边')

            const s01e01EpisodeNfoPath = joinPlatformPath(folderPath, 'S01E01.nfo')
            expect(await fileExistsViaBrowser(s01e01EpisodeNfoPath)).toBe(true)
            expect(await getFileSizeViaBrowser(s01e01EpisodeNfoPath)).toBeGreaterThan(0)
            expect(await readFileViaBrowser(s01e01EpisodeNfoPath)).toContain('心裏癢癢的感覺')
            expect(await fileExistsViaBrowser(joinPlatformPath(folderPath, 'S01E02.nfo'))).toBe(false)
        })

        if (env.slowdown) {
            await browser.pause(5000)
        }
    })
})

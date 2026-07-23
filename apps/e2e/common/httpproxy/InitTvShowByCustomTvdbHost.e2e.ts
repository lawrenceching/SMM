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
    expectMediaMetadataViaBrowser,
} from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { delay } from 'es-toolkit'
import { when, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import type { MediaMetadata, UserConfig } from '@smm/core/types'
import type { TestFolder } from 'test/actions/import-folders'
import TvShowPanel from 'test/componentobjects/TVShowPanel.co'
import { env } from 'node:process'
import { randomUUID } from 'node:crypto'

import { testbedOs } from 'test/lib/e2e-platform'

/** Official TVDB API (from apps/e2e/.env.local `TVDB_HOST`, not a SCF/mediadb proxy). */
const OFFICIAL_TVDB_HOST =
    (process.env.TVDB_HOST || '').trim() || 'https://api4.thetvdb.com/v4'

/**
 * Init TV show via user-configured official TVDB host + API key.
 * Outbound access uses `TVDB_HTTP_PROXY` / embedded proxy when the LAN blocks
 * api4.thetvdb.com (see apps/e2e/.env.example).
 *
 * @supports local, Electron, HarmonyOS
 */
describe('Init TV Show via Custom TVDB Host', () => {
    let testFolder = ''

    before(async () => {
        const proxyAccessible = await isReverseProxyAccessible()
        if (!proxyAccessible) {
            throw new Error('Reverse proxy is not accessible — CLI proxy may have failed to start')
        }

        const apiKey = (process.env.TVDB_API_KEY || '').trim()
        if (!apiKey) {
            throw new Error('TVDB_API_KEY is not set in the e2e environment (apps/e2e/.env.local)')
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
                    host: OFFICIAL_TVDB_HOST,
                    apiKey: (process.env.TVDB_API_KEY || '').trim(),
                    httpProxy: getConfiguredHttpProxyAddress('tvdb'),
                }
                config.preferMediaLanguage = 'en-US'
                config.applicationLanguage = 'en'
                return config
            },
            clearLocalStorage: true,
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

    it('Scenario: TV show folder initialized via custom TVDB host', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        // Wait for config to load before importing folder,
        // otherwise recognition may read stale default config.
        await browser.pause(5000)

        const { folder1 } = await import('test/actions/import-folders')
        // Random folder name (not the show title) so a stuck sidebar title
        // means recognition failed; a Chinese show title means language wrong.
        const opaqueFolderName = `e2e-tvdb-${randomUUID()} {tvdbid=355969}`
        await when('Import media folder', {
            ...folder1,
            folderName: opaqueFolderName,
        } satisfies TestFolder)

        if (env.slowdown) {
            await delay(5 * 1000)
        }

        const expectedTitle = 'WATATEN!: an Angel Flew Down to Me'
        const folder = getStepContext()._folder as { path: string }

        await then(`Sidebar shows folder with title "${expectedTitle}"`)

        await then('TV show panel shows the expected title and episode table', async () => {
            await TvShowPanel.waitForTitleToBe(expectedTitle)

            expect(await TvShowPanel.toString()).toBe(`Season 0
S00E01 - - - -
S00E02 - - - -
Season 1
S01E01 S01E01.mkv V V V
S01E02 S01E02.mkv V V V
S01E03 S01E03.mkv V V V
S01E04 - - - -
S01E05 - - - -
S01E06 - - - -
S01E07 - - - -
S01E08 - - - -
S01E09 - - - -
S01E10 - - - -
S01E11 - - - -
S01E12 - - - -`)
        })

        await then('metadata is persisted with TVDB tvshow id 355969', async () => {
            await expectMediaMetadataViaBrowser(folder.path, (m: unknown) => {
                const mm = m as MediaMetadata
                expect(mm.tvShow).toBeDefined()
                expect(mm.tvShow?.id).toBe('355969')
                expect(mm.tvShow?.database).toBe('TVDB')
                expect(mm.tvShow?.name).toBe(expectedTitle)
                expect(mm.tvShow?.airDate).toBe('2019-01-08')
                return true
            })
        })

        if (env.slowdown) {
            await delay(10 * 1000)
        }
    })
})

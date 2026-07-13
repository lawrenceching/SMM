import { expect, browser } from '@wdio/globals'
import {
    setup,
    cleanup,
    isReverseProxyAccessible,
    expectMediaMetadataToBe,
} from '../../lib/testbed'
import { delay } from 'es-toolkit'
import { given, when, then, resetStepContext, getStepContext } from '../../lib/gherkin'
import '../../steps'
import type { MediaMetadata, UserConfig } from '@smm/core/types'
import type { TestFolder } from '../../actions/import-folders'
import TvShowPanel from '../../componentobjects/TVShowPanel.co'
import { env } from 'node:process'

const CUSTOM_TVDB_HOST = 'https://1255396852-24lotax0vl.ap-hongkong.tencentscf.com'

describe('Init TV Show via Custom TVDB Host', () => {

    before(async () => {
        const proxyAccessible = await isReverseProxyAccessible()
        if (!proxyAccessible) {
            throw new Error('Reverse proxy is not accessible — CLI proxy may have failed to start')
        }
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

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config: UserConfig) => {
                config.tvdb = {
                    host: CUSTOM_TVDB_HOST,
                    apiKey: 'custom-host-no-auth-needed',
                }
                return config
            },
        })

        resetStepContext()
    })

    // Skipped: the custom TVDB host (Tencent Cloud Function) returns 502 on
    // POST /login because it does not proxy the TVDBv4 login endpoint.
    // The custom host needs to handle the login flow (POST /login with any
    // API key → JWT token) before this test can pass.  All GET requests
    // (e.g. /series/{id}, /series/{id}/extended) work fine via the custom
    // host — only the login handshake is missing.
    it.skip('Scenario: TV show folder initialized via custom TVDB host', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        // Wait for config to load before importing folder,
        // otherwise recognition may read stale default config.
        await browser.pause(5000)

        const { folder1 } = await import('../../actions/import-folders')
        await when('Import media folder', {
            ...folder1,
            folderName: `${folder1.mediaName} {tvdbid=355969}`,
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
            await expectMediaMetadataToBe(folder.path, (m: MediaMetadata) => {
                expect(m.tvShow).toBeDefined()
                expect(m.tvShow?.id).toBe('355969')
                expect(m.tvShow?.database).toBe('TVDB')
                expect(m.tvShow?.name).toBe(expectedTitle)
                expect(m.tvShow?.airDate).toBe('2019-01-08')
                return true
            })
        })

        if (env.slowdown) {
            await delay(10 * 1000)
        }
    })
})

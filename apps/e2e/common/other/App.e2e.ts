import { expect } from '@wdio/globals'
import {
    cleanup,
    getConfiguredHttpProxyAddress,
    isHttpProxyAccessible,
    setup,
} from 'test/lib/testbed'
import { folder1, folder2 } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import TvShowPanelCO from 'test/componentobjects/TVShowPanel.co'
import env from 'test/lib/env'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'
import MusicPanelCO from 'test/componentobjects/MusicPanel.co'
import StatusBar from 'test/componentobjects/StatusBar'
import { isOhosE2e, testbedOs } from 'test/lib/e2e-platform'
import type { UserConfig } from '@smm/core/types'
import {
    clearFolderViaBrowser,
    createAndImportFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'

/**
 * Folder switching smoke test (TV / Movie / Music panels).
 *
 * Ohos / blocked LAN: official TMDB needs `TMDB_HOST` + `TMDB_HTTP_PROXY`
 * (see apps/e2e/.env.local). Without that, TV recognition holds the import
 * mutex and never reaches `status=ok`, so immersive-input stays a Skeleton.
 *
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('App', () => {
    let testFolder = ''

    before(async () => {
        // Ohos cannot reach api.themoviedb.org without the LAN HTTP proxy.
        if (isOhosE2e) {
            const tmdbHttpProxy = (process.env.TMDB_HTTP_PROXY || '').trim()
            if (!tmdbHttpProxy) {
                throw new Error('TMDB_HTTP_PROXY is not set (required for Ohos App.e2e)')
            }
            const httpProxyUp = await isHttpProxyAccessible(tmdbHttpProxy)
            if (!httpProxyUp) {
                throw new Error(`TMDB HTTP proxy is not reachable: ${tmdbHttpProxy}`)
            }
        }
    })

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config: UserConfig) => {
                const host = (process.env.TMDB_HOST || '').trim()
                const apiKey = (process.env.TMDB_API_KEY || '').trim()
                const httpProxy = getConfiguredHttpProxyAddress('tmdb')
                if (host || apiKey || httpProxy) {
                    config.tmdb = {
                        ...(host ? { host } : {}),
                        ...(apiKey ? { apiKey } : {}),
                        ...(httpProxy ? { httpProxy } : {}),
                    }
                }
                return config
            },
            os: testbedOs,
        })

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

    it('can switch between media folders', async function () {
        this.timeout(3 * 60 * 1000)
        if (env.slowdown) {
            this.timeout(5 * 60 * 1000)
        }

        const traceId = this.test?.id ?? 'App.e2e.ts'

        const tvshowPath = await createAndImportFolderViaBrowser(folder1, traceId, testFolder)
        const moviePath = await createAndImportFolderViaBrowser(folder2, traceId, testFolder)
        const musicPath = await createAndImportFolderViaBrowser(
            {
                folderName: 'BilibiliMusic',
                type: 'music',
                files: ['song1.mp3', 'song2.mp4'],
            },
            traceId,
            testFolder,
        )

        // Imports are serialized on a mutex: music only appears after TV (and
        // movie) recognition finishes. Waiting for all three replaces a fixed pause.
        await Sidebar.waitForFolderName(folder1.folderName, 120_000)
        await Sidebar.waitForFolderName(folder2.folderName, 120_000)
        await Sidebar.waitForFolderName('BilibiliMusic', 120_000)

        await Sidebar.clickFolder(folder1.folderName)
        await TvShowPanelCO.immersiveInput.waitForExist({ timeout: 30_000 })
        await browser.waitUntil(
            async () => {
                const value = await TvShowPanelCO.immersiveInput.getValue()
                return Boolean(value) && value !== 'Initializing...'
            },
            {
                timeout: 60_000,
                timeoutMsg: 'TV immersive-input never left Initializing...',
            },
        )
        const tvAllTitles = Object.values(folder1.translations?.title ?? {})
        expect(tvAllTitles).toContain(await TvShowPanelCO.immersiveInput.getValue())
        await StatusBar.waitForInitializationComplete(30_000)
        expect(await StatusBar.getMessage()).toBe(tvshowPath)

        await Sidebar.clickFolder(folder2.folderName)
        await MoviePanelCO.input.waitForExist({ timeout: 30_000 })
        await browser.waitUntil(
            async () => {
                const value = await MoviePanelCO.input.getValue()
                return Boolean(value) && value !== 'Initializing...'
            },
            {
                timeout: 60_000,
                timeoutMsg: 'Movie input never left Initializing...',
            },
        )
        const movieAllTitles = Object.values(folder2.translations?.title ?? {})
        expect(movieAllTitles).toContain(await MoviePanelCO.input.getValue())
        await StatusBar.waitForInitializationComplete(30_000)
        expect(await StatusBar.getMessage()).toBe(moviePath)

        await Sidebar.clickFolder('BilibiliMusic')
        await MusicPanelCO.title.waitForExist({ timeout: 30_000 })
        expect(await MusicPanelCO.title.getText()).toBe('BilibiliMusic')
        await StatusBar.waitForInitializationComplete(30_000)
        expect(await StatusBar.getMessage()).toBe(musicPath)
    })
})

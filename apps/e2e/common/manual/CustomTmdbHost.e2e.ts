import { browser } from '@wdio/globals'
import { setup, cleanup, isOfficialTmdbHostAccessible, isReverseProxyAccessible } from 'test/lib/testbed'
import type { UserConfig } from '@smm/core/types'
import TVShowPanel from 'test/componentobjects/TVShowPanel.co'
import env from 'test/lib/env'
import { given, when, then, resetStepContext } from 'test/lib/gherkin'
import 'test/steps'

describe('Custom TMDB Host', () => {

    before(async () => {
        const accessible = await isOfficialTmdbHostAccessible()
        if (!accessible) {
            throw new Error('Official TMDB host is not accessible')
        }
        const proxyAccessible = await isReverseProxyAccessible()
        if (!proxyAccessible) {
            throw new Error('Reverse proxy is not accessible — CLI proxy may have failed to start')
        }
    })

    beforeEach(async () => {

        const tmdbApiKey: string = process.env.TMDB_API_KEY || ''
        if (!tmdbApiKey || tmdbApiKey.trim() === '') {
            throw new Error('TMDB_API_KEY is not set')
        }

        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config: UserConfig) => {
                config.tmdb = {
                    host: 'https://api.themoviedb.org/3',
                    apiKey: tmdbApiKey,
                }
                return config
            },
        })
        resetStepContext()
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

    it('Scenario: TMDB search from custom TMDB host returns results', async function () {
        this.timeout(90 * 1000)

        await given('TV show folder with TMDB id 84666 and one episode was imported')

        await when('searchbox input is focused')
        await when('I click the search button in the searchbox')

        await then('TMDB search returns at least one result', async () => {
            await browser.waitUntil(
                async () => {
                    const results = await TVShowPanel.searchbox.results
                    const count = await results.length
                    return count > 0
                },
                {
                    timeout: 30000,
                    interval: 500,
                    timeoutMsg: 'TMDB search results did not appear within 30s',
                }
            )
        })

        if (env.slowdown) {
            await browser.pause(5000)
        }
    })
})

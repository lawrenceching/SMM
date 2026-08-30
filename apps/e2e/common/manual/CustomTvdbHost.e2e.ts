import { browser } from '@wdio/globals'
import { setup, cleanup, isOfficialTvdbHostAccessible, isReverseProxyAccessible } from 'test/lib/testbed'
import type { UserConfig } from '@smm/types'
import TVShowPanel from 'test/componentobjects/TVShowPanel.co'
import env from 'test/lib/env'
import { given, when, then, resetStepContext } from 'test/lib/gherkin'
import 'test/steps'

import { testbedOs, isDockerE2e } from 'test/lib/e2e-platform'

/**
 * @supports local, Electron
 * @unsupported Docker
 */
describe('Custom TVDB Host', () => {

    before(async () => {
        if (!isDockerE2e) {
            const accessible = await isOfficialTvdbHostAccessible()
            if (!accessible) {
                throw new Error('Official TVDB host is not accessible')
            }
        }
        const proxyAccessible = await isReverseProxyAccessible()
        if (!proxyAccessible) {
            throw new Error('Reverse proxy is not accessible — CLI proxy may have failed to start')
        }
    })

    beforeEach(async () => {

        const tvdbApiKey: string = process.env.TVDB_API_KEY || ''
        if (!tvdbApiKey || tvdbApiKey.trim() === '') {
            throw new Error('TVDB_API_KEY is not set')
        }

        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config: UserConfig) => {
                config.tvdb = {
                    host: 'https://api4.thetvdb.com/v4',
                    apiKey: tvdbApiKey,
                }
                return config
            },
            os: testbedOs,
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
            os: testbedOs,
        })
    })

    it('Scenario: TVDB search from custom TVDB host returns results', async function () {
        this.timeout(90 * 1000)

        await given('TV show folder with TMDB id 84666 and one episode was imported')

        await when('searchbox input is focused')
        await when('I select "TVDB" as the search database')
        await when('I click the search button in the searchbox')

        await then('TVDB search returns at least one result', async () => {
            await browser.waitUntil(
                async () => {
                    const results = await TVShowPanel.searchbox.results
                    const count = await results.length
                    return count > 0
                },
                {
                    timeout: 30000,
                    interval: 500,
                    timeoutMsg: 'TVDB search results did not appear within 30s',
                }
            )
        })

        if (env.slowdown) {
            await browser.pause(5000)
        }
    })
})

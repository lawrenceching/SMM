import { setup, cleanup, isOfficialTmdbHostAccessible, isReverseProxyAccessible } from 'test/lib/testbed'
import type { UserConfig } from '@smm/core/types'
import { given, when, then, resetStepContext } from '../../lib/gherkin'
import '../../steps'

describe('Custom TMDB Host (Wrong API Key)', () => {

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
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config: UserConfig) => {
                config.tmdb = {
                    host: 'https://api.themoviedb.org/3',
                    apiKey: 'invalid-wrong-key-12345',
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

    it('Scenario: TMDB search from custom TMDB host with wrong API key shows 401 error', async function () {
        this.timeout(90 * 1000)

        // GIVEN: a TV show folder with one episode and TMDB id 84666 was imported.
        await given('TV show folder with TMDB id 84666 and one episode was imported')

        // WHEN: I focus the searchbox input and click the search button.
        await when('searchbox input is focused')
        await when('I click the search button in the searchbox')

        // THEN: the searchbox shows an error message containing "401".
        await then('Searchbox shows error message "401"')
    })
})

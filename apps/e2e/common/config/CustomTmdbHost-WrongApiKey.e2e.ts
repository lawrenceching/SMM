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
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import type { UserConfig } from '@smm/types'
import { given, when, then, resetStepContext } from 'test/lib/gherkin'
import 'test/steps'

import { testbedOs } from 'test/lib/e2e-platform'

const WRONG_TMDB_API_KEY = 'invalid-wrong-key-12345'

/**
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('Custom TMDB Host (Wrong API Key)', () => {
    let testFolder = ''

    before(async () => {
        const proxyAccessible = await isReverseProxyAccessible()
        if (!proxyAccessible) {
            throw new Error('Reverse proxy is not accessible — CLI proxy may have failed to start')
        }

        if (useEmbeddedHttpProxy()) {
            await startEmbeddedHttpProxy(DEFAULT_EMBEDDED_PROXY_ADDRESS)
        } else {
            const tmdbHttpProxy = (process.env.TMDB_HTTP_PROXY || '').trim()
            if (!tmdbHttpProxy) {
                throw new Error('TMDB_HTTP_PROXY is not set in the e2e environment')
            }
            const httpProxyUp = await isHttpProxyAccessible(tmdbHttpProxy)
            if (!httpProxyUp) {
                throw new Error(`TMDB HTTP proxy is not reachable: ${tmdbHttpProxy}`)
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
                config.tmdb = {
                    host: 'https://api.themoviedb.org/3',
                    apiKey: WRONG_TMDB_API_KEY,
                    httpProxy: getConfiguredHttpProxyAddress('tmdb'),
                }
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

    it('Scenario: TMDB search from custom TMDB host with wrong API key shows 401 error', async function () {
        this.timeout(90 * 1000)

        // GIVEN: a TV show folder with one episode and TMDB id 84666 was imported.
        await given('TV show folder with TMDB id 84666 and one episode was imported')

        // WHEN: I focus the searchbox input and click the search button.
        await when('searchbox input is focused')
        await when('I click the search button in the searchbox')

        // THEN: unauthorized error names TMDB, HTTP 401, and API key (ideal UX).
        await then('Searchbox shows error message "401"')
        await then('Searchbox shows error message "TMDB"')
        await then('Searchbox shows error message "API key"')
    })
})

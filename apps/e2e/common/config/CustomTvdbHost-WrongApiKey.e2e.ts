import {
    setup,
    cleanup,
    isReverseProxyAccessible,
    isHttpProxyAccessible,
    useEmbeddedHttpProxy,
    startEmbeddedHttpProxy,
    stopEmbeddedHttpProxy,
    getCurrentProxyAddress,
    DEFAULT_EMBEDDED_PROXY_ADDRESS,
} from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import type { UserConfig } from '@smm/core/types'
import { given, when, then, resetStepContext } from 'test/lib/gherkin'
import 'test/steps'

import { testbedOs } from 'test/lib/e2e-platform'

const WRONG_TVDB_API_KEY = 'invalid-wrong-key-12345'

describe('Custom TVDB Host (Wrong API Key)', () => {
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
                    apiKey: WRONG_TVDB_API_KEY,
                    httpProxy: getCurrentProxyAddress() ?? (process.env.TVDB_HTTP_PROXY || '').trim(),
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

    it('Scenario: TVDB search from custom TVDB host with wrong API key shows 401 error', async function () {
        this.timeout(90 * 1000)

        // GIVEN: a TV show folder with one episode and TMDB id 84666 was imported.
        await given('TV show folder with TMDB id 84666 and one episode was imported')

        // WHEN: I focus the searchbox, select TVDB, and click search.
        await when('searchbox input is focused')
        await when('I select "TVDB" as the search database')
        await when('I click the search button in the searchbox')

        // THEN: unauthorized error names TVDB, HTTP 401, and API key (ideal UX).
        await then('Searchbox shows error message "401"')
        await then('Searchbox shows error message "TVDB"')
        await then('Searchbox shows error message "API key"')
    })
})

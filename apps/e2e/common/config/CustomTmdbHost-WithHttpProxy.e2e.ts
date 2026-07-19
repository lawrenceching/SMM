import { browser } from '@wdio/globals'
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
import env from 'test/lib/env'
import { given, when, then, resetStepContext } from 'test/lib/gherkin'
import 'test/steps'

// Intentionally invalid key. We only care that the request reaches the
// official TMDB host through the configured HTTP proxy and is rejected
// with HTTP 401 — that proves the full chain (UI → SMM reverse proxy →
// user HTTP proxy → TMDB) is wired up correctly. No real API key needed.
const WRONG_TMDB_API_KEY = 'invalid-wrong-key-12345'

describe('Custom TMDB Host (via HTTP Proxy)', () => {
    let testFolder = ''

    before(async () => {
        // The whole point of this spec is that we reach TMDB through the
        // configured HTTP proxy, so the official host is NOT expected to be
        // reachable directly from the test runner. We only check the
        // SMM-internal reverse proxy and the user-supplied HTTP proxy.
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
                    httpProxy: getCurrentProxyAddress() ?? (process.env.TMDB_HTTP_PROXY || '').trim(),
                }
                return config
            },
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
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Scenario: TMDB search via custom host + HTTP proxy reaches upstream and reports 401', async function () {
        this.timeout(120 * 1000)

        // GIVEN: a TV show folder with one episode and TMDB id 84666 was imported.
        await given('TV show folder with TMDB id 84666 and one episode was imported')

        // WHEN: I focus the searchbox input and click the search button.
        await when('searchbox input is focused')
        await when('I click the search button in the searchbox')

        // THEN: proxy chain OK; unauthorized error names TMDB and HTTP 401.
        await then('Searchbox shows error message "401"')
        await then('Searchbox shows error message "TMDB"')
        await then('Searchbox shows error message "API key"')

        if (env.slowdown) {
            await browser.pause(5000)
        }
    })
})

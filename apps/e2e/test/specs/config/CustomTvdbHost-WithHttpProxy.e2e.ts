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
import type { UserConfig } from '@smm/core/types'
import env from 'test/lib/env'
import { given, when, then, resetStepContext } from '../../lib/gherkin'
import '../../steps'

// Intentionally invalid key. We only care that the request reaches the
// official TVDB host through the configured HTTP proxy and is rejected
// with HTTP 401 — that proves the full chain (UI → SMM reverse proxy →
// user HTTP proxy → TVDB) is wired up correctly. No real API key needed.
const WRONG_TVDB_API_KEY = 'invalid-wrong-key-12345'

describe('Custom TVDB Host (via HTTP Proxy)', () => {

    before(async () => {
        // The whole point of this spec is that we reach TVDB through the
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

    it('Scenario: TVDB search via custom host + HTTP proxy reaches upstream and reports 401', async function () {
        this.timeout(120 * 1000)

        // GIVEN: a TV show folder with one episode and TMDB id 84666 was imported.
        await given('TV show folder with TMDB id 84666 and one episode was imported')

        // WHEN: I focus the searchbox, select TVDB, and click search.
        await when('searchbox input is focused')
        await when('I select "TVDB" as the search database')
        await when('I click the search button in the searchbox')

        // THEN: proxy chain OK; unauthorized error names TVDB and HTTP 401.
        await then('Searchbox shows error message "401"')
        await then('Searchbox shows error message "TVDB"')
        await then('Searchbox shows error message "API key"')

        if (env.slowdown) {
            await browser.pause(5000)
        }
    })
})

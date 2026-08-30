import { expect, browser } from '@wdio/globals'
import {
    setup,
    cleanup,
    expectMediaMetadataViaBrowser,
    startConfigServer,
    stopConfigServer,
} from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { given, when, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import env from 'test/lib/env'
import type { MediaMetadata, UserConfig } from '@smm/types'

import { testbedOs } from 'test/lib/e2e-platform'

/**
 * Serves a discover config whose first TMDB host is unreachable so the app
 * must fail over to the second host. Must match EXTERNAL_CONFIG_FILE_URL
 * (see root package.json `e2e:failover`).
 */
const CONFIG_SERVER_ADDRESS = 'http://localhost:8000'

/**
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('TMDB Host Failover', () => {
    let testFolder = ''

    before(async () => {
        await startConfigServer(CONFIG_SERVER_ADDRESS)
    })

    after(async () => {
        await stopConfigServer()
    })

    beforeEach(async () => {
        resetStepContext()
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: (config: UserConfig) => {
                config.preferMediaLanguage = 'zh-CN'
                config.applicationLanguage = 'zh-CN'
                return config
            },
            openBrowserPage: true,
            clearLocalStorage: true,
            os: testbedOs,
        })

        const { default: Page } = await import('test/pageobjects/page')
        await Page.refresh()

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
            clearLocalStorage: true,
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Failover to second TMDB host when first is unreachable', async function () {
        this.timeout(5 * 60 * 1000)

        await given('unknown TV show folder was imported')

        await then('searchbox input is empty')
        await when('searchbox input is focused')
        await browser.pause(300)
        await when('I select "TMDB" as the search database')
        await when('I select "zh-CN" as the search language')
        await when('I click the search button in the searchbox')
        await when('I search for "我推的孩子"')
        await when('I select search result with title "【我推的孩子】" and date "April 12, 2023"')

        await browser.pause(5000)

        await then('metadata is persisted with TMDB Oshi no Ko', async () => {
            const folder = getStepContext()._folder as { path: string }
            await expectMediaMetadataViaBrowser(folder.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.tvShow?.id).toBe('203737')
                expect(mm.tvShow?.name).toBe('【我推的孩子】')
                expect(mm.tvShow?.database).toBe('TMDB')
                return true
            })
        })

        if (env.slowdown) {
            await browser.pause(10 * 1000)
        }
    })
})

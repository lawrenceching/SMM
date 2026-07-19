import { expect, browser } from '@wdio/globals'
import { setup, cleanup } from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { delay } from 'es-toolkit'
import { given, then, resetStepContext } from 'test/lib/gherkin'
import 'test/steps'
import MoviePanelCO from 'test/componentobjects/MoviePanel.co'
import { env } from 'node:process'

describe('Initialize Movie by TMDB', () => {
    let testFolder = ''

    beforeEach(async () => {
        resetStepContext()
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config) => {
                config.primaryDatabase = 'TMDB'
                config.preferMediaLanguage = 'zh-CN'
            },
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
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Movie - Folder Name', async function () {
        this.timeout(6 * 60 * 1000)

        await given('Movie folder "哪吒之魔童降世" was created and imported')

        if (env.slowdown) {
            await delay(10 * 1000)
        }

        await then('sidebar shows the movie folder', async () => {
            const { default: Sidebar } = await import('test/componentobjects/Sidebar')
            const isDisplayed = await Sidebar.waitForFolderName('哪吒之魔童降世', 60000)
            expect(isDisplayed).toBe(true)
        })

        await then('immersive input shows the folder name as the movie title', async () => {
            const immersiveInput = await $('[data-testid="immersive-input"]')
            await immersiveInput.waitForDisplayed({ timeout: 15000 })
            await browser.waitUntil(
                async () => (await immersiveInput.getValue()) === '哪吒之魔童降世',
                { timeout: 10000, timeoutMsg: 'ImmersiveMovieSearchbox title did not become "哪吒之魔童降世"' },
            )
            expect(await immersiveInput.getValue()).toBe('哪吒之魔童降世')
        })
    })

    it('Movie - TMDB ID in Folder Name', async function () {
        this.timeout(6 * 60 * 1000)

        const folderNameWithTmdbId = '哪吒之魔童降世 (2019) {tmdbid=615453}'
        const expectedMovieTitle = '哪吒之魔童降世'

        await given(`Movie folder "${folderNameWithTmdbId}" was created with TMDB ID in folder name`)

        if (env.slowdown) {
            await delay(10 * 1000)
        }

        await then('sidebar shows the folder', async () => {
            const { default: Sidebar } = await import('test/componentobjects/Sidebar')
            await Sidebar.waitForFolderName(folderNameWithTmdbId, 60000)
        })

        await then('movie panel shows the expected title', async () => {
            await browser.pause(5000)
            await MoviePanelCO.waitForTitleToBe(expectedMovieTitle, 20000)
        })
    })

    it('Movie - NFO', async function () {
        this.timeout(6 * 60 * 1000)

        await given('Movie folder "流浪地球" was created with movie NFO')

        if (env.slowdown) {
            await delay(10 * 1000)
        }

        await then('sidebar shows the movie folder', async () => {
            const { default: Sidebar } = await import('test/componentobjects/Sidebar')
            const isDisplayed = await Sidebar.waitForFolderName('流浪地球', 60000)
            expect(isDisplayed).toBe(true)
        })

        await then('movie panel input shows the expected title', async () => {
            await browser.pause(20000)
            expect(await MoviePanelCO.input.getValue()).toBe('流浪地球')
        })
    })

    it('Movie - Unknown', async function () {
        this.timeout(15 * 1000)

        await given('Movie folder was created as unknown')

        await delay(2 * 1000)

        await then('immersive input is empty', async () => {
            const immersiveInput = await $('[data-testid="immersive-input"]')
            await immersiveInput.waitForDisplayed({ timeout: 5000 })
            const value = await immersiveInput.getValue()
            expect(value).toBe('')
        })
    })
})

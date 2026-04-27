import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../../componentobjects/Menu'
import Sidebar from '../../componentobjects/Sidebar'
import ConfigDialog from '../../componentobjects/ConfigDialog'
import { createBeforeHook, expectMediaMetadataToBe } from '../../lib/testbed'
import { delay } from 'es-toolkit'
import TVShowPanel from 'test/componentobjects/TVShowPanel.co'
import env from 'test/lib/env'
import { TvShowNameVariable, type MediaMetadata } from '@smm/core/types'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

describe('Search TV Show', () => {

    before(async () => {
        await createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false })();
        console.log('Setting language to zh-CN for Chinese search test...')
        await Menu.openConfigDialog()
        await ConfigDialog.waitForDisplayed()
        await ConfigDialog.selectLanguage('zh-CN')
        await ConfigDialog.clickSave()
        await ConfigDialog.pressEscape()
        await browser.pause(200)
        await ConfigDialog.pressEscape()
        await ConfigDialog.waitForClosed()
        console.log('Language set to zh-CN')
    })

    after(async () => {
        console.log(`${new Date().toISOString()} start to reset language to en`);
        await Menu.openConfigDialog()
        await ConfigDialog.waitForDisplayed()
        await ConfigDialog.selectLanguage('en')
        await ConfigDialog.clickSave()
        await ConfigDialog.pressEscape()
        await browser.pause(200)
        await ConfigDialog.pressEscape()
        await ConfigDialog.waitForClosed()
        console.log('Language reset to en')

        if (fs.existsSync(tmpMediaRoot)) {
            fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
            console.log('Removed tmp media folder:', tmpMediaRoot)
        }
    })

    beforeEach(async () => {
        console.log(`${new Date().toISOString()} TEST STARTED`);
    })

    afterEach(async () => {
        console.log(`${new Date().toISOString()} TEST ENDED`);
    })

    it('Search TV Show - TMDB', async function() {
        this.timeout(5 * 60 * 1000)

        const randomFolderName = `Unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const testMediaFolder = path.join(mediaDir, randomFolderName)
        fs.mkdirSync(testMediaFolder, { recursive: true })
        console.log('Created unknown media folder:', testMediaFolder)

        console.log('Importing media folder:', testMediaFolder)
        await Menu.importMediaFolder({
            type: 'tvshow',
            folderPathInPlatformFormat: testMediaFolder,
            traceId: 'e2eTest:Import Media Folder Search TV Show'
        })

        await browser.pause(1000)

        console.log(`Waiting for folder "${randomFolderName}" to appear in sidebar...`)
        const isDisplayed = await Sidebar.waitForFolderName(randomFolderName, 60000)
        expect(isDisplayed).toBe(true)
        console.log(`Folder "${randomFolderName}" is now displayed in sidebar`)

        await browser.pause(1000)

        await TVShowPanel.searchbox.input.waitForDisplayed()
        const initialInputValue = await TVShowPanel.searchbox.input.getValue()
        expect(initialInputValue).toBe('')
        
        await TVShowPanel.searchbox.input.click()
        await browser.pause(300)
        await TVShowPanel.searchbox.database.waitForDisplayed();

        await TVShowPanel.searchbox.setDatabase('TMDB')
        await TVShowPanel.searchbox.setLanguage('简体中文')
        await TVShowPanel.searchbox.searchButton.click()

        /**
         * Anime 我推的孩子 have 4 seasons in TVDB
         * while 2 seasons in TMDB
         * So it's a good example to verify SMM search TVDB database
         */
        const keyword = '我推的孩子'
        await TVShowPanel.searchbox.input.setValue(keyword)
        await TVShowPanel.searchbox.searchButton.click()

        console.log(`Searching TV show using keyword: ${keyword}`)

        await TVShowPanel.searchbox.selectSearchResult({
            title: '【我推的孩子】',
            date: 'April 12, 2023'
        })

        // TODO: in macOS, query large block of HTML will random caused more than 1 minutes
        // So I can't use waitUntil to check HTML state in some interval.
        // hard delay is added here as workaround
        console.log(`${new Date().toISOString()} PAUSED 10 seconds`);
        await browser.pause(10000)
        console.log(`${new Date().toISOString()} RESUMED`);
        const html  = await $('[data-testid="tv-show-panel"]').getHTML()
        console.log(`${new Date().toISOString()} html="${html}"`)

        await browser.waitUntil(async () => {
            const stateInString = await TVShowPanel.toString();
            console.log(`${new Date().toISOString()} stateInString="${stateInString}"`)
            return stateInString.includes(`特别篇
S00E01 - - - -
S00E02 - - - -
第 1 季
S01E01 - - - -
S01E02 - - - -
S01E03 - - - -
S01E04 - - - -
S01E05 - - - -
S01E06 - - - -
S01E07 - - - -
S01E08 - - - -
S01E09 - - - -
S01E10 - - - -
S01E11 - - - -
S01E12 - - - -
S01E13 - - - -
S01E14 - - - -
S01E15 - - - -
S01E16 - - - -
S01E17 - - - -
S01E18 - - - -
S01E19 - - - -
S01E20 - - - -
S01E21 - - - -
S01E22 - - - -
S01E23 - - - -
S01E24 - - - -
S01E25 - - - -
S01E26 - - - -
S01E27 - - - -
S01E28 - - - -
S01E29 - - - -
S01E30 - - - -
S01E31 - - - -
S01E32 - - - -
S01E33 - - - -
S01E34 - - - -
S01E35 - - - -`)
        }, {
            timeout: 5000,
            interval: 1000,
            timeoutMsg: 'Expected to see Season 0 in the TV show panel',
        })

        console.log(`Waiting for media metadata to be updated`)

        await expectMediaMetadataToBe(testMediaFolder, (obj) => {

            expect(obj.tvShow?.id).toBe('203737')
            expect(obj.tvShow?.name).toBe('【我推的孩子】')
            expect(obj.tvShow?.database).toBe('TMDB')
            return true;
        })

        if(env.slowdown) {
            await browser.pause(10 * 1000)
        }        
    })
    
    it('Search TV Show - TVDB', async function() {
        this.timeout(5 * 60 * 1000)

        const randomFolderName = `Unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const testMediaFolder = path.join(mediaDir, randomFolderName)
        fs.mkdirSync(testMediaFolder, { recursive: true })
        console.log('Created unknown media folder:', testMediaFolder)

        console.log('Importing media folder:', testMediaFolder)
        await Menu.importMediaFolder({
            type: 'tvshow',
            folderPathInPlatformFormat: testMediaFolder,
            traceId: 'e2eTest:Import Media Folder Search TV Show'
        })

        console.log(`Waiting for folder "${randomFolderName}" to appear in sidebar...`)
        const isDisplayed = await Sidebar.waitForFolderName(randomFolderName, 60000)
        expect(isDisplayed).toBe(true)
        console.log(`Folder "${randomFolderName}" is now displayed in sidebar`)

        await browser.pause(1000)

        await TVShowPanel.searchbox.input.waitForDisplayed()
        const initialInputValue = await TVShowPanel.searchbox.input.getValue()
        expect(initialInputValue).toBe('')
        
        await TVShowPanel.searchbox.input.click()
        await browser.pause(300)
        await TVShowPanel.searchbox.database.waitForDisplayed();

        await TVShowPanel.searchbox.setDatabase('TVDB')
        await TVShowPanel.searchbox.setLanguage('简体中文')
        await TVShowPanel.searchbox.searchButton.click()

        /**
         * Anime 我推的孩子 have 4 seasons in TVDB
         * while 2 seasons in TMDB
         * So it's a good example to verify SMM search TVDB database
         */
        const keyword = '我推的孩子'
        await TVShowPanel.searchbox.input.setValue(keyword)
        await TVShowPanel.searchbox.searchButton.click()

        await browser.pause(1000)

        console.log(`Searching TV show using keyword: ${keyword}`)
        await TVShowPanel.searchbox.selectSearchResultByText('【我推的孩子】')

        console.log(`Selected search result`)

        await browser.pause(50000)

//         const stateInString = await TVShowPanel.toString()
//         expect(stateInString).toBe(`Season 0
// S00E01 - - - -
// S00E02 - - - -
// Season 1
// S01E01 - - - -
// S01E02 - - - -
// S01E03 - - - -
// S01E04 - - - -
// S01E05 - - - -
// S01E06 - - - -
// S01E07 - - - -
// S01E08 - - - -
// S01E09 - - - -
// S01E10 - - - -
// S01E11 - - - -
// Season 2
// S02E01 - - - -
// S02E02 - - - -
// S02E03 - - - -
// S02E04 - - - -
// S02E05 - - - -
// S02E06 - - - -
// S02E07 - - - -
// S02E08 - - - -
// S02E09 - - - -
// S02E10 - - - -
// S02E11 - - - -
// S02E12 - - - -
// S02E13 - - - -
// Season 3
// S03E01 - - - -
// S03E02 - - - -
// S03E03 - - - -
// S03E04 - - - -
// S03E05 - - - -
// S03E06 - - - -
// S03E07 - - - -
// S03E08 - - - -
// S03E09 - - - -
// S03E10 - - - -
// S03E11 - - - -`)

        console.log(`Waiting for media metadata to be updated`)

        await expectMediaMetadataToBe(testMediaFolder, (obj) => {
            console.log(JSON.stringify(obj))
            const mm = obj as MediaMetadata;
            return mm.tvShow !== undefined
        })

        if(env.slowdown) {
            await browser.pause(10 * 1000)
        }        
    })

})

import { expect } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../../componentobjects/Menu'
import Sidebar from '../../componentobjects/Sidebar'
import TVShowPanel from '../../componentobjects/TVShowPanel.co'
import { setup, cleanup } from '../../lib/testbed'
import { delay } from 'es-toolkit'
import { createAndImportFolder, folder2 } from 'test/actions/import-folders'
import { setApplicationLanguage } from 'test/actions/setApplicationLanguage'
import SearchboxCO from 'test/componentobjects/Searchbox.co'
import env from 'test/lib/env'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

describe('Search Movie', () => {

    beforeEach(async () => {

        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
        })

        
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

    it('TMDB, English', async function() {
        this.timeout(90 * 1000)

        await createAndImportFolder(folder2, 'e2eTest:Search Movie')

        await Sidebar.waitForFolderName(folder2.folderName, 60000)
        await SearchboxCO.waitForTitleToBe(folder2.translations?.title?.['en-US']!, 60000)
        await SearchboxCO.input.click();


        await SearchboxCO.setDatabase('TMDB')
        await SearchboxCO.setLanguage('English (US)')

        await SearchboxCO.searchButton.waitForClickable()
        await SearchboxCO.searchButton.click()

        await browser.waitUntil(async () => {
            const results = await SearchboxCO.results
            return (await results.length) > 0
        }, {
            timeout: 10000,
            interval: 1000,
            timeoutMsg: 'Expected to see search results',
        })

        if(env.slowdown) {
            await delay(5 * 1000)
        }
    })


    it('TVDB, Chinese', async function() {
        this.timeout(90 * 1000)

        await createAndImportFolder(folder2, 'e2eTest:Search Movie')

        await Sidebar.waitForFolderName(folder2.folderName, 60000)
        await SearchboxCO.waitForTitleToBe(folder2.translations?.title?.['en-US']!, 60000)
        await SearchboxCO.input.click()

        await SearchboxCO.setDatabase('TVDB')
        await SearchboxCO.setLanguage('简体中文')

        await SearchboxCO.searchButton.waitForClickable()
        await SearchboxCO.searchButton.click()

        await browser.waitUntil(async () => {
            const results = await SearchboxCO.results
            return (await results.length) > 0
        }, {
            timeout: 10000,
            interval: 1000,
            timeoutMsg: 'Expected to see search results',
        })

        if(env.slowdown) {
            await delay(5 * 1000)
        }
    })

    it('TMDB, Chinese', async function() {
        this.timeout(90 * 1000)

        await createAndImportFolder(folder2, 'e2eTest:Search Movie')

        await Sidebar.waitForFolderName(folder2.folderName, 60000)
        await SearchboxCO.waitForTitleToBe(folder2.translations?.title?.['en-US']!, 60000)
        await SearchboxCO.input.click()

        await SearchboxCO.setDatabase('TMDB')
        await SearchboxCO.setLanguage('简体中文')

        await SearchboxCO.searchButton.waitForClickable()
        await SearchboxCO.searchButton.click()

        await browser.waitUntil(async () => {
            const results = await SearchboxCO.results
            return (await results.length) > 0
        }, {
            timeout: 10000,
            interval: 1000,
            timeoutMsg: 'Expected to see search results',
        })

        if(env.slowdown) {
            await delay(5 * 1000)
        }
    })

    it('TMDB, Japanese', async function() {
        this.timeout(90 * 1000)

        await createAndImportFolder(folder2, 'e2eTest:Search Movie')

        await Sidebar.waitForFolderName(folder2.folderName, 60000)
        await SearchboxCO.waitForTitleToBe(folder2.translations?.title?.['en-US']!, 60000)
        await SearchboxCO.input.click()

        await SearchboxCO.setDatabase('TMDB')
        await SearchboxCO.setLanguage('日本語')

        await SearchboxCO.searchButton.waitForClickable()
        await SearchboxCO.searchButton.click()

        await browser.waitUntil(async () => {
            const results = await SearchboxCO.results
            return (await results.length) > 0
        }, {
            timeout: 10000,
            interval: 1000,
            timeoutMsg: 'Expected to see search results',
        })

        if(env.slowdown) {
            await delay(5 * 1000)
        }
    })


})

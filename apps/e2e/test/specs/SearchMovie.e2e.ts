import { expect } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import Sidebar from '../componentobjects/Sidebar'
import TVShowPanel from '../componentobjects/TVShowPanel'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'
import { folder2 } from 'test/actions/import-folders'
import { setApplicationLanguage } from 'test/actions/setApplicationLanguage'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

describe('Search Movie', () => {

    before(createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false }))

    beforeEach(async () => {
        console.log('Setting language to zh-CN for Chinese search test...')
        await setApplicationLanguage('zh-CN')
        console.log('Language set to zh-CN')
    })

    afterEach(async () => {
        if (fs.existsSync(tmpMediaRoot)) {
            fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
            console.log('Removed tmp media folder:', tmpMediaRoot)
        }

        console.log('Resetting language to en...')
        await setApplicationLanguage('en')
        console.log('Language reset to en')
    })

    it('Search Movie', async function() {
        this.timeout(90 * 1000)

        const randomFolderName = `Unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const testMediaFolder = path.join(mediaDir, randomFolderName)
        fs.mkdirSync(testMediaFolder, { recursive: true })
        console.log('Created unknown media folder:', testMediaFolder)

        console.log('Importing media folder:', testMediaFolder)
        await Menu.importMediaFolder({
            type: 'movie',
            folderPathInPlatformFormat: testMediaFolder,
            traceId: 'e2eTest:Import Media Folder Search Movie'
        })

        await delay(5 * 1000)

        console.log(`Waiting for folder "${randomFolderName}" to appear in sidebar...`)
        const isDisplayed = await Sidebar.waitForFolder(randomFolderName, 60000)
        expect(isDisplayed).toBe(true)
        console.log(`Folder "${randomFolderName}" is now displayed in sidebar`)

        const immersiveInput = await TVShowPanel.immersiveInput
        await immersiveInput.waitForDisplayed({ timeout: 15000 })
        await browser.waitUntil(
            async () => (await immersiveInput.getValue()) === '',
            { timeout: 10000, timeoutMsg: 'ImmersiveMovieSearchbox should be empty for unknown folder' }
        )

        const expectedTitle = folder2.folderName
        await TVShowPanel.searchAndSelectByTitle(expectedTitle)

        expect(await immersiveInput.getValue()).toBe(expectedTitle)
    })
})

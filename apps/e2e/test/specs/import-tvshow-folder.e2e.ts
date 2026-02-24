import { expect, browser } from '@wdio/globals'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'
import Menu from '../componentobjects/Menu'
import Sidebar from '../componentobjects/Sidebar'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const __filename = fileURLToPath(import.meta.url)
const slowdown = process.env.SLOWDOWN === 'true'

describe('Import Media Folder', () => {

    before(createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false }))

    beforeEach(async () => {
        console.log('Setup before each test')
    })

    afterEach(async () => {
        console.log('Cleanup after each test')
    })

    it('Import TV Show folder', async function() {
        if(slowdown) {
            this.timeout(60 * 1000)
        }
        
        const testMediaFolder = path.join(os.tmpdir(), 'smm-test-media', 'media', '古见同学有交流障碍症')

        if(slowdown) {
            await delay(10 * 1000)
        }

        console.log('Importing media folder:', testMediaFolder)
        // Trigger the import
        await Menu.importMediaFolder({
            type: 'tvshow',
            folderPathInPlatformFormat: testMediaFolder,
            traceId: 'e2eTest:Import Media Folder'
        })

        if(slowdown) {
            await delay(10 * 1000)
        }

        // Import media folder will trigger async media folder initialization, wait for it to complete
        await delay(5 * 1000)

        // Wait for the folder to appear in the sidebar
        const folderName = '古见同学有交流障碍症'
        console.log(`Waiting for folder "${folderName}" to appear in sidebar...`)

        const isDisplayed = await Sidebar.waitForFolder(folderName, 60000)

        // Verify the folder is displayed
        expect(isDisplayed).toBe(true)
        console.log(`Folder "${folderName}" is now displayed in sidebar`)

        // Assert title in ImmersiveSearchbox is the TV show name
        const immersiveInput = await $('[data-testid="immersive-input"]')
        await immersiveInput.waitForDisplayed({ timeout: 15000 })
        await browser.waitUntil(
            async () => (await immersiveInput.getValue()) === folderName,
            { timeout: 10000, timeoutMsg: `ImmersiveSearchbox title did not become "${folderName}"` }
        )
        expect(await immersiveInput.getValue()).toBe(folderName)

        if(slowdown) {
            await delay(10 * 1000)
        }
    })
})

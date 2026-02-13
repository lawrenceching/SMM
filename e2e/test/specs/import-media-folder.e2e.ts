import { expect } from '@wdio/globals'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import Menu from '../componentobjects/Menu'
import Sidebar from '../componentobjects/Sidebar'
import { before, beforeEach, afterEach } from 'mocha'
import { createBeforeHook } from '../lib/testbed'

const __filename = fileURLToPath(import.meta.url)

describe('Import Media Folder', () => {

    before(createBeforeHook({ setupMediaFolders: true }))

    beforeEach(async () => {
        console.log('Setup before each test')
    })

    afterEach(async () => {
        console.log('Cleanup after each test')
    })

    it('Import TV Show folder', async () => {
        const testMediaFolder = path.join(process.tmpdir(), 'smm-test-media', 'media', '古见同学有交流障碍症')
        console.log('Importing media folder:', testMediaFolder)

        // Trigger the import
        await Menu.importMediaFolder({
            type: 'tvshow',
            folderPathInPlatformFormat: testMediaFolder,
            traceId: 'e2eTest:Import Media Folder'
        })

        // Wait for the folder to appear in the sidebar
        const folderName = '古见同学有交流障碍症'
        console.log(`Waiting for folder "${folderName}" to appear in sidebar...`)

        const isDisplayed = await Sidebar.waitForFolder(folderName, 60000)

        // Verify the folder is displayed
        expect(isDisplayed).toBe(true)
        console.log(`Folder "${folderName}" is now displayed in sidebar`)
    })
})

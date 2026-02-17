import { expect, browser } from '@wdio/globals'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import Sidebar from '../componentobjects/Sidebar'
import RenameDialog from '../componentobjects/RenameDialog'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const slowdown = process.env.SLOWDOWN === 'true'

let mediaFolderPaths: string[] = []

describe('ContextMenu Rename', () => {

    before(async () => {
        await createBeforeHook({ setupMediaFolders: true })()

        mediaFolderPaths = [];
        mediaFolderPaths.push(path.join(os.tmpdir(), 'smm-test-media', 'media', '古见同学有交流障碍症'))
        mediaFolderPaths.push(path.join(os.tmpdir(), 'smm-test-media', 'media', '夺命小丑2_高清'))
        mediaFolderPaths.push(path.join(os.tmpdir(), 'smm-test-media', 'media', 'music'))

        // Import media folder only when the folder didn't display on Sidebar
        const folderNames = ['古见同学有交流障碍症', '夺命小丑2_高清', 'music']
        const folderTypes: Array<'tvshow' | 'movie' | 'music'> = ['tvshow', 'movie', 'music']

        for (let i = 0; i < mediaFolderPaths.length; i++) {
            const folderName = folderNames[i]!
            const isDisplayed = await Sidebar.isFolderDisplayed(folderName)

            if (!isDisplayed) {
                console.log(`Folder "${folderName}" not displayed, importing...`)
                await Menu.importMediaFolder({
                    type: folderTypes[i]!,
                    folderPathInPlatformFormat: mediaFolderPaths[i]!,
                    traceId: 'e2eTest:Import Media Folder'
                })
            } else {
                console.log(`Folder "${folderName}" already displayed, skipping import`)
            }
        }

        // Import media folder will trigger async media folder initialization, wait for it to complete
        await delay(5 * 1000)
    })

    it('should open rename dialog from context menu and handle cancel', async function() {
        if(slowdown) {
            this.timeout(120 * 1000)
        }

        // Wait for all folders to be loaded in the sidebar
        console.log('Waiting for folders to load in sidebar...')
        const foldersLoaded = await Sidebar.waitForFoldersToLoad(3, 60000)
        expect(foldersLoaded).toBe(true)
        console.log('Folders loaded successfully')

        if(slowdown) {
            await delay(3 * 1000)
        }

        // Clear any previous search to ensure all folders are visible
        await Sidebar.clearSearch()
        await delay(500)

        // Test: Open rename dialog from context menu
        const folderName = 'music'
        const newFolderName = 'music_renamed'

        console.log(`Testing rename dialog for folder "${folderName}"`)

        // Verify the folder exists
        let folderExists = await Sidebar.isFolderDisplayed(folderName)
        expect(folderExists).toBe(true)

        // Right-click on the folder to open context menu
        console.log(`Right-clicking on folder "${folderName}"...`)
        await Sidebar.rightClickFolder(folderName)

        if(slowdown) {
            await delay(1 * 1000)
        }

        // Verify context menu is displayed
        const contextMenuDisplayed = await Sidebar.waitForContextMenu()
        expect(contextMenuDisplayed).toBe(true)
        console.log('Context menu displayed')

        if(slowdown) {
            await delay(1 * 1000)
        }

        // Click on "Rename" option
        console.log('Clicking Rename option...')
        await Sidebar.clickContextMenuRename()

        if(slowdown) {
            await delay(1 * 1000)
        }

        // Verify rename dialog is displayed
        const dialogDisplayed = await RenameDialog.waitForDisplayed()
        expect(dialogDisplayed).toBe(true)
        console.log('Rename dialog displayed')

        // Verify the input field has the original folder name
        const inputValue = await RenameDialog.getInputValue()
        console.log('Initial input value:', inputValue)
        expect(inputValue).toBe(folderName)

        if(slowdown) {
            await delay(2 * 1000)
        }

        // Test: Verify confirm button is disabled when name hasn't changed
        let confirmDisabled = await RenameDialog.isConfirmDisabled()
        expect(confirmDisabled).toBe(true)
        console.log('Confirm button is disabled when name unchanged (expected)')

        // Enter a new folder name
        console.log(`Entering new name: "${newFolderName}"...`)
        await RenameDialog.setInputValue(newFolderName)

        if(slowdown) {
            await delay(1 * 1000)
        }

        // Verify the input value changed
        const newInputValue = await RenameDialog.getInputValue()
        expect(newInputValue).toBe(newFolderName)

        // Verify confirm button is enabled (not disabled since name changed)
        confirmDisabled = await RenameDialog.isConfirmDisabled()
        expect(confirmDisabled).toBe(false)
        console.log('Confirm button is enabled after name change (expected)')

        if(slowdown) {
            await delay(2 * 1000)
        }

        // Test: Cancel the rename by clicking cancel button
        console.log('Clicking cancel to close dialog without saving...')
        await RenameDialog.clickCancel()

        // Wait for the dialog to close
        await RenameDialog.waitForClosed()
        console.log('Rename dialog closed via cancel')

        // Verify the original folder name still exists (rename was cancelled)
        folderExists = await Sidebar.isFolderDisplayed(folderName)
        expect(folderExists).toBe(true)
        console.log(`Folder "${folderName}" still exists after cancel (expected)`)

        console.log('Rename context menu test completed successfully')

        if(slowdown) {
            await delay(5 * 1000)
        }
    })
})

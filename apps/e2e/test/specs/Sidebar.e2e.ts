import { expect } from '@wdio/globals'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'
import Menu from '../componentobjects/Menu'
import Sidebar from '../componentobjects/Sidebar'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const slowdown = process.env.SLOWDOWN === 'true'

let mediaFolderPaths: string[] = []

describe('Sidebar', () => {

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


    it('Sorting - should sort folders alphabetically and reverse alphabetically', async function() {
        if(slowdown) {
            this.timeout(60 * 1000)
        }

        // Wait for all folders to be loaded in the sidebar
        console.log('Waiting for folders to load in sidebar...')
        const foldersLoaded = await Sidebar.waitForFoldersToLoad(3, 60000)
        expect(foldersLoaded).toBe(true)
        console.log('Folders loaded successfully')

        if(slowdown) {
            await delay(5 * 1000)
        }

        // Verify sort button is displayed
        const sortButtonDisplayed = await Sidebar.isSortButtonDisplayed()
        expect(sortButtonDisplayed).toBe(true)

        // Get initial folder order
        const initialOrder = await Sidebar.getFolderNamesInOrder()
        console.log('Initial folder order:', initialOrder)
        expect(initialOrder.length).toBeGreaterThanOrEqual(3)

        // Test alphabetical sort
        console.log('Testing alphabetical sort...')
        await Sidebar.selectAlphabeticalSort()

        if(slowdown) {
            await delay(2 * 1000)
        }

        const alphabeticalOrder = await Sidebar.getFolderNamesInOrder()
        console.log('Alphabetical order:', alphabeticalOrder)

        // Verify the folders are sorted alphabetically (A-Z)
        const alphabeticalSorted = [...alphabeticalOrder].sort((a, b) => a.localeCompare(b, 'zh-CN'))
        expect(alphabeticalOrder).toEqual(alphabeticalSorted)

        if(slowdown) {
            await delay(5 * 1000)
        }

        // Test reverse alphabetical sort
        console.log('Testing reverse alphabetical sort...')
        await Sidebar.selectReverseAlphabeticalSort()

        if(slowdown) {
            await delay(2 * 1000)
        }

        const reverseOrder = await Sidebar.getFolderNamesInOrder()
        console.log('Reverse alphabetical order:', reverseOrder)

        // Verify the folders are sorted in reverse alphabetical order (Z-A)
        const reverseSorted = [...reverseOrder].sort((a, b) => b.localeCompare(a, 'zh-CN'))
        expect(reverseOrder).toEqual(reverseSorted)

        // Verify the reverse order is the opposite of alphabetical order
        expect(reverseOrder).toEqual([...alphabeticalOrder].reverse())

        if(slowdown) {
            await delay(5 * 1000)
        }
    })
})

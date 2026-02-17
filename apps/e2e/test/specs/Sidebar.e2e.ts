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

    it('Search - should filter folders by search query', async function() {
        if(slowdown) {
            this.timeout(60 * 1000)
        }

        // Wait for all folders to be loaded in the sidebar
        console.log('Waiting for folders to load in sidebar...')
        const foldersLoaded = await Sidebar.waitForFoldersToLoad(3, 60000)
        expect(foldersLoaded).toBe(true)
        console.log('Folders loaded successfully')

        if(slowdown) {
            await delay(3 * 1000)
        }

        // Verify search input is displayed
        const searchInputDisplayed = await Sidebar.isSearchInputDisplayed()
        expect(searchInputDisplayed).toBe(true)

        // Get initial folder count (should have all 3 folders)
        const initialFolderCount = await Sidebar.getFolderCount()
        console.log('Initial folder count:', initialFolderCount)
        expect(initialFolderCount).toBeGreaterThanOrEqual(3)

        // Test 1: Search for a folder that exists (Chinese characters)
        console.log('Testing search for "古见"...')
        await Sidebar.search('古见')

        if(slowdown) {
            await delay(2 * 1000)
        }

        let folderNames = await Sidebar.getFolderNamesInOrder()
        console.log('Folders matching "古见":', folderNames)
        expect(folderNames.length).toBe(1)
        expect(folderNames[0]).toContain('古见同学有交流障碍症')

        if(slowdown) {
            await delay(3 * 1000)
        }

        // Test 2: Search for another folder (partial match)
        console.log('Testing search for "小丑"...')
        await Sidebar.search('小丑')

        if(slowdown) {
            await delay(2 * 1000)
        }

        folderNames = await Sidebar.getFolderNamesInOrder()
        console.log('Folders matching "小丑":', folderNames)
        expect(folderNames.length).toBe(1)
        expect(folderNames[0]).toContain('夺命小丑2_高清')

        if(slowdown) {
            await delay(3 * 1000)
        }

        // Test 3: Search for English folder name
        console.log('Testing search for "music"...')
        await Sidebar.search('music')

        if(slowdown) {
            await delay(2 * 1000)
        }

        folderNames = await Sidebar.getFolderNamesInOrder()
        console.log('Folders matching "music":', folderNames)
        expect(folderNames.length).toBe(1)
        expect(folderNames[0]).toBe('music')

        if(slowdown) {
            await delay(3 * 1000)
        }

        // Test 4: Search for non-existent folder
        console.log('Testing search for non-existent folder...')
        await Sidebar.search('nonexistentfolder12345')

        if(slowdown) {
            await delay(2 * 1000)
        }

        // Should show empty state or no folders
        const emptyState = await Sidebar.isEmptyStateMessageDisplayed()
        const folderCount = await Sidebar.getFolderCount()
        console.log('Empty state displayed:', emptyState, 'Folder count:', folderCount)
        expect(emptyState || folderCount === 0).toBe(true)

        if(slowdown) {
            await delay(3 * 1000)
        }

        // Test 5: Clear search to show all folders again
        console.log('Clearing search...')
        await Sidebar.clearSearch()

        if(slowdown) {
            await delay(2 * 1000)
        }

        // Wait for folders to be displayed again after clearing search
        console.log('Waiting for folders to reload after clearing search...')
        const foldersReloaded = await Sidebar.waitForFoldersToLoad(3, 10000)
        expect(foldersReloaded).toBe(true)

        const finalFolderCount = await Sidebar.getFolderCount()
        console.log('Folder count after clearing search:', finalFolderCount)
        expect(finalFolderCount).toBeGreaterThanOrEqual(3)

        // Verify search input is empty
        const searchValue = await Sidebar.getSearchValue()
        expect(searchValue).toBe('')

        if(slowdown) {
            await delay(5 * 1000)
        }
    })
})

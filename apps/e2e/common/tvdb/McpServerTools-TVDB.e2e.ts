import { expect, browser } from '@wdio/globals'
import { cleanup, importFolderWithMediaMetadata, setup } from 'test/lib/testbed'
import mcpClient from 'test/lib/McpClient'
import { folder3 } from 'test/actions/import-folders'
import {
    clearFolderViaBrowser,
    createTestFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import Sidebar from 'test/componentobjects/Sidebar'
import StatusBar from 'test/componentobjects/StatusBar'
import { cleanupMcpTest, createMcpSpecContext, setupMcpTest } from 'test/lib/mcpSpecShared'

describe('MCP Server Tools - TVDB', () => {
    const ctx = createMcpSpecContext()
    let testFolder = ''

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            openBrowserPage: true,
        })
        await setupMcpTest()

        testFolder = await resolveSmmTestFolderViaBrowser()
        await clearFolderViaBrowser(testFolder)
    })

    afterEach(async () => {
        await cleanupMcpTest()
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: false,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('GetMediaMetadataTool should return cached metadata for folder', async function () {
        this.timeout(2 * 60 * 1000)

        const folder = {
            ...folder3,
            folderName: '我推的孩子 {tvdbid=421069}',
        }
        const folderPath = await createTestFolderViaBrowser(testFolder, folder)
        folder.path = folderPath

        await importFolderWithMediaMetadata(folder, '我推的孩子.metadata.json', (mediaMetadata) => {
            mediaMetadata.mediaFiles = []
            return mediaMetadata
        })

        await browser.refresh()
        await StatusBar.appVersion.waitForDisplayed()

        await Sidebar.waitForFolderName(folder.folderName, 30000)
        await Sidebar.clickFolder(folder.folderName)

        await browser.pause(1000)

        console.log(`[TVDB-e2e] calling getMediaMetadata with mcpAddress=${ctx.mcpAddress}`)

        const r = await mcpClient.getMediaMetadata(ctx.clientCwd, ctx.mcpAddress, {
            mediaFolderPath: folder.path!,
        })
        const json = String(JSON.stringify(r))
        expect(json).toContain(folder.mediaName!)
    })
})

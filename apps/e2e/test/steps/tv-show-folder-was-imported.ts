import { registerStep } from '../lib/gherkin'
import { folder1 } from 'test/actions/import-folders'
import { importFolderWithMediaMetadata } from '../lib/testbed'
import {
    createTestFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import page from 'test/pageobjects/page'
import Sidebar from 'test/componentobjects/Sidebar'

registerStep('TV show folder "xxx" was imported', async (ctx, args) => {
    const [folderName] = args

    const base = await resolveSmmTestFolderViaBrowser()
    const folder = {
        ...folder1,
        folderName: folderName!,
    }
    const folderPath = await createTestFolderViaBrowser(base, folder)
    folder.path = folderPath

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
        ;(mediaMetadata as { tvShow?: unknown }).tvShow = undefined
        return mediaMetadata
    })

    ctx._folder = folder
    ctx._folderName = folderName

    await page.refresh()
    await Sidebar.waitForFolderName(folder.folderName, 10000)
})

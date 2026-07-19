import { registerStep } from '../lib/gherkin'
import { folder1 } from 'test/actions/import-folders'
import { importFolderWithMediaMetadata } from '../lib/testbed'
import {
    createTestFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import page from 'test/pageobjects/page'
import Sidebar from 'test/componentobjects/Sidebar'

/**
 * Imports a TV show folder with `mediaFiles: []`, so the rule-based recognize
 * button has work to do when the user clicks it. Unlike
 * `TV show folder "xxx" was recognized with partial coverage`, no file is renamed
 * — every episode in the folder can still be matched by the rule-based recognizer.
 */
registerStep('TV show folder "xxx" was imported with no media files', async (ctx, args) => {
    const [folderName] = args
    const base = await resolveSmmTestFolderViaBrowser()
    const folder = {
        ...folder1,
        folderName: folderName!,
    }
    const folderPath = await createTestFolderViaBrowser(base, folder)
    folder.path = folderPath

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
        mediaMetadata.mediaFiles = []
        return mediaMetadata
    })

    ctx._folder = folder
    ctx._folderName = folderName

    await page.open()
    await Sidebar.waitForFolderName(folder.folderName, 10000)
})

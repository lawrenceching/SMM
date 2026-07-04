import { registerStep, getStepContext } from '../lib/gherkin'
import { createFolderInTestFolder, folder1 } from 'test/actions/import-folders'
import { importFolderWithMediaMetadata } from '../lib/testbed'
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

    const folder = createFolderInTestFolder({
        ...folder1,
        folderName,
    })

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
        mediaMetadata.mediaFiles = []
        return mediaMetadata
    })

    ctx._folder = folder
    ctx._folderName = folderName

    await page.open()
    await Sidebar.waitForFolderName(folder.folderName, 10000)
})
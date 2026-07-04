import { registerStep, getStepContext } from '../lib/gherkin'
import { createFolderInTestFolder, folder1, renameFileInFolder } from 'test/actions/import-folders'
import { importFolderWithMediaMetadata } from '../lib/testbed'
import page from 'test/pageobjects/page'
import Sidebar from 'test/componentobjects/Sidebar'

/**
 * Imports and "recognizes" a TV show folder whose rule-based recognition can only
 * cover a partial set of episodes. This forces the FloatingPrompt to render the
 * "not all episodes recognized" hint icon. Achieved by renaming S01E03.mkv so the
 * rule-based recognizer can only match S01E01 and S01E02.
 */
registerStep('TV show folder "xxx" was recognized with partial coverage', async (ctx, args) => {
    const [folderName] = args

    const folder = createFolderInTestFolder({
        ...folder1,
        folderName,
    })
    renameFileInFolder(folder.folderName, 'S01E03.mkv', 'S01E03-renamed.mkv')

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
        mediaMetadata.mediaFiles = []
        return mediaMetadata
    })

    ctx._folder = folder
    ctx._folderName = folderName

    await page.open()
    await Sidebar.waitForFolderName(folder.folderName, 10000)
})

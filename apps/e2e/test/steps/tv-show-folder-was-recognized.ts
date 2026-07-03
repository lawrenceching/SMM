import { registerStep, getStepContext } from '../lib/gherkin'
import { createFolderInTestFolder, folder1 } from 'test/actions/import-folders'
import { importFolderWithMediaMetadata } from '../lib/testbed'
import page from 'test/pageobjects/page'
import Sidebar from 'test/componentobjects/Sidebar'

registerStep('TV show folder "xxx" was recognized', async (ctx, args) => {
    const [folderName] = args

    const folder = createFolderInTestFolder({
        ...folder1,
        folderName,
    })

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json')

    ctx._folder = folder
    ctx._folderName = folderName

    await page.open()
    await Sidebar.waitForFolderName(folder.folderName, 10000)
})

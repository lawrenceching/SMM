import { registerStep, getStepContext } from '../lib/gherkin'
import { createFolderInTestFolder, folder1 } from 'test/actions/import-folders'
import { importFolderWithMediaMetadata } from '../lib/testbed'
import page from 'test/pageobjects/page'
import Sidebar from 'test/componentobjects/Sidebar'

registerStep('TV show folder "xxx" was recognized', async (ctx, args) => {
    const [folderName] = args

    console.log(`[DIAG] step: "TV show folder was recognized" START folderName="${folderName}"`)

    const folder = createFolderInTestFolder({
        ...folder1,
        folderName,
    })

    const t0 = Date.now()
    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json')
    console.log(`[DIAG] step: "TV show folder was recognized" importFolderWithMediaMetadata done in ${Date.now() - t0}ms`)

    ctx._folder = folder
    ctx._folderName = folderName

    // Disk writes via importFolderWithMediaMetadata do not update the UI store;
    // reload so UIMediaFolderStoreInitializer picks up the new folder.
    await page.open()

    const t1 = Date.now()
    console.log(`[DIAG] step: "TV show folder was recognized" calling waitForFolderName "${folder.folderName}"`)
    await Sidebar.waitForFolderName(folder.folderName, 10000)
    console.log(`[DIAG] step: "TV show folder was recognized" waitForFolderName done in ${Date.now() - t1}ms`)
})

registerStep('TV show folder with three episodes was imported and recognized', async (ctx) => {
    const folder = createFolderInTestFolder({
        ...folder1,
    })

    const t0 = Date.now()
    console.log(`[DIAG] step: "TV show folder with three episodes" importFolderWithMediaMetadata START`)
    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json')
    console.log(`[DIAG] step: "TV show folder with three episodes" importFolderWithMediaMetadata done in ${Date.now() - t0}ms`)

    ctx._folder = folder
    ctx._folderName = folder.folderName

    await page.open()

    const t1 = Date.now()
    console.log(`[DIAG] step: "TV show folder with three episodes" calling waitForFolderName "${folder.folderName}"`)
    await Sidebar.waitForFolderName(folder.folderName, 10000)
    console.log(`[DIAG] step: "TV show folder with three episodes" waitForFolderName done in ${Date.now() - t1}ms`)
})

import { browser } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import {
    createAndImportFolderViaBrowser,
} from 'test/lib/browser-fs'
import Sidebar from '../componentobjects/Sidebar'

registerStep('unknown TV show folder was imported', async (ctx) => {
    const randomFolderName = `Unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const folder = {
        folderName: randomFolderName,
        files: [] as string[],
        type: 'tvshow' as const,
    }
    const folderPath = await createAndImportFolderViaBrowser(
        folder,
        'e2eTest:Import Media Folder Search TV Show',
    )

    await browser.pause(1000)

    const isDisplayed = await Sidebar.waitForFolderName(randomFolderName, 60000)
    if (!isDisplayed) {
        throw new Error(`Folder "${randomFolderName}" did not appear in sidebar`)
    }

    ctx._folder = { path: folderPath, folderName: randomFolderName }
    ctx._folderName = randomFolderName
})

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { browser } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import Menu from '../componentobjects/Menu'
import Sidebar from '../componentobjects/Sidebar'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

registerStep('unknown TV show folder was imported', async (ctx) => {
    const randomFolderName = `Unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const testMediaFolder = path.join(mediaDir, randomFolderName)
    fs.mkdirSync(testMediaFolder, { recursive: true })

    await Menu.importMediaFolder({
        type: 'tvshow',
        folderPathInPlatformFormat: testMediaFolder,
        traceId: 'e2eTest:Import Media Folder Search TV Show',
    })

    await browser.pause(1000)

    const isDisplayed = await Sidebar.waitForFolderName(randomFolderName, 60000)
    if (!isDisplayed) {
        throw new Error(`Folder "${randomFolderName}" did not appear in sidebar`)
    }

    ctx._folder = { path: testMediaFolder, folderName: randomFolderName }
    ctx._folderName = randomFolderName
})

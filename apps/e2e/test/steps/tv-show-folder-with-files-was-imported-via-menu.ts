import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { browser } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import Menu from '../componentobjects/Menu'
import Sidebar from '../componentobjects/Sidebar'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

registerStep('TV show folder "xxx" with files "xxx" was imported via menu', async (ctx, args) => {
    const [folderName, filesCsv] = args
    const files = filesCsv.split(',').map((f) => f.trim()).filter(Boolean)
    const testMediaFolder = path.join(mediaDir, folderName)
    fs.mkdirSync(testMediaFolder, { recursive: true })

    for (const file of files) {
        fs.writeFileSync(path.join(testMediaFolder, file), '')
    }

    await Menu.importMediaFolder({
        type: 'tvshow',
        folderPathInPlatformFormat: testMediaFolder,
        traceId: 'e2eTest:Import TV show folder via menu',
    })

    await browser.pause(3000)

    const isDisplayed = await Sidebar.waitForFolderName(folderName, 60000)
    if (!isDisplayed) {
        throw new Error(`Folder "${folderName}" did not appear in sidebar`)
    }

    ctx._folder = { path: testMediaFolder, folderName }
    ctx._folderName = folderName
})

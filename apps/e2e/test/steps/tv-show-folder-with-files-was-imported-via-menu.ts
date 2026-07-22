import { Path } from '@smm/core'
import { registerStep } from '../lib/gherkin'
import { importFolderWithMediaMetadata } from '../lib/testbed'
import {
    createTestFolderViaBrowser,
    joinPlatformPath,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import page from 'test/pageobjects/page'
import Sidebar from 'test/componentobjects/Sidebar'

const VIDEO_EXT = /\.(mp4|mkv|avi|m4v|mov|wmv|ts|m2ts)$/i
const EPISODE_RE = /[Ss](\d+)[Ee](\d+)/

/**
 * Create folder fixtures via browser protocol and import with seeded metadata.
 * (Step name keeps "via menu" for Gherkin compatibility with existing specs.)
 */
registerStep('TV show folder "xxx" with files "xxx" was imported via menu', async (ctx, args) => {
    const [folderName, filesCsv] = args
    const files = filesCsv.split(',').map((f) => f.trim()).filter(Boolean)
    const base = await resolveSmmTestFolderViaBrowser()
    const folder = {
        folderName: folderName!,
        files,
        type: 'tvshow' as const,
    }
    const folderPath = await createTestFolderViaBrowser(base, folder)

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
        mediaMetadata.mediaFiles = files
            .filter((name) => VIDEO_EXT.test(name))
            .map((name) => {
                const match = name.match(EPISODE_RE)
                const absolutePath = Path.posix(joinPlatformPath(folderPath, name))
                if (match) {
                    return {
                        absolutePath,
                        seasonNumber: Number.parseInt(match[1]!, 10),
                        episodeNumber: Number.parseInt(match[2]!, 10),
                    }
                }
                return { absolutePath }
            })
        return mediaMetadata
    })

    await page.refresh()
    const isDisplayed = await Sidebar.waitForFolderName(folderName!, 60000)
    if (!isDisplayed) {
        throw new Error(`Folder "${folderName}" did not appear in sidebar`)
    }

    ctx._folder = { path: folderPath, folderName }
    ctx._folderName = folderName
})

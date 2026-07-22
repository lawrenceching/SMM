import { expect } from '@wdio/globals'
import { setup, cleanup } from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    fileExistsViaBrowser,
    getFileSizeViaBrowser,
    joinPlatformPath,
    listFilesViaBrowser,
    readFileViaBrowser,
    resolveSmmTestFolderViaBrowser,
    basenamePlatformPath,
} from 'test/lib/browser-fs'
import { given, when, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'

import { testbedOs } from 'test/lib/e2e-platform'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

async function getImagePathWithPrefix(folderPath: string, prefix: string): Promise<string | undefined> {
    const items = await listFilesViaBrowser(folderPath)
    const match = items.find((item) => {
        if (item.isDirectory) return false
        const name = basenamePlatformPath(item.path)
        return (
            name.startsWith(`${prefix}.`) &&
            IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
        )
    })
    return match?.path
}

/**
 * @supports local, Electron, HarmonyOS
 */
describe('Scrape Failover', () => {
    let testFolder = ''

    beforeEach(async () => {
        resetStepContext()
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            openBrowserPage: true,
            os: testbedOs,
        })

        testFolder = await resolveSmmTestFolderViaBrowser()
        await clearFolderViaBrowser(testFolder)
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('failover to another TMDB asset server', async function () {
        this.timeout(60 * 1000)

        await given('prefer media language is "zh-CN"')
        await given('TV show folder with TMDB id 84666 and one episode was imported')
        await when('folder from context was selected')
        await when('debug override default tmdb asset server host is "wronghost.tmdb.local"')
        await when('I click "Scrape" button in TV show panel')
        await then('scrape dialog shows all tasks pending')
        await when('I start scrape')
        await then('scrape dialog shows all TV show tasks completed')
        await when('I close scrape dialog')

        await then('TMDB scrape outputs are written to disk with failover', async () => {
            const folder = getStepContext()._folder as { path: string }
            const thumbnailPath = joinPlatformPath(folder.path, 'S01E01.jpg')
            expect(await fileExistsViaBrowser(thumbnailPath)).toBe(true)
            expect(await getFileSizeViaBrowser(thumbnailPath)).toBeGreaterThan(0)

            const posterPath = await getImagePathWithPrefix(folder.path, 'poster')
            const fanartPath = await getImagePathWithPrefix(folder.path, 'fanart')
            expect(posterPath).toBeDefined()
            expect(fanartPath).toBeDefined()
            expect(await getFileSizeViaBrowser(posterPath!)).toBeGreaterThan(0)
            expect(await getFileSizeViaBrowser(fanartPath!)).toBeGreaterThan(0)

            const tvshowNfoPath = joinPlatformPath(folder.path, 'tvshow.nfo')
            expect(await fileExistsViaBrowser(tvshowNfoPath)).toBe(true)
            expect(await readFileViaBrowser(tvshowNfoPath)).toContain('天使降临到我身边')
        })
    })
})

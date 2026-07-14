import * as fs from 'node:fs'
import { expect } from '@wdio/globals'
import { join } from 'path'
import { cleanup, setup } from '../../lib/testbed'
import { given, when, then, resetStepContext, getStepContext } from '../../lib/gherkin'
import '../../steps'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

function getImagePathWithPrefix(folderPath: string, prefix: string): string | undefined {
    const files = fs.readdirSync(folderPath)
    const fileName = files.find(
        (file) => file.startsWith(`${prefix}.`) && IMAGE_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext)),
    )
    return fileName ? join(folderPath, fileName) : undefined
}

describe('Scrape Failover', () => {

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
        })
    })

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            openBrowserPage: true,
        })
        resetStepContext()
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
            const thumbnailPath = join(folder.path, 'S01E01.jpg')
            expect(fs.existsSync(thumbnailPath)).toBe(true)
            expect(fs.statSync(thumbnailPath).size).toBeGreaterThan(0)

            const posterPath = getImagePathWithPrefix(folder.path, 'poster')
            const fanartPath = getImagePathWithPrefix(folder.path, 'fanart')
            expect(posterPath).toBeDefined()
            expect(fanartPath).toBeDefined()
            expect(fs.statSync(posterPath!).size).toBeGreaterThan(0)
            expect(fs.statSync(fanartPath!).size).toBeGreaterThan(0)

            const tvshowNfoPath = join(folder.path, 'tvshow.nfo')
            expect(fs.existsSync(tvshowNfoPath)).toBe(true)
            expect(fs.readFileSync(tvshowNfoPath, 'utf-8')).toContain('天使降临到我身边')
        })
    })

})

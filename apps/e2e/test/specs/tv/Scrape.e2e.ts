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

async function checkTvdbConnection(): Promise<boolean> {
    const url = 'https://artworks.thetvdb.com/banners/v4/series/421069/backgrounds/6464dac0a7336.jpg'
    const timeoutMs = 5000

    try {
        const headController = new AbortController()
        const headTimeoutId = setTimeout(() => headController.abort(), timeoutMs)
        await fetch(url, {
            method: 'HEAD',
            signal: headController.signal,
        })
        clearTimeout(headTimeoutId)
        return true
    } catch {
        try {
            const getController = new AbortController()
            const getTimeoutId = setTimeout(() => getController.abort(), timeoutMs)
            const response = await fetch(url, {
                method: 'GET',
                signal: getController.signal,
            })
            clearTimeout(getTimeoutId)
            await response.body?.cancel().catch(() => undefined)
            return true
        } catch {
            return false
        }
    }
}

describe('Scrape', () => {

    before(async function () {
        const tvdbConnectionOk = await checkTvdbConnection()
        if (!tvdbConnectionOk) {
            this.skip()
        }
    })

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

    it('scrape from TMDB for TV Show', async function () {
        this.timeout(60 * 1000)

        await given('prefer media language is "zh-CN"')
        await given('TV show folder with TMDB id 84666 and one episode was imported')
        await when('folder from context was selected')
        await when('I click "Scrape" button in TV show panel')
        await then('scrape dialog shows all tasks pending')
        await when('I start scrape')
        await then('scrape dialog shows all TV show tasks completed')
        await when('I close scrape dialog')

        await then('TMDB TV show scrape outputs are written to disk', async () => {
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
            expect(fs.existsSync(join(folder.path, 'S01E02.jpg'))).toBe(false)

            const tvshowNfoPath = join(folder.path, 'tvshow.nfo')
            expect(fs.existsSync(tvshowNfoPath)).toBe(true)
            expect(fs.readFileSync(tvshowNfoPath, 'utf-8')).toContain('天使降临到我身边')

            const s01e01EpisodeNfoPath = join(folder.path, 'S01E01.nfo')
            expect(fs.existsSync(s01e01EpisodeNfoPath)).toBe(true)
            expect(fs.statSync(s01e01EpisodeNfoPath).size).toBeGreaterThan(0)
            expect(fs.readFileSync(s01e01EpisodeNfoPath, 'utf-8')).toContain('心里痒痒的感觉')
        })
    })

    it('scrape from TVDB for TV Show', async function () {
        this.timeout(60 * 1000)

        await given('prefer media language is "zh-CN"')
        await given('TV show folder with TVDB id 355969 and one episode was imported')
        await when('folder from context was selected')
        await when('I click "Scrape" button in TV show panel')
        await then('scrape dialog shows all tasks pending')
        await when('I start scrape')
        await then('scrape dialog shows all TV show tasks completed')
        await when('I close scrape dialog')

        await then('TVDB TV show scrape outputs are written to disk', async () => {
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
            expect(fs.existsSync(join(folder.path, 'S01E02.jpg'))).toBe(false)

            const tvshowNfoPath = join(folder.path, 'tvshow.nfo')
            expect(fs.existsSync(tvshowNfoPath)).toBe(true)
            expect(fs.readFileSync(tvshowNfoPath, 'utf-8')).toContain('天使降临到了我身边')

            const s01e01EpisodeNfoPath = join(folder.path, 'S01E01.nfo')
            expect(fs.existsSync(s01e01EpisodeNfoPath)).toBe(true)
            expect(fs.statSync(s01e01EpisodeNfoPath).size).toBeGreaterThan(0)
            expect(fs.readFileSync(s01e01EpisodeNfoPath, 'utf-8')).toContain('心裏癢癢的感覺')
            expect(fs.existsSync(join(folder.path, 'S01E02.nfo'))).toBe(false)
        })
    })

    it('scrape from TMDB for Movie', async function () {
        this.timeout(120 * 1000)

        await given('prefer media language is "zh-CN"')
        await given('movie folder with TMDB id 552524 was imported')
        await when('folder from context was selected')
        await when('I click "Scrape" button in overview panel')
        await then('scrape dialog shows movie tasks pending')
        await when('I start scrape')
        await then('scrape dialog shows movie tasks completed')
        await when('I close scrape dialog')

        await then('TMDB movie scrape outputs are written to disk', async () => {
            const folder = getStepContext()._folder as { path: string }
            const posterPath = getImagePathWithPrefix(folder.path, 'poster')
            const fanartPath = getImagePathWithPrefix(folder.path, 'fanart')
            expect(posterPath).toBeDefined()
            expect(fanartPath).toBeDefined()
            expect(fs.statSync(posterPath!).size).toBeGreaterThan(0)
            expect(fs.statSync(fanartPath!).size).toBeGreaterThan(0)

            const movieNfoPath = join(folder.path, 'movie.nfo')
            expect(fs.existsSync(movieNfoPath)).toBe(true)
            expect(fs.statSync(movieNfoPath).size).toBeGreaterThan(0)
            expect(fs.readFileSync(movieNfoPath, 'utf-8')).toContain('<tmdbid>552524</tmdbid>')
        })
    })

    it('scrape from TVDB for Movie', async function () {
        this.timeout(120 * 1000)

        await given('prefer media language is "zh-CN"')
        await given('movie folder with TVDB id 116 was imported')
        await when('folder from context was selected')
        await when('I click "Scrape" button in overview panel')
        await then('scrape dialog shows movie tasks pending')
        await when('I start scrape')
        await then('scrape dialog shows movie tasks completed')
        await when('I close scrape dialog')

        await then('TVDB movie scrape outputs are written to disk', async () => {
            const folder = getStepContext()._folder as { path: string }
            const posterPath = getImagePathWithPrefix(folder.path, 'poster')
            const fanartPath = getImagePathWithPrefix(folder.path, 'fanart')
            expect(posterPath).toBeDefined()
            expect(fanartPath).toBeDefined()
            expect(fs.statSync(posterPath!).size).toBeGreaterThan(0)
            expect(fs.statSync(fanartPath!).size).toBeGreaterThan(0)

            const movieNfoPath = join(folder.path, 'movie.nfo')
            expect(fs.existsSync(movieNfoPath)).toBe(true)
            expect(fs.statSync(movieNfoPath).size).toBeGreaterThan(0)
            const movieNfoText = fs.readFileSync(movieNfoPath, 'utf-8')
            expect(movieNfoText.includes('<tvdbid>116</tvdbid>') || movieNfoText.includes('type="tvdb"')).toBe(true)
        })
    })

})

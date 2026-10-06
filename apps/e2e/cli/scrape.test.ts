import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { $ } from 'bun'
import { Path } from '@smm/utils/path'
import { folder1, folder2, folder5 } from '../test/actions/import-folders'
import { setup, cleanup, bin } from './base'
import { createAndImportInitializedFolder, requiredEnv } from './helpers'
import type { MediaMetadata } from '@smm/types'
import type { TestFolder } from '@smm/test'

const FIVE_MINUTES_MS = 5 * 60 * 1000
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

function findImageWithPrefix(dir: string, prefix: string): string | undefined {
    return readdirSync(dir).find((name) => {
        if (!name.startsWith(`${prefix}.`)) return false
        return IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
    })
}

function expectNonEmptyFile(filePath: string): void {
    expect(existsSync(filePath)).toBe(true)
    expect(statSync(filePath).size).toBeGreaterThan(0)
}

function expectPosterAndFanart(folderPath: string): void {
    const poster = findImageWithPrefix(folderPath, 'poster')
    const fanart = findImageWithPrefix(folderPath, 'fanart')
    expect(poster).toBeDefined()
    expect(fanart).toBeDefined()
    expectNonEmptyFile(join(folderPath, poster!))
    expectNonEmptyFile(join(folderPath, fanart!))
}

function posixMediaFile(folderPosix: string, fileName: string): string {
    return Path.posix(join(Path.toPlatformPath(folderPosix), fileName))
}

function linkedEpisodeFile(folderPosix: string, fileName: string): MediaMetadata['mediaFiles'] {
    return [
        {
            absolutePath: posixMediaFile(folderPosix, fileName),
            seasonNumber: 1,
            episodeNumber: 1,
        },
    ]
}

/**
 * CLI equivalent of given('TV show folder with TMDB id 84666 and one episode was imported').
 */
async function importTvShowFolderWithTmdbId84666AndOneEpisode(): Promise<TestFolder> {
    return createAndImportInitializedFolder(
        bin,
        { ...folder1, files: ['S01E01.mkv'] },
        {
            updateMediaMetadata: (mediaMetadata) => {
                const folderPath = mediaMetadata.mediaFolderPath!
                return {
                    ...mediaMetadata,
                    mediaFiles: linkedEpisodeFile(folderPath, 'S01E01.mkv'),
                    tvShow: mediaMetadata.tvShow
                        ? { ...mediaMetadata.tvShow, database: 'TMDB', id: '84666' }
                        : mediaMetadata.tvShow,
                }
            },
        },
    )
}

/**
 * CLI equivalent of given('TV show folder with TVDB id 355969 and one episode was imported').
 */
async function importTvShowFolderWithTvdbId355969AndOneEpisode(): Promise<TestFolder> {
    return createAndImportInitializedFolder(
        bin,
        { ...folder1, files: ['S01E01.mkv'] },
        {
            updateMediaMetadata: (mediaMetadata) => {
                const folderPath = mediaMetadata.mediaFolderPath!
                return {
                    ...mediaMetadata,
                    mediaFiles: linkedEpisodeFile(folderPath, 'S01E01.mkv'),
                    tvShow: mediaMetadata.tvShow
                        ? { ...mediaMetadata.tvShow, database: 'TVDB', id: '355969' }
                        : mediaMetadata.tvShow,
                }
            },
        },
    )
}

/**
 * CLI equivalent of given('movie folder with TMDB id 552524 was imported').
 */
async function importMovieFolderWithTmdbId552524(): Promise<TestFolder> {
    return createAndImportInitializedFolder(
        bin,
        {
            ...folder2,
            folderName: '哪吒之魔童降世 (2019) {tmdbid=552524}',
            files: ['movie.mkv'],
        },
        {
            updateMediaMetadata: (mediaMetadata) => {
                const folderPath = mediaMetadata.mediaFolderPath!
                return {
                    ...mediaMetadata,
                    type: 'movie-folder',
                    tvShow: undefined,
                    mediaFiles: [
                        {
                            absolutePath: posixMediaFile(folderPath, 'movie.mkv'),
                        },
                    ],
                    movie: {
                        database: 'TMDB',
                        id: '552524',
                        name: '哪吒之魔童降世',
                    },
                }
            },
        },
    )
}

/**
 * CLI equivalent of given('movie folder with TVDB id 116 was imported').
 */
async function importMovieFolderWithTvdbId116(): Promise<TestFolder> {
    return createAndImportInitializedFolder(
        bin,
        { ...folder5, files: ['The Dark Knight [1080P].mkv'] },
        {
            updateMediaMetadata: (mediaMetadata) => {
                const folderPath = mediaMetadata.mediaFolderPath!
                return {
                    ...mediaMetadata,
                    type: 'movie-folder',
                    tvShow: undefined,
                    mediaFiles: [
                        {
                            absolutePath: posixMediaFile(
                                folderPath,
                                'The Dark Knight [1080P].mkv',
                            ),
                        },
                    ],
                    movie: {
                        database: 'TVDB',
                        id: '116',
                        name: folder5.translations?.title?.['en-US'] ?? 'The Dark Knight',
                    },
                }
            },
        },
    )
}

describe('scrape folder', () => {
    beforeEach(async () => {
        await setup({
            binary: bin,
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            resetUserConfig: (config) => {
                config.preferMediaLanguage = 'zh-CN'
                config.tvdb = {
                    ...config.tvdb,
                    host: requiredEnv('TVDB_HOST'),
                    apiKey: requiredEnv('TVDB_API_KEY'),
                    httpProxy: requiredEnv('TVDB_HTTP_PROXY'),
                }
            },
        })
    })

    afterEach(async () => {
        await cleanup({
            binary: bin,
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            resetUserConfig: true,
        })
    })

    it('scrape from TMDB for TV Show', async () => {
        const folder = await importTvShowFolderWithTmdbId84666AndOneEpisode()
        const folderPath = folder.path!

        const scraped = await $`${bin} scrape ${folderPath} --language zh-CN --wait`.nothrow()
        expect(scraped.exitCode).toBe(0)

        const text = scraped.text().replace(/\r\n/g, '\n')
        const idMatch = text.match(/^(\S+)\n/)
        expect(idMatch).not.toBeNull()
        const id = idMatch![1]!
        expect(text).toBe(`${id}
poster ✓
fanart ✓
thumbnail ✓
nfo ✓
`)

        expectNonEmptyFile(join(folderPath, 'S01E01.jpg'))
        expectPosterAndFanart(folderPath)
        expect(existsSync(join(folderPath, 'S01E02.jpg'))).toBe(false)

        const tvshowNfoPath = join(folderPath, 'tvshow.nfo')
        expectNonEmptyFile(tvshowNfoPath)
        expect(readFileSync(tvshowNfoPath, 'utf-8')).toContain('天使降临到我身边')

        const episodeNfoPath = join(folderPath, 'S01E01.nfo')
        expectNonEmptyFile(episodeNfoPath)
        expect(readFileSync(episodeNfoPath, 'utf-8')).toContain('心里痒痒的感觉')
    }, FIVE_MINUTES_MS)

    it('scrape from TVDB for TV Show', async () => {
        const folder = await importTvShowFolderWithTvdbId355969AndOneEpisode()
        const folderPath = folder.path!

        const scraped = await $`${bin} scrape ${folderPath} --language zh-CN --wait`.nothrow()
        expect(scraped.exitCode).toBe(0)

        const text = scraped.text().replace(/\r\n/g, '\n')
        const idMatch = text.match(/^(\S+)\n/)
        expect(idMatch).not.toBeNull()
        const id = idMatch![1]!
        // console log is the core of CLI, the test need to assert the text 100% equal to expectation.
        expect(text).toBe(`${id}
poster ✓
fanart ✓
thumbnail ✓
nfo ✓
`)

        expectNonEmptyFile(join(folderPath, 'S01E01.jpg'))
        expectPosterAndFanart(folderPath)
        expect(existsSync(join(folderPath, 'S01E02.jpg'))).toBe(false)

        const tvshowNfoPath = join(folderPath, 'tvshow.nfo')
        expectNonEmptyFile(tvshowNfoPath)
        expect(readFileSync(tvshowNfoPath, 'utf-8')).toContain('天使降临到了我身边')

        const episodeNfoPath = join(folderPath, 'S01E01.nfo')
        expectNonEmptyFile(episodeNfoPath)
        expect(readFileSync(episodeNfoPath, 'utf-8')).toContain('心裏癢癢的感覺')
        expect(existsSync(join(folderPath, 'S01E02.nfo'))).toBe(false)
    }, FIVE_MINUTES_MS)

    it('scrape from TMDB for Movie', async () => {
        const folder = await importMovieFolderWithTmdbId552524()
        const folderPath = folder.path!

        const scraped = await $`${bin} scrape ${folderPath} --language zh-CN --wait`.nothrow()
        expect(scraped.exitCode).toBe(0)

        const text = scraped.text().replace(/\r\n/g, '\n')
        const idMatch = text.match(/^(\S+)\n/)
        expect(idMatch).not.toBeNull()
        const id = idMatch![1]!
        // console log is the core of CLI, the test need to assert the text 100% equal to expectation.
        expect(text).toBe(`${id}
poster ✓
fanart ✓
thumbnail –
nfo ✓
`)

        expectPosterAndFanart(folderPath)

        const movieNfoPath = join(folderPath, 'movie.nfo')
        expectNonEmptyFile(movieNfoPath)
        expect(readFileSync(movieNfoPath, 'utf-8')).toContain('<tmdbid>552524</tmdbid>')
    }, FIVE_MINUTES_MS)

    it('scrape from TVDB for Movie', async () => {
        const folder = await importMovieFolderWithTvdbId116()
        const folderPath = folder.path!

        const scraped = await $`${bin} scrape ${folderPath} --language zh-CN --wait`.nothrow()
        expect(scraped.exitCode).toBe(0)

        const text = scraped.text().replace(/\r\n/g, '\n')
        const idMatch = text.match(/^(\S+)\n/)
        expect(idMatch).not.toBeNull()
        const id = idMatch![1]!
        // console log is the core of CLI, the test need to assert the text 100% equal to expectation.
        expect(text).toBe(`${id}
poster ✓
fanart ✓
thumbnail –
nfo ✓
`)

        expectPosterAndFanart(folderPath)

        const movieNfoPath = join(folderPath, 'movie.nfo')
        expectNonEmptyFile(movieNfoPath)
        const movieNfoText = readFileSync(movieNfoPath, 'utf-8')
        expect(movieNfoText.includes('<tvdbid>116</tvdbid>') || movieNfoText.includes('type="tvdb"')).toBe(
            true,
        )
    }, FIVE_MINUTES_MS)
})

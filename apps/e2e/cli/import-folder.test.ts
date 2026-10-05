import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { join } from 'node:path'
import { folder1, createFolderInTestFolder, folder2 } from '../test/actions/import-folders'
import { setup, cleanup, bin } from './base'
import { metadataMediaFileLine } from './helpers'
import { Path } from '@smm/utils/path'
import { $ } from 'bun'

const FIVE_MINUTES_MS = 5 * 60 * 1000

describe('import folder', () => {

    beforeEach(async () => {
        await setup({
            binary: bin,
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            resetUserConfig: (_config) => {
                // config.primaryDatabase = 'TMDB'
                // config.preferMediaLanguage = 'zh-CN'
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

    it('import TV show folder', async () => {

        const testFolder = createFolderInTestFolder(folder1)
        const folderPath = testFolder.path

        const ret = await $`${bin} add ${folderPath} --type tvshow --verbose
${bin} list
${bin} show ${folderPath}
${bin} metadata ${folderPath}
        `.nothrow()

        expect(ret.exitCode).toBe(0)
        expect(ret.text()).toContain(`${folderPath}
Path:    ${folderPath}
Status:  ok
Type:    tvshow-folder
Title:   WATATEN!: an Angel Flew Down to Me

Season 1: Season 1
    S01E01 A Funny, Squirmy Feeling
           S01E01.mkv
    S01E02 Incontestably Cute
           S01E02.mkv
    S01E03 Imprinting
           S01E03.mkv
mediaFolderPath: ${folderPath}
type: tvshow-folder
tvShow:
  name: WATATEN!: an Angel Flew Down to Me
  database: TMDB
  id: 84666
  airDate: 2019-01-08
  seasons: 2
    S00  Specials  (1 episodes)
      E01  You Never Let Us Down / Always Growing Closer / Let's Change You Into This! / I'm Your Big Sister
    S01  Season 1  (12 episodes)
      E01  A Funny, Squirmy Feeling
      E02  Incontestably Cute
      E03  Imprinting
      E04  Can We Talk for a Moment?
      E05  Don't Worry! Leave It to Me!
      E06  Mya-nee Doesn't Have Any Friends
      E07  I Don't Understand What Mya-nee Is Saying
      E08  Sometimes Ignorance Is Bliss
      E09  Please Stay Until I Fall Asleep
      E10  I Said Too Much Again
      E11  In Short, It's Your Fault, Onee-san
      E12  Angel's Gaze
mediaFiles:
  - ${metadataMediaFileLine(folderPath!, 'S01E01.mkv', 1, 1)}
  - ${metadataMediaFileLine(folderPath!, 'S01E02.mkv', 1, 2)}
  - ${metadataMediaFileLine(folderPath!, 'S01E03.mkv', 1, 3)}`)
    }, FIVE_MINUTES_MS)

    it('import TV show folder with --skip-init', async () => {

        const testFolder = createFolderInTestFolder(folder1)
        const folderPath = testFolder.path

        const ret = await $`${bin} add ${folderPath} --type tvshow --verbose --skip-init
${bin} list
${bin} show ${folderPath}
${bin} metadata ${folderPath}
      `.nothrow()

        expect(ret.exitCode).toBe(0)
        expect(ret.text()).toContain(`${folderPath}
Path:    ${folderPath}
Status:  ok
Type:    tvshow-folder
`)
    }, FIVE_MINUTES_MS)

    it('import movie folder', async () => {

        const testFolder = createFolderInTestFolder({
            ...folder2,
            folderName: '{tmdbid=1539104}',
        })
        const folderPath = testFolder.path

        const ret = await $`${bin} add ${folderPath} --type movie --verbose
${bin} list
${bin} show ${folderPath}
${bin} metadata ${folderPath}
    `.nothrow()

        expect(ret.exitCode).toBe(0)
        const movieFileLine = Path.toPlatformPath(join(folderPath!, 'movie.mkv'))
        expect(ret.text()).toContain(`${folderPath}
Path:    ${folderPath}
Status:  ok
Type:    movie-folder
Title:   JUJUTSU KAISEN: Execution

    movie.mkv
mediaFolderPath: ${folderPath}
type: movie-folder
movie:
  name: JUJUTSU KAISEN: Execution
  database: TMDB
  id: 1539104
  airDate: 2025-11-07
mediaFiles:
  - absolutePath: ${movieFileLine}`)
    }, FIVE_MINUTES_MS)

    it('import music folder', async () => {

        const testFolder = createFolderInTestFolder({
            folderName: 'BilibiliMusic',
            files: ['01.mp3'],
            type: 'music',
        })
        const folderPath = testFolder.path

        const ret = await $`${bin} add ${folderPath} --type music --verbose
${bin} list
${bin} show ${folderPath}
${bin} metadata ${folderPath}
    `.nothrow()

        expect(ret.exitCode).toBe(0)
        expect(ret.text()).toContain(`${folderPath}
Path:    ${folderPath}
Status:  ok
Type:    music-folder
mediaFolderPath: ${folderPath}
type: music-folder
mediaFiles:
  (empty)`)
    }, FIVE_MINUTES_MS)

    it('smm add prints the import job log', async () => {
        const testFolder = createFolderInTestFolder({
            folderName: 'JobLogMusic',
            files: ['01.mp3'],
            type: 'music',
        })
        await expectImportJobLog(testFolder.path!, 'music', [])
    }, FIVE_MINUTES_MS)

    it('smm add prints the tvshow import job log', async () => {
        const testFolder = createFolderInTestFolder(folder1)
        const folderPath = testFolder.path!
        await expectImportJobLog(folderPath, 'tvshow', [
            `Recognize ${folderPath}: WATATEN!: an Angel Flew Down to Me (tmdbId:84666)`,
            'Recognize 3 episode files',
        ])
    }, FIVE_MINUTES_MS)

    it('smm add prints the movie import job log', async () => {
        const testFolder = createFolderInTestFolder({
            ...folder2,
            folderName: '{tmdbid=1539104}',
        })
        const folderPath = testFolder.path!
        await expectImportJobLog(folderPath, 'movie', [
            `Recognize ${folderPath}: JUJUTSU KAISEN: Execution (tmdbId:1539104)`,
            'Recognize 1 episode files',
        ])
    }, FIVE_MINUTES_MS)
})

/**
 * `smm add` prints ImportFolderJob log lines to stdout (`callbacks.onLog`).
 * That stream is part of the CLI user experience: the entire stdout must equal
 * the expected log, line for line.
 *
 * Do not weaken this to `toContain` / partial matches, and do not drop or
 * rewrite expected lines to make a later change easier. If production log
 * wording changes, update the expected string to match the new UX on purpose.
 */
async function expectImportJobLog(
    folderPath: string,
    type: string,
    recognitionLines: string[],
): Promise<void> {
    const added = await $`${bin} add ${folderPath} --type ${type}`.nothrow()
    expect(added.exitCode).toBe(0)

    const text = added.text().replace(/\r\n/g, '\n')
    const idMatch = text.match(/^(\S+) started\n/)
    expect(idMatch).not.toBeNull()
    const id = idMatch![1]!

    const expected = [
        `${id} started`,
        `Started to import folder: ${folderPath}, type: ${type}`,
        ...recognitionLines,
        `${id} completed`,
        '',
    ].join('\n')
    expect(text).toBe(expected)
}
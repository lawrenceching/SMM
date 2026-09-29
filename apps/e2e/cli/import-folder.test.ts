import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
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

    it('smm add prints the import job log, and job list / job log can read it', async () => {
        const testFolder = createFolderInTestFolder({
            folderName: 'JobLogMusic',
            files: ['01.mp3'],
            type: 'music',
        })
        await expectImportJobLog(testFolder.path!, 'music', [
            'Completed',
        ])
    }, FIVE_MINUTES_MS)

    it('smm add prints the tvshow import job log, and job list / job log can read it', async () => {
        const testFolder = createFolderInTestFolder(folder1)
        await expectImportJobLog(testFolder.path!, 'tvshow', [
            'Started to recognize folder',
            'Recognized folder: WATATEN!: an Angel Flew Down to Me',
            'Started to recognize episodes',
            "Recognized episode files: 3 files are recognized, didn't recognize files for 10 episodes",
            'Completed',
        ])
    }, FIVE_MINUTES_MS)

    it('smm add prints the movie import job log, and job list / job log can read it', async () => {
        const testFolder = createFolderInTestFolder({
            ...folder2,
            folderName: '{tmdbid=1539104}',
        })
        await expectImportJobLog(testFolder.path!, 'movie', [
            'Started to recognize folder',
            'Recognized folder: JUJUTSU KAISEN: Execution',
            'Started to recognize episodes',
            "Recognized episode files: 1 files are recognized, didn't recognize files for 0 episodes",
            'Completed',
        ])
    }, FIVE_MINUTES_MS)
})

async function expectImportJobLog(folderPath: string, type: string, lines: string[]): Promise<void> {
    const logDir = mkdtempSync(join(tmpdir(), 'smm-e2e-job-logs-'))
    const prevLogDir = process.env.LOG_DIR
    process.env.LOG_DIR = logDir
    const started = `Started to import folder: ${Path.posix(folderPath)}, type: ${type}`
    const expected = [started, ...lines]
    try {
        const added = await $`${bin} add ${folderPath} --type ${type}`.nothrow()
        expect(added.exitCode).toBe(0)
        for (const line of expected) {
            expect(added.text()).toContain(line)
        }

        const listed = await $`${bin} job list`.nothrow()
        expect(listed.exitCode).toBe(0)
        const ids = listed.text().split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        expect(ids.length).toBeGreaterThan(0)

        let matched = false
        for (const id of ids) {
            const logged = await $`${bin} job log ${id}`.nothrow()
            expect(logged.exitCode).toBe(0)
            if (!logged.text().includes(started)) continue
            for (const line of expected) {
                expect(logged.text()).toContain(line)
            }
            matched = true
        }
        expect(matched).toBe(true)
    } finally {
        if (prevLogDir === undefined) delete process.env.LOG_DIR
        else process.env.LOG_DIR = prevLogDir
        rmSync(logDir, { recursive: true, force: true })
    }
}
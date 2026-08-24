import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { folder1, createFolderInTestFolder, folder2 } from '../test/actions/import-folders'
import { setup, cleanup, bin } from './base'
import { $ } from 'bun'

const FIVE_MINUTES_MS = 5 * 60 * 1000

describe('import folder', () => {

    beforeEach(async () => {
        await setup({
            binary: bin,
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            resetUserConfig: (config) => {
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
  - absolutePath: ${folderPath}\\S01E01.mkv  seasonNumber: 1  episodeNumber: 1
  - absolutePath: ${folderPath}\\S01E02.mkv  seasonNumber: 1  episodeNumber: 2
  - absolutePath: ${folderPath}\\S01E03.mkv  seasonNumber: 1  episodeNumber: 3`)
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

        const testFolder = createFolderInTestFolder(folder2)
        const folderPath = testFolder.path

        const ret = await $`${bin} add ${folderPath} --type movie --verbose
${bin} list
${bin} show ${folderPath}
${bin} metadata ${folderPath}
    `.nothrow()

        expect(ret.exitCode).toBe(0)
        expect(ret.text()).toContain(`${folderPath}
Path:    ${folderPath}
Status:  ok
Type:    movie-folder
mediaFolderPath: ${folderPath}
type: movie-folder
mediaFiles:
  (empty)`)
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
})
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { $ } from 'bun'
import { movieFolder, tvShowFolder } from '../test/actions/import-folders'
import { setup, cleanup, bin } from './base'
import {
    createAndImportInitializedFolder,
    parsePlanId,
    planFilePath,
    recognizeAndApply,
    withWindowsSafeTvShowName,
    cliOutput,
} from './helpers'

const isWindows = process.platform === 'win32'
const SLASH = isWindows ? '\\' : '/'

const SHOW_NAME = 'WATATEN an Angel Flew Down to Me'
const EP1_NAME = 'A Funny, Squirmy Feeling'
const PLEX_S01E01_BASENAME = `${SHOW_NAME} - S01E01 - ${EP1_NAME}.mkv`
const EMBY_S01E01_BASENAME = `${SHOW_NAME} S1E1 ${EP1_NAME}.mkv`

describe('rename files', () => {
    beforeEach(async () => {
        await setup({
            binary: bin,
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            resetUserConfig: () => {},
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

    it('plex rename: recognize then try-to-rename then apply moves S01E01 into Season 01', async () => {
        const folder = await createAndImportInitializedFolder(
            bin,
            { ...tvShowFolder, folderName: 'RenameFiles 123123' },
            {
                updateMediaMetadata: (mm) =>
                    withWindowsSafeTvShowName({ ...mm, mediaFiles: [] }),
            },
        )
        const folderPath = folder.path!

        await recognizeAndApply(bin, folderPath)

        const tried = await $`${bin} try-to-rename ${folderPath} --rule plex`.nothrow()
        expect(tried.exitCode).toBe(0)
        expect(tried.text()).toMatch(/task:\s+rename-files/)
        expect(tried.text()).toMatch(/status:\s+pending/)
        expect(tried.text()).toContain('Season 01')
        expect(tried.text()).toContain('S01E01.mkv')
        expect(tried.text()).toContain(PLEX_S01E01_BASENAME)

        const planId = parsePlanId(tried.text())
        expect(existsSync(await planFilePath(bin, planId))).toBe(true)

        const applied = await $`${bin} apply ${planId}`.nothrow()
        expect(applied.exitCode).toBe(0)
        expect(applied.text()).toMatch(/applied .* \(3 file\(s\)\)/)
        expect(existsSync(await planFilePath(bin, planId))).toBe(false)

        const renamedVideo = join(folderPath, 'Season 01', PLEX_S01E01_BASENAME)
        expect(existsSync(renamedVideo)).toBe(true)
        expect(existsSync(join(folderPath, 'S01E01.mkv'))).toBe(false)

        const meta = await $`${bin} metadata ${folderPath}`.nothrow()
        expect(meta.text()).toContain(
            `absolutePath: ${folderPath}${SLASH}Season 01${SLASH}${PLEX_S01E01_BASENAME}  seasonNumber: 1  episodeNumber: 1`,
        )
    })

    it('emby rename: recognize then try-to-rename --rule emby moves into Season 1', async () => {
        const folder = await createAndImportInitializedFolder(
            bin,
            { ...tvShowFolder, folderName: 'EmbyRename 123123' },
            {
                updateMediaMetadata: (mm) =>
                    withWindowsSafeTvShowName({ ...mm, mediaFiles: [] }),
            },
        )
        const folderPath = folder.path!

        await recognizeAndApply(bin, folderPath)

        const tried = await $`${bin} try-to-rename ${folderPath} --rule emby`.nothrow()
        expect(tried.exitCode).toBe(0)
        expect(tried.text()).toContain('Season 1')
        expect(tried.text()).toContain(EMBY_S01E01_BASENAME)

        const planId = parsePlanId(tried.text())
        const applied = await $`${bin} apply ${planId}`.nothrow()
        expect(applied.exitCode).toBe(0)

        const renamedVideo = join(folderPath, 'Season 1', EMBY_S01E01_BASENAME)
        expect(existsSync(renamedVideo)).toBe(true)
        expect(existsSync(join(folderPath, 'S01E01.mkv'))).toBe(false)

        const meta = await $`${bin} metadata ${folderPath}`.nothrow()
        expect(meta.text()).toContain(
            `absolutePath: ${folderPath}${SLASH}Season 1${SLASH}${EMBY_S01E01_BASENAME}  seasonNumber: 1  episodeNumber: 1`,
        )
    })

    it('UC2: reject plex plan then try-to-rename --rule emby builds new plan', async () => {
        const folder = await createAndImportInitializedFolder(
            bin,
            { ...tvShowFolder, folderName: 'SwitchRule 123123' },
            {
                updateMediaMetadata: (mm) =>
                    withWindowsSafeTvShowName({ ...mm, mediaFiles: [] }),
            },
        )
        const folderPath = folder.path!

        await recognizeAndApply(bin, folderPath)

        const plexTried = await $`${bin} try-to-rename ${folderPath} --rule plex`.nothrow()
        expect(plexTried.exitCode).toBe(0)
        expect(plexTried.text()).toContain(PLEX_S01E01_BASENAME)
        const plexPlanId = parsePlanId(plexTried.text())
        expect(existsSync(await planFilePath(bin, plexPlanId))).toBe(true)

        const rejected = await $`${bin} reject ${plexPlanId}`.nothrow()
        expect(rejected.exitCode).toBe(0)
        expect(existsSync(await planFilePath(bin, plexPlanId))).toBe(true)
        const rejectedPlan = JSON.parse(
            readFileSync(await planFilePath(bin, plexPlanId), 'utf-8'),
        ) as { status: string }
        expect(rejectedPlan.status).toBe('rejected')

        const embyTried = await $`${bin} try-to-rename ${folderPath} --rule emby`.nothrow()
        expect(embyTried.exitCode).toBe(0)
        expect(embyTried.text()).toContain(EMBY_S01E01_BASENAME)
        expect(embyTried.text()).not.toContain(PLEX_S01E01_BASENAME)

        const embyPlanId = parsePlanId(embyTried.text())
        expect(embyPlanId).not.toBe(plexPlanId)
        expect(existsSync(await planFilePath(bin, embyPlanId))).toBe(true)

        const applied = await $`${bin} apply ${embyPlanId}`.nothrow()
        expect(applied.exitCode).toBe(0)
        expect(existsSync(join(folderPath, 'Season 1', EMBY_S01E01_BASENAME))).toBe(true)
        expect(existsSync(join(folderPath, 'Season 01', PLEX_S01E01_BASENAME))).toBe(false)
    })

    it('associated files: apply renames same-stem subtitle alongside video', async () => {
        const folder = await createAndImportInitializedFolder(
            bin,
            { ...tvShowFolder, folderName: 'AssocRename 123123' },
            {
                updateMediaMetadata: (mm) =>
                    withWindowsSafeTvShowName({ ...mm, mediaFiles: [] }),
            },
        )
        const folderPath = folder.path!

        await recognizeAndApply(bin, folderPath)

        const tried = await $`${bin} try-to-rename ${folderPath} --rule plex`.nothrow()
        expect(tried.exitCode).toBe(0)
        const planId = parsePlanId(tried.text())

        const applied = await $`${bin} apply ${planId}`.nothrow()
        expect(applied.exitCode).toBe(0)

        const seasonDir = join(folderPath, 'Season 01')
        const videoBase = PLEX_S01E01_BASENAME.replace(/\.mkv$/, '')
        expect(existsSync(join(seasonDir, `${videoBase}.sc.ass`))).toBe(true)
        expect(existsSync(join(seasonDir, `${videoBase}.tc.ass`))).toBe(true)
        expect(existsSync(join(seasonDir, `${videoBase}.nfo`))).toBe(true)
        expect(existsSync(join(seasonDir, `${videoBase}.jpg`))).toBe(true)
        expect(existsSync(join(folderPath, 'S01E01.sc.ass'))).toBe(false)
    })

    it('already at target paths: pending plan with empty files, apply is no-op', async () => {
        const folder = await createAndImportInitializedFolder(
            bin,
            { ...tvShowFolder, folderName: 'AlreadyRenamed 123123' },
            {
                updateMediaMetadata: (mm) =>
                    withWindowsSafeTvShowName({ ...mm, mediaFiles: [] }),
            },
        )
        const folderPath = folder.path!

        await recognizeAndApply(bin, folderPath)

        const first = await $`${bin} try-to-rename ${folderPath} --rule plex`.nothrow()
        expect(first.exitCode).toBe(0)
        const firstPlanId = parsePlanId(first.text())
        const firstApply = await $`${bin} apply ${firstPlanId}`.nothrow()
        expect(firstApply.exitCode).toBe(0)

        const before = await $`${bin} metadata ${folderPath}`.nothrow()

        const second = await $`${bin} try-to-rename ${folderPath} --rule plex`.nothrow()
        expect(second.exitCode).toBe(0)
        expect(second.text()).toContain('(none)')
        const secondPlanId = parsePlanId(second.text())

        const plan = JSON.parse(readFileSync(await planFilePath(bin, secondPlanId), 'utf-8')) as {
            task: string
            files: unknown[]
        }
        expect(plan.task).toBe('rename-files')
        expect(plan.files).toEqual([])

        const secondApply = await $`${bin} apply ${secondPlanId}`.nothrow()
        expect(secondApply.exitCode).toBe(0)
        expect(secondApply.text()).toMatch(/\(0 file\(s\)\)/)
        expect(existsSync(await planFilePath(bin, secondPlanId))).toBe(false)

        const after = await $`${bin} metadata ${folderPath}`.nothrow()
        expect(after.text()).toBe(before.text())
    })

    it('rejects unmanaged folder', async () => {
        const result = await $`${bin} try-to-rename ${join(process.cwd(), 'not-imported')}`.nothrow()
        expect(result.exitCode).toBe(1)
        expect(cliOutput(result)).toMatch(/not managed by SMM/i)
    })

    it('rejects unsupported rename rule', async () => {
        const folder = await createAndImportInitializedFolder(
            bin,
            { ...tvShowFolder, folderName: 'BadRule 123123' },
            {
                updateMediaMetadata: (mm) =>
                    withWindowsSafeTvShowName({ ...mm, mediaFiles: [] }),
            },
        )
        const result = await $`${bin} try-to-rename ${folder.path!} --rule jellyfin`.nothrow()
        expect(result.exitCode).toBe(1)
        expect(cliOutput(result)).toMatch(/Unsupported rename rule/i)
    })

    it('rejects movie folder (not a TV show with episodes)', async () => {
        const folder = await createAndImportInitializedFolder(
            bin,
            { ...movieFolder },
            {
                mediaMetadata: {
                    type: 'movie-folder',
                    mediaFiles: [],
                    movie: { database: 'TVDB', id: '116', name: 'The Dark Knight' },
                },
            },
        )
        const result = await $`${bin} try-to-rename ${folder.path!}`.nothrow()
        expect(result.exitCode).toBe(1)
        expect(cliOutput(result)).toMatch(/not a TV show with episodes/i)
    })

    it('apply rejects missing plan id', async () => {
        const result = await $`${bin} apply 00000000-0000-0000-0000-000000000000`.nothrow()
        expect(result.exitCode).toBe(1)
        expect(cliOutput(result)).toMatch(/Plan not found/i)
    })
})

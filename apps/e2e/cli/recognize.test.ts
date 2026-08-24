import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { $ } from 'bun'
import { movieFolder, tvShowFolder } from '../test/actions/import-folders'
import { setup, cleanup, bin } from './base'
import {
    createAndImportInitializedFolder,
    parsePlanId,
    planFilePath,
    cliOutput,
} from './helpers'

describe('recognize', () => {
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

    it('try-to-recognize then apply maps S01E01..03', async () => {
        const folder = await createAndImportInitializedFolder(
            bin,
            { ...tvShowFolder, folderName: 'UnKnown Folder 123123123123' },
            { updateMediaMetadata: (mm) => ({ ...mm, mediaFiles: [] }) },
        )
        const folderPath = folder.path!

        const tried = await $`${bin} try-to-recognize ${folderPath}`.nothrow()
        expect(tried.exitCode).toBe(0)
        expect(tried.text()).toMatch(/task:\s+recognize-media-file/)
        expect(tried.text()).toMatch(/status:\s+pending/)
        expect(tried.text()).toContain('S01E01')
        expect(tried.text()).toContain('S01E02')
        expect(tried.text()).toContain('S01E03')

        const planId = parsePlanId(tried.text())
        expect(existsSync(await planFilePath(bin, planId))).toBe(true)

        const applied = await $`${bin} apply ${planId}`.nothrow()
        expect(applied.exitCode).toBe(0)
        expect(applied.text()).toMatch(/applied .* \(3 file\(s\)\)/)
        expect(existsSync(await planFilePath(bin, planId))).toBe(false)

        const meta = await $`${bin} metadata ${folderPath}`.nothrow()
        expect(meta.exitCode).toBe(0)
        expect(meta.text()).toContain(
            `absolutePath: ${folderPath}\\S01E01.mkv  seasonNumber: 1  episodeNumber: 1`,
        )
        expect(meta.text()).toContain(
            `absolutePath: ${folderPath}\\S01E02.mkv  seasonNumber: 1  episodeNumber: 2`,
        )
        expect(meta.text()).toContain(
            `absolutePath: ${folderPath}\\S01E03.mkv  seasonNumber: 1  episodeNumber: 3`,
        )
    })

    it('partial coverage: only S01E01..02 match when S01E03 loses season-episode name', async () => {
        const folder = await createAndImportInitializedFolder(
            bin,
            { ...tvShowFolder, folderName: 'PartialRecognition 123123' },
            { updateMediaMetadata: (mm) => ({ ...mm, mediaFiles: [] }) },
        )
        const folderPath = folder.path!
        renameSync(join(folderPath, 'S01E03.mkv'), join(folderPath, 'extra-video.mkv'))

        const tried = await $`${bin} try-to-recognize ${folderPath}`.nothrow()
        expect(tried.exitCode).toBe(0)
        const planId = parsePlanId(tried.text())
        expect(tried.text()).toContain('S01E01')
        expect(tried.text()).toContain('S01E02')
        expect(tried.text()).not.toMatch(/S01E03\s+/)

        const plan = JSON.parse(readFileSync(await planFilePath(bin, planId), 'utf-8')) as {
            task: string
            files: Array<{ season: number; episode: number }>
        }
        expect(plan.task).toBe('recognize-media-file')
        expect(plan.files).toHaveLength(2)
        expect(plan.files.map((f) => `${f.season}:${f.episode}`)).toEqual(['1:1', '1:2'])

        const applied = await $`${bin} apply ${planId}`.nothrow()
        expect(applied.exitCode).toBe(0)

        const meta = await $`${bin} metadata ${folderPath}`.nothrow()
        expect(meta.text()).toContain(
            `absolutePath: ${folderPath}\\S01E01.mkv  seasonNumber: 1  episodeNumber: 1`,
        )
        expect(meta.text()).toContain(
            `absolutePath: ${folderPath}\\S01E02.mkv  seasonNumber: 1  episodeNumber: 2`,
        )
        expect(meta.text()).not.toContain('extra-video.mkv')
    })

    it('zero matches: pending plan with empty files, apply is no-op on mediaFiles', async () => {
        const folder = await createAndImportInitializedFolder(
            bin,
            { ...tvShowFolder, folderName: 'NoPatternMatch 123123' },
            { updateMediaMetadata: (mm) => ({ ...mm, mediaFiles: [] }) },
        )
        const folderPath = folder.path!
        for (const name of ['S01E01.mkv', 'S01E02.mkv', 'S01E03.mkv']) {
            renameSync(join(folderPath, name), join(folderPath, name.replace('S01E', 'Episode')))
        }

        const tried = await $`${bin} try-to-recognize ${folderPath}`.nothrow()
        expect(tried.exitCode).toBe(0)
        expect(tried.text()).toMatch(/status:\s+pending/)
        expect(tried.text()).toContain('(none)')
        const planId = parsePlanId(tried.text())

        const plan = JSON.parse(readFileSync(await planFilePath(bin, planId), 'utf-8')) as {
            task: string
            files: unknown[]
        }
        expect(plan.task).toBe('recognize-media-file')
        expect(plan.files).toEqual([])

        const before = await $`${bin} metadata ${folderPath}`.nothrow()
        const applied = await $`${bin} apply ${planId}`.nothrow()
        expect(applied.exitCode).toBe(0)
        expect(applied.text()).toMatch(/\(0 file\(s\)\)/)
        expect(existsSync(await planFilePath(bin, planId))).toBe(false)

        const after = await $`${bin} metadata ${folderPath}`.nothrow()
        expect(after.text()).toBe(before.text())
    })

    it('already recognized: try-to-recognize still builds a plan that can be applied', async () => {
        const folder = await createAndImportInitializedFolder(bin, {
            ...tvShowFolder,
            folderName: 'AlreadyRecognized 123123',
        })
        const folderPath = folder.path!

        const seeded = await $`${bin} metadata ${folderPath}`.nothrow()
        expect(seeded.text()).toContain('seasonNumber: 1  episodeNumber: 1')

        const tried = await $`${bin} try-to-recognize ${folderPath}`.nothrow()
        expect(tried.exitCode).toBe(0)
        const planId = parsePlanId(tried.text())
        expect(tried.text()).toContain('S01E01')

        const applied = await $`${bin} apply ${planId}`.nothrow()
        expect(applied.exitCode).toBe(0)

        const meta = await $`${bin} metadata ${folderPath}`.nothrow()
        expect(meta.text()).toContain(
            `absolutePath: ${folderPath}\\S01E01.mkv  seasonNumber: 1  episodeNumber: 1`,
        )
    })

    it('rejects unmanaged folder', async () => {
        const result = await $`${bin} try-to-recognize ${join(process.cwd(), 'not-imported')}`.nothrow()
        expect(result.exitCode).toBe(1)
        expect(cliOutput(result)).toMatch(/not managed by SMM/i)
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
        const result = await $`${bin} try-to-recognize ${folder.path!}`.nothrow()
        expect(result.exitCode).toBe(1)
        expect(cliOutput(result)).toMatch(/not a TV show with episodes/i)
    })

    it('apply rejects missing plan id', async () => {
        const result = await $`${bin} apply 00000000-0000-0000-0000-000000000000`.nothrow()
        expect(result.exitCode).toBe(1)
        expect(cliOutput(result)).toMatch(/Plan not found/i)
    })
})

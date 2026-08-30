import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { $ } from 'bun'
import { Path } from '@smm/utils/path'
import { movieFolder, tvShowFolder } from '../test/actions/import-folders'
import { setup, cleanup, bin } from './base'
import {
    createAndImportInitializedFolder,
    renamedFolderPath,
    cliOutput,
    metadataMediaFileLine,
} from './helpers'

describe('rename', () => {
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

    it('renames a pre-initialized tvshow folder via smm rename', async () => {
        const folder = await createAndImportInitializedFolder(bin, { ...tvShowFolder })
        const from = folder.path!
        const to = renamedFolderPath(from, folder.folderName)

        const renamed = await $`${bin} rename ${from} ${to}`.nothrow()
        expect(renamed.exitCode).toBe(0)
        expect(renamed.text()).toContain(`${Path.posix(from)} → ${Path.posix(to)}`)

        expect(existsSync(from)).toBe(false)
        expect(existsSync(to)).toBe(true)
        expect(existsSync(join(to, 'S01E01.mkv'))).toBe(true)

        const listed = await $`${bin} list`.nothrow()
        expect(listed.exitCode).toBe(0)
        expect(listed.text().trim().split('\n').filter(Boolean)).toEqual([to])

        const meta = await $`${bin} metadata ${to}`.nothrow()
        expect(meta.exitCode).toBe(0)
        expect(cliOutput(meta)).toContain(`mediaFolderPath: ${to}`)
        expect(meta.text()).toContain('type: tvshow-folder')
        expect(meta.text()).toContain('id: 84666')
        expect(meta.text()).toContain(metadataMediaFileLine(to, 'S01E01.mkv', 1, 1))
    })

    it('renames a pre-initialized movie folder via smm rename', async () => {
        const folder = await createAndImportInitializedFolder(
            bin,
            { ...movieFolder },
            {
                updateMediaMetadata: (mediaMetadata) => {
                    const folderPath = Path.toPlatformPath(mediaMetadata.mediaFolderPath!)
                    return {
                        ...mediaMetadata,
                        type: 'movie-folder',
                        tvShow: undefined,
                        mediaFiles: movieFolder.files.map((file) => ({
                            absolutePath: Path.posix(join(folderPath, file)),
                        })),
                        movie: {
                            database: 'TVDB',
                            id: '116',
                            name: 'The Dark Knight',
                        },
                    }
                },
            },
        )
        const from = folder.path!
        const to = renamedFolderPath(from, folder.folderName)

        const seeded = await $`${bin} metadata ${from}`.nothrow()
        expect(seeded.text()).toContain('type: movie-folder')
        expect(seeded.text()).toContain('id: 116')

        const renamed = await $`${bin} rename ${from} ${to}`.nothrow()
        expect(renamed.exitCode).toBe(0)
        expect(renamed.text()).toContain(`${Path.posix(from)} → ${Path.posix(to)}`)

        expect(existsSync(from)).toBe(false)
        expect(existsSync(to)).toBe(true)
        expect(existsSync(join(to, 'The Dark Knight [1080P].mkv'))).toBe(true)

        const listed = await $`${bin} list`.nothrow()
        expect(listed.exitCode).toBe(0)
        expect(listed.text().trim().split('\n').filter(Boolean)).toEqual([to])

        const meta = await $`${bin} metadata ${to}`.nothrow()
        expect(meta.exitCode).toBe(0)
        expect(cliOutput(meta)).toContain(`mediaFolderPath: ${to}`)
        expect(cliOutput(meta)).toContain('type: movie-folder')
        expect(cliOutput(meta)).toContain('id: 116')
        expect(cliOutput(meta)).not.toContain('tvShow:')
        expect(cliOutput(meta)).toContain(
            `absolutePath: ${Path.toPlatformPath(join(to, 'The Dark Knight [1080P].mkv'))}`,
        )
    })

    it('renames a linked episode file (+ associates) via smm rename', async () => {
        const folder = await createAndImportInitializedFolder(bin, { ...tvShowFolder })
        const media = folder.path!
        const from = join(media, 'S01E01.mkv')
        const to = join(media, 'S01E01_renamed.mkv')

        const renamed = await $`${bin} rename ${from} ${to}`.nothrow()
        expect(renamed.exitCode).toBe(0)
        expect(renamed.text()).toContain(`${Path.posix(from)} → ${Path.posix(to)}`)
        expect(renamed.text()).toContain(
            `${Path.posix(join(media, 'S01E01.jpg'))} → ${Path.posix(join(media, 'S01E01_renamed.jpg'))}`,
        )
        expect(renamed.text()).toContain(
            `${Path.posix(join(media, 'S01E01.sc.ass'))} → ${Path.posix(join(media, 'S01E01_renamed.sc.ass'))}`,
        )

        expect(existsSync(from)).toBe(false)
        expect(existsSync(to)).toBe(true)
        expect(existsSync(join(media, 'S01E01_renamed.jpg'))).toBe(true)
        expect(existsSync(join(media, 'S01E01.jpg'))).toBe(false)

        const meta = await $`${bin} metadata ${media}`.nothrow()
        expect(meta.text()).toContain(metadataMediaFileLine(media, 'S01E01_renamed.mkv', 1, 1))
    })

    it('rejects renaming a subdirectory that is not a managed media folder', async () => {
        const folder = await createAndImportInitializedFolder(bin, { ...tvShowFolder })
        const media = folder.path!
        const season = join(media, 'Season 01')
        mkdirSync(season)

        const result = await $`${bin} rename ${season} ${join(media, 'Season 01 - Renamed')}`.nothrow()
        expect(result.exitCode).toBe(1)
        expect(cliOutput(result)).toMatch(/directory but not a managed media folder/)
    })

    it('rejects unmanaged paths', async () => {
        const orphan = join(process.cwd(), 'orphan.mkv')
        const result = await $`${bin} rename ${orphan} ${join(process.cwd(), 'orphan2.mkv')}`.nothrow()
        expect(result.exitCode).toBe(1)
        expect(cliOutput(result)).toMatch(/not under a managed media folder/)
    })
})

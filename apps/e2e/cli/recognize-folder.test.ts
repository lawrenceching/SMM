import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { join } from 'node:path'
import { $ } from 'bun'
import { folder1, folder4, createFolderInTestFolder } from '../test/actions/import-folders'
import { setup, cleanup, bin } from './base'
import { cliOutput } from './helpers'

const FIVE_MINUTES_MS = 5 * 60 * 1000

describe('recognize folder', () => {
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

    it('UC1: recognize with TMDB id', async () => {
        const folder = createFolderInTestFolder({ ...folder1 })
        const folderPath = folder.path!
        const added = await $`${bin} add ${folderPath} --type tvshow --skip-init`.nothrow()
        expect(added.exitCode).toBe(0)

        const recognized = await $`${bin} recognize ${folderPath} --db tmdb --id 84666`.nothrow()
        expect(recognized.exitCode).toBe(0)
        expect(recognized.text()).toMatch(/Metadata is updated/i)

        const meta = await $`${bin} metadata ${folderPath}`.nothrow()
        expect(meta.exitCode).toBe(0)
        expect(meta.text()).toContain('database: TMDB')
        expect(meta.text()).toContain('id: 84666')
        expect(meta.text()).toMatch(/mediaFiles:\s*\n\s*\(empty\)/)
    }, FIVE_MINUTES_MS)

    it('UC2: recognize with TVDB id', async () => {
        const folder = createFolderInTestFolder({ ...folder4 })
        const folderPath = folder.path!
        const added = await $`${bin} add ${folderPath} --type tvshow --skip-init`.nothrow()
        expect(added.exitCode).toBe(0)

        const recognized = await $`${bin} recognize ${folderPath} --db tvdb --id 421069`.nothrow()
        expect(recognized.exitCode).toBe(0)

        const meta = await $`${bin} metadata ${folderPath}`.nothrow()
        expect(meta.exitCode).toBe(0)
        expect(meta.text()).toContain('database: TVDB')
        expect(meta.text()).toContain('id: 421069')
        expect(meta.text()).toMatch(/mediaFiles:\s*\n\s*\(empty\)/)
    }, FIVE_MINUTES_MS)

    it('auto recognize with --yes using tmdbid in folder name', async () => {
        const folder = createFolderInTestFolder({ ...folder1 })
        const folderPath = folder.path!
        await $`${bin} add ${folderPath} --type tvshow --skip-init`.nothrow()

        const recognized = await $`${bin} recognize ${folderPath} --yes`.nothrow()
        expect(recognized.exitCode).toBe(0)
        expect(recognized.text()).toMatch(/Metadata is updated/i)

        const meta = await $`${bin} metadata ${folderPath}`.nothrow()
        expect(meta.text()).toContain('id: 84666')
        expect(meta.text()).toMatch(/mediaFiles:\s*\n\s*\(empty\)/)
    }, FIVE_MINUTES_MS)

    it('rejects unmanaged folder', async () => {
        const result = await $`${bin} recognize ${join(process.cwd(), 'not-imported')} --db tmdb --id 1`.nothrow()
        expect(result.exitCode).toBe(1)
        expect(cliOutput(result)).toMatch(/not managed by SMM/i)
    })

    it('rejects unpaired --db / --id', async () => {
        const folder = createFolderInTestFolder({ ...folder1 })
        const folderPath = folder.path!
        await $`${bin} add ${folderPath} --type tvshow --skip-init`.nothrow()
        const result = await $`${bin} recognize ${folderPath} --db tmdb`.nothrow()
        expect(result.exitCode).toBe(1)
        expect(cliOutput(result)).toMatch(/--db and --id/i)
    })
})

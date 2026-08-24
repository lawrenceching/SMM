import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { folder1, folder2, createFolderInTestFolder } from '../test/actions/import-folders'
import { setup, cleanup, bin } from './base'
import { $ } from 'bun'

/**
 * This test focus on folder management
 * So when adding(importing) a folder, we use "--skip-init" to skip the folder initialization process
 * 
 * Another test "import-folder.test.ts" is created to cover folder initialization process
 */
describe('manage folders', () => {
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

    it('list is empty initially, shows imported folder, rm removes it', async () => {
        const testFolder = createFolderInTestFolder(folder1)
        const folderPath = testFolder.path!

        const listEmpty = await $`${bin} list`.nothrow()
        expect(listEmpty.exitCode).toBe(0)
        expect(listEmpty.text().trim()).toBe('')

        const added = await $`${bin} add ${folderPath} --type tvshow --skip-init`.nothrow()
        expect(added.exitCode).toBe(0)
        expect(added.text()).toContain(`imported folder ${folderPath}`)

        const listed = await $`${bin} list`.nothrow()
        expect(listed.exitCode).toBe(0)
        expect(listed.text().trim().split('\n').filter(Boolean)).toEqual([folderPath])

        const removed = await $`${bin} rm ${folderPath}`.nothrow()
        expect(removed.exitCode).toBe(0)
        expect(removed.text()).toContain(`Removed ${folderPath}`)

        const listAfter = await $`${bin} list`.nothrow()
        expect(listAfter.exitCode).toBe(0)
        expect(listAfter.text().trim()).toBe('')
    })

    it('list shows multiple imported folders and rm removes only the targeted folder', async () => {
        const tvFolder = createFolderInTestFolder(folder1)
        const movieFolder = createFolderInTestFolder(folder2)
        const tvPath = tvFolder.path!
        const moviePath = movieFolder.path!

        const addTv = await $`${bin} add ${tvPath} --type tvshow --skip-init`.nothrow()
        expect(addTv.exitCode).toBe(0)

        const addMovie = await $`${bin} add ${moviePath} --type movie --skip-init`.nothrow()
        expect(addMovie.exitCode).toBe(0)

        const listed = await $`${bin} list`.nothrow()
        expect(listed.exitCode).toBe(0)
        const paths = listed.text().trim().split('\n').filter(Boolean)
        expect(paths).toHaveLength(2)
        expect(paths).toContain(tvPath)
        expect(paths).toContain(moviePath)

        const removed = await $`${bin} rm ${tvPath}`.nothrow()
        expect(removed.exitCode).toBe(0)
        expect(removed.text()).toContain(`Removed ${tvPath}`)

        const listAfter = await $`${bin} list`.nothrow()
        expect(listAfter.exitCode).toBe(0)
        expect(listAfter.text().trim().split('\n').filter(Boolean)).toEqual([moviePath])
    })
})

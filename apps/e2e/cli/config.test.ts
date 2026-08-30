import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { setup, cleanup, bin } from './base'
import { cliOutput } from './helpers'
import { $ } from 'bun'

describe('config', () => {
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

    it('lists the full user config as JSON', async () => {
        const listed = await $`${bin} config list`.nothrow()
        expect(listed.exitCode).toBe(0)
        const config = JSON.parse(listed.text()) as { dryRun: boolean; folders: string[] }
        expect(config.dryRun).toBe(false)
        expect(config.folders).toEqual([])
    })

    it('sets a key, gets the JSON value, and shows it in list', async () => {
        const set = await $`${bin} config set dryRun true`.nothrow()
        expect(set.exitCode).toBe(0)
        expect(JSON.parse(set.text())).toBe(true)

        const got = await $`${bin} config get dryRun`.nothrow()
        expect(got.exitCode).toBe(0)
        expect(JSON.parse(got.text())).toBe(true)

        const listed = await $`${bin} config list`.nothrow()
        expect(listed.exitCode).toBe(0)
        expect(JSON.parse(listed.text()).dryRun).toBe(true)
    })

    it('stores a non-JSON value as a string', async () => {
        const set = await $`${bin} config set selectedRenameRule plex`.nothrow()
        expect(set.exitCode).toBe(0)
        expect(JSON.parse(set.text())).toBe('plex')

        const got = await $`${bin} config get selectedRenameRule`.nothrow()
        expect(got.exitCode).toBe(0)
        expect(JSON.parse(got.text())).toBe('plex')
    })

    it('exits 1 when getting an unknown key', async () => {
        const got = await $`${bin} config get notAKey`.nothrow()
        expect(got.exitCode).toBe(1)
        expect(cliOutput(got)).toContain('Unknown config key: notAKey')
    })

    it('exits 1 when setting an unknown key', async () => {
        const set = await $`${bin} config set notAKey 1`.nothrow()
        expect(set.exitCode).toBe(1)
        expect(cliOutput(set)).toContain('Unknown config key: notAKey')
    })
})

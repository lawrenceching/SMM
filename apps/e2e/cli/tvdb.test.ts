import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { setup, cleanup, bin } from './base'
import { requiredEnv } from './helpers'
import { $ } from 'bun'

const FIVE_MINUTES_MS = 5 * 60 * 1000
const RESULT_HEADER = /^#1 \d+ .+ \(\d{4}(-\d{2}-\d{2})?\)$/m
// TVDB search returns the primary (often Japanese) title and the CLI prints
// only `item.name` — WATATEN's TVDB primary title is "私に天使が舞い降りた！".
const SERIES_TITLE = /天使|WATATEN|Angel Flew Down|Wataten/i
const KEYWORD = '天使降临到我身边'

function officialTvdb(): { host: string; password: string; proxy: string } {
    return {
        host: requiredEnv('TVDB_HOST'),
        password: requiredEnv('TVDB_API_KEY'),
        proxy: requiredEnv('TVDB_HTTP_PROXY'),
    }
}

describe('tvdb search', () => {

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

    it('search through SMM-provided TVDB host', async () => {

        const ret = await $`${bin} tvdb search ${KEYWORD} --type series`.nothrow()

        expect(ret.exitCode).toBe(0)
        expect(ret.text()).toMatch(RESULT_HEADER)
        expect(ret.text()).toMatch(SERIES_TITLE)
    }, FIVE_MINUTES_MS)

    it('search through SMM-provided TVDB host and HTTP/SOCKS proxy', async () => {

        const { proxy } = officialTvdb()
        const ret = await $`${bin} tvdb search ${KEYWORD} --type series --proxy ${proxy}`.nothrow()

        expect(ret.exitCode).toBe(0)
        expect(ret.text()).toMatch(RESULT_HEADER)
        expect(ret.text()).toMatch(SERIES_TITLE)
    }, FIVE_MINUTES_MS)

    it('search through custom TVDB host with password and proxy', async () => {

        const { host, password, proxy } = officialTvdb()
        const ret = await $`${bin} tvdb search ${KEYWORD} --type series --host ${host} --password ${password} --proxy ${proxy}`.nothrow()

        expect(ret.exitCode).toBe(0)
        expect(ret.text()).toMatch(RESULT_HEADER)
        expect(ret.text()).toMatch(SERIES_TITLE)
    }, FIVE_MINUTES_MS)
})

describe('tvdb tv / movie get', () => {

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

    it('gets series details (default) via SMM host with --lang zho', async () => {
        // Wataten / 天使降临到我身边 — same id as nfo recognition fixtures.
        const ret = await $`${bin} tvdb tv 355969 --lang zho`.nothrow()
        expect(ret.exitCode).toBe(0)
        const text = ret.text()
        expect(text).toMatch(/extended:/)
        expect(text).toMatch(/translation:/)
        expect(text).toMatch(/id: 355969/)
        expect(text).toMatch(SERIES_TITLE)
        expect(text).not.toMatch(/^database: TVDB$/m)
    }, FIVE_MINUTES_MS)

    it('gets series as JSON via custom host', async () => {
        const { host, password, proxy } = officialTvdb()
        const ret = await $`${bin} tvdb tv 355969 -f json --lang zho --host ${host} --password ${password} --proxy ${proxy}`.nothrow()
        expect(ret.exitCode).toBe(0)
        const body = JSON.parse(ret.text())
        expect(body.extended).toBeTruthy()
        expect(body.extended.id).toBe(355969)
        expect(body).toHaveProperty('translation')
        expect(body).not.toHaveProperty('database')
    }, FIVE_MINUTES_MS)

    it('gets movie details as JSON via SMM host', async () => {
        const ret = await $`${bin} tvdb movie 116 -f json --lang eng`.nothrow()
        expect(ret.exitCode).toBe(0)
        const body = JSON.parse(ret.text())
        expect(body.extended.id).toBe(116)
        expect(String(body.extended.name ?? body.translation?.name ?? '')).toMatch(/Dark Knight/i)
    }, FIVE_MINUTES_MS)

    it('rejects IETF --lang zh-CN', async () => {
        const ret = await $`${bin} tvdb tv 355969 --lang zh-CN`.nothrow()
        expect(ret.exitCode).toBe(1)
        const err = ret.stderr.toString() || ret.text()
        expect(err).toMatch(/ISO 639-3/i)
    }, FIVE_MINUTES_MS)

    it('rejects invalid id', async () => {
        const ret = await $`${bin} tvdb tv abc`.nothrow()
        expect(ret.exitCode).toBe(1)
        const err = ret.stderr.toString() || ret.text()
        expect(err).toMatch(/id must be a positive integer/i)
    }, FIVE_MINUTES_MS)
})

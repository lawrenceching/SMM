import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { setup, cleanup, bin } from './base'
import { requiredEnv } from './helpers'
import { $ } from 'bun'

const FIVE_MINUTES_MS = 5 * 60 * 1000
const RESULT_HEADER = /^#1 \d+ .+ \(\d{4}(-\d{2}-\d{2})?\)$/m
const TV_TITLE = /天使降临到我身边|WATATEN|Angel Flew Down|Wataten/i
const KEYWORD = '天使降临到我身边'

function officialTmdb(): { host: string; password: string; proxy: string } {
    return {
        host: requiredEnv('TMDB_HOST'),
        password: requiredEnv('TMDB_API_KEY'),
        proxy: requiredEnv('TMDB_HTTP_PROXY'),
    }
}

describe('tmdb search', () => {

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

    it('search through SMM-provided TMDB host', async () => {

        const ret = await $`${bin} tmdb search ${KEYWORD} --type tv`.nothrow()

        expect(ret.exitCode).toBe(0)
        expect(ret.text()).toMatch(RESULT_HEADER)
        expect(ret.text()).toMatch(TV_TITLE)
    }, FIVE_MINUTES_MS)

    it('search through SMM-provided TMDB host and HTTP/SOCKS proxy', async () => {

        const { proxy } = officialTmdb()
        const ret = await $`${bin} tmdb search ${KEYWORD} --type tv --proxy ${proxy}`.nothrow()

        expect(ret.exitCode).toBe(0)
        expect(ret.text()).toMatch(RESULT_HEADER)
        expect(ret.text()).toMatch(TV_TITLE)
    }, FIVE_MINUTES_MS)

    it('search through custom TMDB host', async () => {

        const { host, password, proxy } = officialTmdb()
        const ret = await $`${bin} tmdb search ${KEYWORD} --type tv --host ${host} --password ${password} --proxy ${proxy}`.nothrow()

        expect(ret.exitCode).toBe(0)
        expect(ret.text()).toMatch(RESULT_HEADER)
        expect(ret.text()).toMatch(TV_TITLE)
    }, FIVE_MINUTES_MS)

    it('search through custom TMDB host and password', async () => {

        const { host, password, proxy } = officialTmdb()
        const ret = await $`${bin} tmdb search ${KEYWORD} --type tv --host ${host} --password ${password} --proxy ${proxy}`.nothrow()

        expect(ret.exitCode).toBe(0)
        expect(ret.text()).toMatch(RESULT_HEADER)
        expect(ret.text()).toMatch(TV_TITLE)
    }, FIVE_MINUTES_MS)

    it('search through custom TMDB host, password and HTTP proxy', async () => {

        const { host, password, proxy } = officialTmdb()
        const ret = await $`${bin} tmdb search ${KEYWORD} --type tv --host ${host} --password ${password} --proxy ${proxy}`.nothrow()

        expect(ret.exitCode).toBe(0)
        expect(ret.text()).toMatch(RESULT_HEADER)
        expect(ret.text()).toMatch(TV_TITLE)
    }, FIVE_MINUTES_MS)
})

describe('tmdb tv / movie get', () => {

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

    it('gets TV show details (default format) via SMM-provided host', async () => {
        // Search result #1 for KEYWORD is TMDB id 84666 (WATATEN).
        const ret = await $`${bin} tmdb tv 84666 --lang zh-CN`.nothrow()
        expect(ret.exitCode).toBe(0)
        const text = ret.text()
        expect(text).toMatch(/id: 84666/)
        expect(text).toMatch(TV_TITLE)
    }, FIVE_MINUTES_MS)

    it('gets movie details as JSON via custom host', async () => {
        const { host, password, proxy } = officialTmdb()
        const ret = await $`${bin} tmdb movie 550 -f json --host ${host} --password ${password} --proxy ${proxy}`.nothrow()
        expect(ret.exitCode).toBe(0)
        const body = JSON.parse(ret.text())
        expect(body.id).toBe(550)
        expect(String(body.title ?? '')).toMatch(/Fight Club/i)
    }, FIVE_MINUTES_MS)
})

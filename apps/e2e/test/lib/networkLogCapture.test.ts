import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
    NETWORK_LOG_DIR,
    clearNetworkLogDir,
    formatNetworkEventSummary,
    initNetworkLogCapture,
    isNetworkLogEnabled,
    networkLogOutputPath,
    saveNetworkLog,
    setupNetworkLogCapture,
} from './networkLogCapture.ts'

describe('networkLogCapture', () => {
    const originalEnabled = process.env.NETWORK_LOG_ENABLED
    const originalCwd = process.cwd()
    let tmpCwd: string

    beforeEach(() => {
        tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'network-log-'))
        process.chdir(tmpCwd)
        delete process.env.NETWORK_LOG_ENABLED
        initNetworkLogCapture('0-0', ['test/specs/tv/SearchTvShow.e2e.ts'])
    })

    afterEach(() => {
        process.chdir(originalCwd)
        fs.rmSync(tmpCwd, { recursive: true, force: true })

        if (originalEnabled !== undefined) {
            process.env.NETWORK_LOG_ENABLED = originalEnabled
        } else {
            delete process.env.NETWORK_LOG_ENABLED
        }
    })

    test('isNetworkLogEnabled reads NETWORK_LOG_ENABLED', () => {
        expect(isNetworkLogEnabled()).toBe(false)

        process.env.NETWORK_LOG_ENABLED = 'true'
        expect(isNetworkLogEnabled()).toBe(true)
    })

    test('formatNetworkEventSummary formats request/response/error events', () => {
        expect(
            formatNetworkEventSummary('request', {
                request: { method: 'POST', url: 'http://localhost:30000/searchTvShow' },
            }),
        ).toBe('POST http://localhost:30000/searchTvShow')

        expect(
            formatNetworkEventSummary('response', {
                response: { status: 200, url: 'http://localhost:5173/' },
            }),
        ).toBe('200 http://localhost:5173/')

        expect(
            formatNetworkEventSummary('error', {
                errorText: 'Failed to fetch',
                request: { url: 'https://api.themoviedb.org/3/search/tv' },
            }),
        ).toBe('fetch failed: Failed to fetch')
    })

    test('saveNetworkLog writes spec and cid into output filename', async () => {
        process.env.NETWORK_LOG_ENABLED = 'true'

        const handlers: Record<string, (event: unknown) => void> = {}
        const browser = {
            sessionSubscribe: async () => {},
            on: (eventName: string, handler: (event: unknown) => void) => {
                handlers[eventName] = handler
            },
        }

        await setupNetworkLogCapture(browser as never)
        handlers['network.beforeRequestSent']?.({
            request: { method: 'GET', url: 'http://localhost:5173/' },
        })

        const outputPath = saveNetworkLog()
        expect(outputPath).toBe(path.join(NETWORK_LOG_DIR, 'SearchTvShow.e2e.ts-0-0.json'))
        expect(fs.existsSync(outputPath!)).toBe(true)

        const saved = JSON.parse(fs.readFileSync(outputPath!, 'utf8')) as {
            spec: string
            cid: string
            entries: Array<{ phase: string }>
        }
        expect(saved.spec).toBe('SearchTvShow.e2e.ts')
        expect(saved.cid).toBe('0-0')
        expect(saved.entries).toHaveLength(1)
        expect(saved.entries[0]?.phase).toBe('request')
    })

    test('clearNetworkLogDir removes existing files', () => {
        fs.mkdirSync(NETWORK_LOG_DIR, { recursive: true })
        fs.writeFileSync(path.join(NETWORK_LOG_DIR, 'old.json'), '{}')

        clearNetworkLogDir()

        expect(fs.readdirSync(NETWORK_LOG_DIR)).toHaveLength(0)
    })

    test('networkLogOutputPath uses current worker metadata', () => {
        initNetworkLogCapture('1-0', ['test/specs/movie/SearchMovie.e2e.ts'])
        expect(networkLogOutputPath()).toBe(
            path.join(NETWORK_LOG_DIR, 'SearchMovie.e2e.ts-1-0.json'),
        )
    })
})

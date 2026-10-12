import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureRemoteMcpServerRunning } from './remoteMcp'

describe('ensureRemoteMcpServerRunning', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('skips start when MCP is already running', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: { status: 'running', host: '127.0.0.1', port: 30001 },
                error: null,
            }),
        })
        vi.stubGlobal('fetch', fetchMock)

        await ensureRemoteMcpServerRunning({
            httpServerAddress: 'http://127.0.0.1:30000',
            authToken: 'secret',
        })

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            'http://127.0.0.1:30000/api/get-mcp-server-status',
        )
        expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
            method: 'GET',
            headers: { Authorization: 'Bearer secret' },
        })
    })

    it('starts MCP when status is stopped', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: { status: 'stopped' },
                    error: null,
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: {
                        status: 'running',
                        host: '127.0.0.1',
                        port: 30001,
                        url: 'http://127.0.0.1:30001/mcp',
                    },
                    error: null,
                }),
            })
        vi.stubGlobal('fetch', fetchMock)

        await ensureRemoteMcpServerRunning({
            httpServerAddress: 'http://127.0.0.1:30000',
            authToken: 'secret',
            mcpPort: 30001,
        })

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchMock.mock.calls[1]?.[0]).toBe(
            'http://127.0.0.1:30000/api/start-mcp-server',
        )
        expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
            method: 'POST',
            headers: {
                Authorization: 'Bearer secret',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ port: 30001 }),
        })
    })

    it('throws when start API returns an error', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: { status: 'stopped' },
                    error: null,
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: { status: 'error', error: 'port in use' },
                    error: 'Error Reason: port in use',
                }),
            })
        vi.stubGlobal('fetch', fetchMock)

        await expect(
            ensureRemoteMcpServerRunning({
                httpServerAddress: 'http://127.0.0.1:30000',
                authToken: 'secret',
            }),
        ).rejects.toThrow(/port in use/)
    })
})

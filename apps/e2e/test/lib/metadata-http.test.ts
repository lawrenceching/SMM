import { afterEach, describe, expect, test } from 'bun:test'
import { metadataHttpRequestInPage } from './metadata-http'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

describe('metadataHttpRequestInPage', () => {
    test('posts JSON with the supplied bearer token', async () => {
        let request: { input: string | URL | Request; init?: RequestInit } | undefined
        globalThis.fetch = (async (input, init) => {
            request = { input, init }
            return new Response(JSON.stringify({ data: { mediaFolderPath: '/media/show' } }), {
                status: 200,
            })
        }) as typeof fetch

        const result = await metadataHttpRequestInPage(
            '/api/get-metadata',
            { path: '/media/show' },
            'secret-token',
        )

        expect(request?.input).toBe('/api/get-metadata')
        expect(request?.init).toMatchObject({
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: 'Bearer secret-token',
            },
            body: JSON.stringify({ path: '/media/show' }),
        })
        expect(result).toEqual({
            ok: true,
            status: 200,
            text: JSON.stringify({ data: { mediaFolderPath: '/media/show' } }),
        })
    })

    test('returns a 404 response for the caller to map to null', async () => {
        globalThis.fetch = (async () => new Response('missing', {
            status: 404,
        })) as unknown as typeof fetch

        await expect(
            metadataHttpRequestInPage('/api/get-metadata', { path: '/missing' }),
        ).resolves.toEqual({ ok: false, status: 404, text: 'missing' })
    })
})

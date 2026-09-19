import { describe, expect, test } from 'bun:test'
import {
    isTransientHelloFetchError,
    retryOnTransientHelloFetch,
} from './retry-transient-hello-fetch.ts'

describe('retryOnTransientHelloFetch', () => {
    test('retries only Failed to fetch, then returns the later success', async () => {
        const sleeps: number[] = []
        let calls = 0
        const result = await retryOnTransientHelloFetch(
            async () => {
                calls += 1
                if (calls < 3) {
                    throw new Error('javascript error: Failed to fetch')
                }
                return 'ok'
            },
            {
                attempts: 5,
                delayMs: 1000,
                sleep: async (ms) => {
                    sleeps.push(ms)
                },
            },
        )

        expect(result).toBe('ok')
        expect(calls).toBe(3)
        expect(sleeps).toEqual([1000, 1000])
    })

    test('does not retry HTTP or missing-path errors', async () => {
        let calls = 0
        await expect(
            retryOnTransientHelloFetch(
                async () => {
                    calls += 1
                    throw new Error('fetchHelloPathsViaBrowser failed: hello missing paths: {}')
                },
                {
                    attempts: 5,
                    sleep: async () => {
                        throw new Error('sleep should not run')
                    },
                },
            ),
        ).rejects.toThrow('hello missing paths')
        expect(calls).toBe(1)
    })

    test('stops after the attempt budget when Failed to fetch persists', async () => {
        let calls = 0
        await expect(
            retryOnTransientHelloFetch(
                async () => {
                    calls += 1
                    throw new Error('Failed to fetch')
                },
                {
                    attempts: 3,
                    sleep: async () => {},
                },
            ),
        ).rejects.toThrow('Failed to fetch')
        expect(calls).toBe(3)
    })
})

describe('isTransientHelloFetchError', () => {
    test('matches the browser network error and ignores other failures', () => {
        expect(isTransientHelloFetchError(new Error('javascript error: Failed to fetch'))).toBe(true)
        expect(isTransientHelloFetchError('Failed to fetch')).toBe(true)
        expect(isTransientHelloFetchError(new Error('hello missing paths'))).toBe(false)
        expect(isTransientHelloFetchError(new Error('HTTP 500'))).toBe(false)
    })
})

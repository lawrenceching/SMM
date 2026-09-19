const DEFAULT_ATTEMPTS = 5
const DEFAULT_DELAY_MS = 1000

/** Network failure from `fetch()` inside the page. HTTP status errors do not throw this. */
export function isTransientHelloFetchError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error)
    return message.includes('Failed to fetch')
}

/**
 * Retry only while the UI server is not yet accepting `/api/hello`.
 * Missing paths and other errors fail on the first attempt.
 */
export async function retryOnTransientHelloFetch<T>(
    operation: () => Promise<T>,
    options: {
        attempts?: number
        delayMs?: number
        sleep?: (ms: number) => Promise<void>
    } = {},
): Promise<T> {
    const attempts = options.attempts ?? DEFAULT_ATTEMPTS
    const delayMs = options.delayMs ?? DEFAULT_DELAY_MS
    const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await operation()
        } catch (error) {
            if (!isTransientHelloFetchError(error) || attempt === attempts) {
                throw error
            }
            console.warn(
                `[E2E] /api/hello Failed to fetch (attempt ${attempt}/${attempts}), retrying`,
            )
            await sleep(delayMs)
        }
    }

    throw new Error('retryOnTransientHelloFetch: unreachable')
}

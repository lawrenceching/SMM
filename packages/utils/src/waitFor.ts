export interface WaitForOptions {
  /** Max time to keep retrying (ms). Default: 1000. */
  timeout?: number
  /** Delay between retries (ms). Default: 50. */
  interval?: number
}

/**
 * Poll `callback` until it resolves without throwing, or until `timeout`.
 * Compatible with Vitest's `vi.waitFor` option shape (`timeout`, `interval`).
 */
export async function waitFor<T>(
  callback: () => T | Promise<T>,
  options: WaitForOptions = {},
): Promise<T> {
  const timeout = options.timeout ?? 1_000
  const interval = options.interval ?? 50
  const deadline = Date.now() + timeout

  let lastError: unknown

  for (;;) {
    try {
      return await callback()
    } catch (error) {
      lastError = error
    }

    if (Date.now() >= deadline) {
      if (lastError instanceof Error) {
        throw lastError
      }
      throw new Error(`waitFor timed out after ${timeout}ms`)
    }

    const remaining = deadline - Date.now()
    await sleep(Math.min(interval, Math.max(0, remaining)))
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

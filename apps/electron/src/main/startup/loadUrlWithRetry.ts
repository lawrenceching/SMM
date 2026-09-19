export async function loadUrlWithRetry(
  load: (url: string) => Promise<void>,
  url: string,
  options: {
    attempts?: number
    delayMs?: number
    sleep?: (ms: number) => Promise<void>
  } = {},
): Promise<void> {
  const attempts = options.attempts ?? 10
  const delayMs = options.delayMs ?? 500
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await load(url)
      return
    } catch (error) {
      lastError = error
      if (attempt === attempts) {
        throw error
      }
      await sleep(delayMs)
    }
  }
  throw lastError
}

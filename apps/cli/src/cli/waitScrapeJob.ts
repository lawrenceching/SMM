import type { Core, ScrapeJob } from '@smm/core'

const DEFAULT_POLL_MS = 20

export async function waitUntilScrapeSettled(
  core: Core,
  id: string,
  options: { timeoutMs: number; pollMs?: number } = { timeoutMs: 5 * 60 * 1000 },
): Promise<ScrapeJob> {
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS
  const deadline = Date.now() + options.timeoutMs

  for (;;) {
    const job = core.getJob(id)
    if (job?.kind === 'scrape') {
      if (job.status !== 'pending' && job.status !== 'running') {
        return job
      }
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for scrape job ${id}`)
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
}

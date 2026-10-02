import { describe, expect, it } from 'vitest'
import type { ScrapeJobTask, ScrapeTaskId } from '@smm/core'
import { formatScrapeJobTaskLines, scrapeStatusIcon } from './scrapeJobFormat'

function scrapeJob(tasks: Record<ScrapeTaskId, ScrapeJobTask>) {
  return { tasks }
}

describe('scrapeJobFormat', () => {
  it('maps runtime status to icons', () => {
    expect(scrapeStatusIcon('pending')).toBe('○')
    expect(scrapeStatusIcon('running')).toBe('◐')
    expect(scrapeStatusIcon('skipped')).toBe('–')
    expect(scrapeStatusIcon('completed')).toBe('✓')
    expect(scrapeStatusIcon('failed')).toBe('✗')
  })

  it('formats four display lines with thumbnail label', () => {
    const lines = formatScrapeJobTaskLines(
      scrapeJob({
        poster: { status: 'completed' },
        fanart: { status: 'failed', error: 'network' },
        thumbnails: { status: 'running' },
        nfo: { status: 'pending' },
      }),
    )
    expect(lines).toEqual(['poster ✓', 'fanart ✗', 'thumbnail ◐', 'nfo ○'])
  })
})

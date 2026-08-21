import { describe, expect, it } from 'vitest'
import { SCRAPE_JOB_CREATED_MESSAGE } from '../types/ai-tools/scrape'
import { scrapeFailed, scrapeSucceeded } from './scrapeResult'

describe('scrapeResult', () => {
  it('scrapeSucceeded returns id and fixed message', () => {
    const result = scrapeSucceeded('job-1')
    expect(result).toEqual({
      id: 'job-1',
      message: SCRAPE_JOB_CREATED_MESSAGE,
    })
  })

  it('scrapeFailed includes path in error', () => {
    const result = scrapeFailed('/m/Show', 'Error Reason: not managed')
    expect(result.id).toBe('')
    expect(result.message).toBe('')
    expect(result.error).toMatch(/not managed/)
    expect(result.error).toMatch(/Show/)
  })
})

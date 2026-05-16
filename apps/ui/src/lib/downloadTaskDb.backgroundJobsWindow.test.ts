import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  BACKGROUND_JOBS_UI_WINDOW_MS,
  isWithinBackgroundJobsUiWindow,
  isWithinOneHour,
  type TaskJobRecord,
} from './downloadTaskDb'

function record(overrides: Partial<TaskJobRecord>): TaskJobRecord {
  return {
    id: 'job-1',
    name: 'Test',
    status: 'succeeded',
    progress: 100,
    type: 'download-video',
    folder: '/f',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('background jobs UI window', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('isWithinOneHour uses createdAt only', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    expect(isWithinOneHour(now - 30 * 60 * 1000)).toBe(true)
    expect(isWithinOneHour(now - 2 * 60 * 60 * 1000)).toBe(false)
  })

  it('isWithinBackgroundJobsUiWindow uses updatedAt when newer than createdAt', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    const oldCreated = now - 2 * 60 * 60 * 1000
    const recentUpdate = now - 10 * 60 * 1000
    expect(isWithinOneHour(oldCreated)).toBe(false)
    expect(
      isWithinBackgroundJobsUiWindow(
        record({ createdAt: oldCreated, updatedAt: recentUpdate }),
      ),
    ).toBe(true)
  })

  it('excludes records outside the 24h UI window', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    const ts = now - BACKGROUND_JOBS_UI_WINDOW_MS - 1
    expect(isWithinBackgroundJobsUiWindow(record({ createdAt: ts, updatedAt: ts }))).toBe(
      false,
    )
  })
})

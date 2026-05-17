import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AddTestBackgroundJobDialog } from './AddTestBackgroundJobDialog'
import { UI_FixedDelayBackgroundJobEvent } from '@/types/eventTypes'

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (key === 'addTestBackgroundJob.jobName') {
        return `job-${opts?.seconds}-${opts?.outcome}`
      }
      if (key === 'addTestBackgroundJob.durationSeconds') return `${opts?.seconds}s`
      if (key === 'addTestBackgroundJob.outcomeSucceeded') return 'Success'
      if (key === 'addTestBackgroundJob.outcomeFailed') return 'Failure'
      if (key === 'cancel') return 'Cancel'
      return key
    },
  }),
}))

describe('AddTestBackgroundJobDialog', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches fixed delay event with default duration and outcome on submit', () => {
    const handler = vi.fn()
    document.addEventListener(UI_FixedDelayBackgroundJobEvent, handler)

    render(<AddTestBackgroundJobDialog isOpen onClose={onClose} />)

    fireEvent.click(screen.getByTestId('add-test-background-job-submit'))

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0]![0] as CustomEvent
    expect(event.detail.delay).toBe(60_000)
    expect(event.detail.outcome).toBe('succeeded')
    expect(onClose).toHaveBeenCalled()

    document.removeEventListener(UI_FixedDelayBackgroundJobEvent, handler)
  })
})

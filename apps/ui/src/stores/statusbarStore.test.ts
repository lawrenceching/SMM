import { describe, it, expect, beforeEach } from 'vitest'
import { useStatusbarStore } from './statusbarStore'

describe('statusbarStore', () => {
  beforeEach(() => {
    useStatusbarStore.setState({ isBackgroundJobsPopoverOpen: false })
  })

  it('setBackgroundJobsPopoverOpen updates popover visibility', () => {
    useStatusbarStore.getState().setBackgroundJobsPopoverOpen(true)
    expect(useStatusbarStore.getState().isBackgroundJobsPopoverOpen).toBe(true)

    useStatusbarStore.getState().setBackgroundJobsPopoverOpen(false)
    expect(useStatusbarStore.getState().isBackgroundJobsPopoverOpen).toBe(false)
  })
})

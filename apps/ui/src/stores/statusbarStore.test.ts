import { describe, it, expect, beforeEach } from 'vitest'
import { useStatusbarStore } from './statusbarStore'

describe('statusbarStore', () => {
  beforeEach(() => {
    useStatusbarStore.setState({
      isBackgroundJobsPopoverOpen: false,
      bootstrap: { status: 'initializing' },
    })
  })

  it('setBackgroundJobsPopoverOpen updates popover visibility', () => {
    useStatusbarStore.getState().setBackgroundJobsPopoverOpen(true)
    expect(useStatusbarStore.getState().isBackgroundJobsPopoverOpen).toBe(true)

    useStatusbarStore.getState().setBackgroundJobsPopoverOpen(false)
    expect(useStatusbarStore.getState().isBackgroundJobsPopoverOpen).toBe(false)
  })

  it('setBootstrap updates bootstrap phase', () => {
    useStatusbarStore.getState().setBootstrap({ status: 'ready' })
    expect(useStatusbarStore.getState().bootstrap).toEqual({ status: 'ready' })

    useStatusbarStore.getState().setBootstrap({ status: 'error', message: 'disk full' })
    expect(useStatusbarStore.getState().bootstrap).toEqual({
      status: 'error',
      message: 'disk full',
    })
  })
})

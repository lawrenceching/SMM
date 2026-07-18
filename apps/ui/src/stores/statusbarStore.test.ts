import { describe, it, expect, beforeEach } from 'vitest'
import { useStatusbarStore } from './statusbarStore'

describe('statusbarStore', () => {
  beforeEach(() => {
    useStatusbarStore.setState({
      isBackgroundJobsPopoverOpen: false,
      initializationMessage: null,
    })
  })

  it('setBackgroundJobsPopoverOpen updates popover visibility', () => {
    useStatusbarStore.getState().setBackgroundJobsPopoverOpen(true)
    expect(useStatusbarStore.getState().isBackgroundJobsPopoverOpen).toBe(true)

    useStatusbarStore.getState().setBackgroundJobsPopoverOpen(false)
    expect(useStatusbarStore.getState().isBackgroundJobsPopoverOpen).toBe(false)
  })

  it('setInitializationMessage updates initialization status text', () => {
    useStatusbarStore.getState().setInitializationMessage('Initializing...')
    expect(useStatusbarStore.getState().initializationMessage).toBe('Initializing...')

    useStatusbarStore.getState().setInitializationMessage(null)
    expect(useStatusbarStore.getState().initializationMessage).toBeNull()
  })
})

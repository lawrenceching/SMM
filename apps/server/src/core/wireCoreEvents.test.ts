import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MEDIA_METADATA_UPDATED_EVENT } from '@smm/core'

const { broadcastMock } = vi.hoisted(() => ({
  broadcastMock: vi.fn(),
}))

vi.mock('@/utils/socketIO', () => ({
  broadcast: broadcastMock,
}))

import { wireCoreEvents } from './wireCoreEvents'

describe('wireCoreEvents', () => {
  beforeEach(() => {
    broadcastMock.mockReset()
  })

  it('broadcasts mediaMetadataUpdated when Core emits the event', () => {
    const listeners: Array<(data: { folderPath?: string }) => void> = []
    const core = {
      on: vi.fn((_event: string, listener: (data: { folderPath?: string }) => void) => {
        listeners.push(listener)
      }),
    }

    wireCoreEvents(core as never)

    expect(core.on).toHaveBeenCalledWith(MEDIA_METADATA_UPDATED_EVENT, expect.any(Function))

    listeners[0]?.({ folderPath: '/media/ShowA' })

    expect(broadcastMock).toHaveBeenCalledWith({
      event: MEDIA_METADATA_UPDATED_EVENT,
      data: { folderPath: '/media/ShowA' },
    })
  })

  it('skips broadcast when folderPath is missing', () => {
    const listeners: Array<(data: { folderPath?: string }) => void> = []
    const core = {
      on: vi.fn((_event: string, listener: (data: { folderPath?: string }) => void) => {
        listeners.push(listener)
      }),
    }

    wireCoreEvents(core as never)
    listeners[0]?.({})

    expect(broadcastMock).not.toHaveBeenCalled()
  })
})

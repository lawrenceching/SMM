import { describe, expect, test } from 'bun:test'
import { stopMcpViaStatusBarIfOn } from './mcpSpecShared'

describe('stopMcpViaStatusBarIfOn', () => {
  test('skips click when toggle is already off', async () => {
    const clicks: string[] = []
    const result = await stopMcpViaStatusBarIfOn({
      ensurePopoverOpen: async () => {
        clicks.push('open')
      },
      isOn: async () => false,
      clickSwitch: async () => {
        clicks.push('click')
      },
      waitUntilOff: async () => {
        clicks.push('wait')
      },
    })
    expect(result).toBe('skipped-already-off')
    expect(clicks).toEqual(['open'])
  })

  test('clicks switch and waits until off when toggle is on', async () => {
    const clicks: string[] = []
    const result = await stopMcpViaStatusBarIfOn({
      ensurePopoverOpen: async () => {
        clicks.push('open')
      },
      isOn: async () => true,
      clickSwitch: async () => {
        clicks.push('click')
      },
      waitUntilOff: async (timeoutMs) => {
        expect(timeoutMs).toBeGreaterThan(0)
        clicks.push('wait')
      },
    })
    expect(result).toBe('stopped')
    expect(clicks).toEqual(['open', 'click', 'wait'])
  })
})

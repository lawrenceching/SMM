import { describe, expect, test } from 'bun:test'
import {
  stopMcpServerIfRunningForUserConfigReset,
} from './browser-fs'

describe('stopMcpServerIfRunningForUserConfigReset', () => {
  test('skips stop when status is not running', async () => {
    const calls: string[] = []
    const result = await stopMcpServerIfRunningForUserConfigReset({
      getStatus: async () => {
        calls.push('status')
        return { error: null, data: { status: 'stopped' } }
      },
      stop: async () => {
        calls.push('stop')
        return { error: null }
      },
    })
    expect(result).toBe('skipped')
    expect(calls).toEqual(['status'])
  })

  test('skips stop when status API errors', async () => {
    const calls: string[] = []
    const result = await stopMcpServerIfRunningForUserConfigReset({
      getStatus: async () => {
        calls.push('status')
        return { error: 'Error Reason: MCP lifecycle not configured', data: null }
      },
      stop: async () => {
        calls.push('stop')
        return { error: null }
      },
    })
    expect(result).toBe('skipped')
    expect(calls).toEqual(['status'])
  })

  test('stops when status is running', async () => {
    const calls: string[] = []
    const result = await stopMcpServerIfRunningForUserConfigReset({
      getStatus: async () => {
        calls.push('status')
        return { error: null, data: { status: 'running' } }
      },
      stop: async () => {
        calls.push('stop')
        return { error: null }
      },
    })
    expect(result).toBe('stopped')
    expect(calls).toEqual(['status', 'stop'])
  })

  test('throws when stop fails while server is running', async () => {
    await expect(
      stopMcpServerIfRunningForUserConfigReset({
        getStatus: async () => ({ error: null, data: { status: 'running' } }),
        stop: async () => ({ error: 'Error Reason: boom' }),
      }),
    ).rejects.toThrow(/Failed to stop MCP server during user config reset: Error Reason: boom/)
  })
})

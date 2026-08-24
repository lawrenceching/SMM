import { describe, expect, it, vi, beforeEach } from 'vitest'
import { runCli } from './runCli'

const mockHello = vi.fn(() => ({
  uptime: 12,
  version: '9.9.9',
  platform: 'linux',
  userDataDir: '/data/ud',
  appDataDir: '/data/ad',
  tmpDir: '/tmp/smm',
  logDir: '/data/ad/logs',
  osLocale: 'en-US',
}))

vi.mock('../core/getCore', () => ({
  getCore: () => ({ hello: mockHello }),
}))

describe('smm hello', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prints human-readable lines by default', async () => {
    const logs: string[] = []
    const errors: string[] = []
    const origLog = console.log
    const origError = console.error
    console.log = (msg: string) => logs.push(msg)
    console.error = (msg: string) => errors.push(msg)
    try {
      const code = await runCli(['node', 'smm', 'hello'])
      expect(code).toBe(0)
      expect(mockHello).toHaveBeenCalledOnce()
      expect(logs).toEqual([
        'Version: 9.9.9',
        'Platform: linux',
        'Uptime: 12s',
        'User data dir: /data/ud',
        'App data dir: /data/ad',
        'Tmp dir: /tmp/smm',
        'Log dir: /data/ad/logs',
        'OS locale: en-US',
      ])
      expect(errors).toEqual([])
    } finally {
      console.log = origLog
      console.error = origError
    }
  })

  it('prints JSON with -f json', async () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)
    try {
      const code = await runCli(['node', 'smm', 'hello', '-f', 'json'])
      expect(code).toBe(0)
      expect(JSON.parse(logs[0]!)).toEqual(mockHello())
    } finally {
      console.log = origLog
    }
  })
})

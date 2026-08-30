import { describe, expect, it, afterEach } from 'vitest'
import { Path } from '@smm/utils/path'
import { syncPathServerPlatformFromHello } from './syncPathServerPlatform'

describe('syncPathServerPlatformFromHello', () => {
  afterEach(() => {
    Path.resetServerPlatformForTests()
  })

  it('binds Path helpers to hello.platform', () => {
    syncPathServerPlatformFromHello({
      platform: 'linux',
      uptime: 0,
      version: 'test',
      userDataDir: '/root/.config',
      appDataDir: '/root/.local',
      tmpDir: '/tmp/smm',
      logDir: '/root/.local/logs',
      reverseProxyUrl: null,
      osLocale: 'en-US',
    })

    expect(Path.getServerPlatform()).toBe('linux')
    expect(Path.toPlatformPath('/root/.cache/smm/foo')).toBe('/root/.cache/smm/foo')
  })
})

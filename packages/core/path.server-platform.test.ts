import { describe, expect, it, afterEach } from 'vitest'
import { Path } from './path'

describe('Path server platform (hello.platform)', () => {
  afterEach(() => {
    Path.resetServerPlatformForTests()
  })

  it('toPlatformPath keeps POSIX when server is linux (browser on Windows host)', () => {
    Path.setServerPlatform('linux')
    const posix = '/root/.cache/smm/smm-test-folder/Show Name'
    expect(Path.toPlatformPath(posix)).toBe(posix)
  })

  it('toPlatformPath converts to Windows when server is win32', () => {
    Path.setServerPlatform('win32')
    expect(Path.toPlatformPath('/home/user/show')).toBe('\\\\home\\user\\show')
    expect(Path.toPlatformPath('C:\\Media\\show')).toBe('C:\\Media\\show')
  })

  it('prefers server platform over client when set', () => {
    Path.setServerPlatform('linux')
    expect(Path.isWindows()).toBe(false)
    Path.setServerPlatform('win32')
    expect(Path.isWindows()).toBe(true)
  })
})

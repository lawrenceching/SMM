import { describe, expect, it } from 'vitest'
import { formatHelloLines } from './helloFormat'

describe('formatHelloLines', () => {
  it('formats bootstrap fields one per line', () => {
    expect(
      formatHelloLines({
        uptime: 42.5,
        version: '1.3.8',
        platform: 'win32',
        userDataDir: 'C:\\Users\\me\\AppData\\Roaming\\SMM',
        appDataDir: 'C:\\Users\\me\\AppData\\Local\\SMM',
        tmpDir: 'C:\\Temp\\smm',
        logDir: 'C:\\Users\\me\\AppData\\Local\\SMM\\logs',
        osLocale: 'zh-CN',
      }),
    ).toEqual([
      'Version: 1.3.8',
      'Platform: win32',
      'Uptime: 42.5s',
      'User data dir: C:\\Users\\me\\AppData\\Roaming\\SMM',
      'App data dir: C:\\Users\\me\\AppData\\Local\\SMM',
      'Tmp dir: C:\\Temp\\smm',
      'Log dir: C:\\Users\\me\\AppData\\Local\\SMM\\logs',
      'OS locale: zh-CN',
    ])
  })
})

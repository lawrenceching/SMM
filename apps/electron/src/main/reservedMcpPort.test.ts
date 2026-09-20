import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RESERVED_MCP_PORT,
  cliUserConfigPath,
  reservedMcpPortFromUserConfig,
} from './reservedMcpPort'

describe('reservedMcpPortFromUserConfig', () => {
  it('reserves the mcpPort configured in smm.json', () => {
    expect(reservedMcpPortFromUserConfig({ mcpPort: 40000 })).toBe(40000)
  })

  it('reserves the default MCP port when smm.json omits mcpPort', () => {
    expect(reservedMcpPortFromUserConfig({})).toBe(DEFAULT_RESERVED_MCP_PORT)
    expect(reservedMcpPortFromUserConfig({ folders: [] })).toBe(30001)
  })

  it('reserves the default MCP port when the value is not a TCP port', () => {
    expect(reservedMcpPortFromUserConfig({ mcpPort: 0 })).toBe(30001)
    expect(reservedMcpPortFromUserConfig({ mcpPort: 1.5 })).toBe(30001)
    expect(reservedMcpPortFromUserConfig({ mcpPort: '30001' })).toBe(30001)
    expect(reservedMcpPortFromUserConfig(null)).toBe(30001)
  })
})

describe('cliUserConfigPath', () => {
  it('uses the same smm.json path the CLI reads', () => {
    expect(
      cliUserConfigPath({
        platform: 'win32',
        homedir: 'C:\\Users\\me',
        env: { APPDATA: 'C:\\Users\\me\\AppData\\Roaming' },
      }),
    ).toBe('C:\\Users\\me\\AppData\\Roaming\\SMM\\smm.json')

    expect(
      cliUserConfigPath({
        platform: 'linux',
        homedir: '/home/me',
        env: {},
      }),
    ).toBe('/home/me/.config/smm/smm.json')

    expect(
      cliUserConfigPath({
        platform: 'darwin',
        homedir: '/Users/me',
        env: { USER_DATA_DIR: '/tmp/smm-user' },
      }),
    ).toBe('/tmp/smm-user/smm.json')
  })
})

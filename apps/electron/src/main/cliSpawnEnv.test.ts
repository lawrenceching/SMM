import { describe, expect, it } from 'vitest'
import { buildCliSpawnEnv } from './cliSpawnEnv'

describe('buildCliSpawnEnv', () => {
  it('forces SMM_AUTH_ENABLED=false even when the parent env enables auth', () => {
    const env = buildCliSpawnEnv(
      { SMM_AUTH_ENABLED: 'true', PATH: '/usr/bin' },
      '/app/resources',
    )
    expect(env.SMM_AUTH_ENABLED).toBe('false')
    expect(env.SMM_RESOURCES_PATH).toBe('/app/resources')
    expect(env.LOG_TARGET).toBe('file')
    expect(env.PATH).toBe('/usr/bin')
  })

  it('sets HTTP_PORT so each Electron instance gets its own HTTP port', () => {
    const env = buildCliSpawnEnv(
      { HTTP_PORT: '3001' },
      '/app/resources',
      { httpPort: 30002 },
    )
    expect(env.HTTP_PORT).toBe('30002')
  })
})

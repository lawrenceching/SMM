import { describe, expect, it } from 'vitest'
import { buildCliSpawnEnv } from './cliSpawnEnv'

describe('buildCliSpawnEnv', () => {
  it('forces SMM_AUTH_ENABLED=false even when parent env enables auth', () => {
    const env = buildCliSpawnEnv(
      {
        PATH: '/usr/bin',
        SMM_AUTH_ENABLED: 'true',
        SMM_AUTH_TOKEN: 'ChangeMe123',
      },
      '/app/resources',
    )

    expect(env.SMM_AUTH_ENABLED).toBe('false')
    expect(env.SMM_AUTH_TOKEN).toBe('ChangeMe123')
    expect(env.SMM_RESOURCES_PATH).toBe('/app/resources')
    expect(env.LOG_TARGET).toBe('file')
    expect(env.PATH).toBe('/usr/bin')
  })
})

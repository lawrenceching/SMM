import { describe, expect, it } from 'vitest'
import { DEFAULT_CORE_ROUTES_PORT, resolveCoreRoutesPort } from './coreRoutesPort'

describe('resolveCoreRoutesPort', () => {
  it('defaults to 3001 when no env is set', () => {
    expect(resolveCoreRoutesPort({})).toBe(DEFAULT_CORE_ROUTES_PORT)
    expect(DEFAULT_CORE_ROUTES_PORT).toBe(3001)
  })

  it('uses CLI_PORT when set', () => {
    expect(resolveCoreRoutesPort({ CLI_PORT: '3002' })).toBe(3002)
  })

  it('falls back to CORE_ROUTES_PORT when CLI_PORT is unset', () => {
    expect(resolveCoreRoutesPort({ CORE_ROUTES_PORT: '4001' })).toBe(4001)
  })

  it('prefers CLI_PORT over CORE_ROUTES_PORT', () => {
    expect(
      resolveCoreRoutesPort({ CLI_PORT: '3002', CORE_ROUTES_PORT: '4001' }),
    ).toBe(3002)
  })

  it('falls back to default for invalid values', () => {
    expect(resolveCoreRoutesPort({ CLI_PORT: 'abc' })).toBe(DEFAULT_CORE_ROUTES_PORT)
    expect(resolveCoreRoutesPort({ CLI_PORT: '0' })).toBe(DEFAULT_CORE_ROUTES_PORT)
    expect(resolveCoreRoutesPort({ CLI_PORT: '-1' })).toBe(DEFAULT_CORE_ROUTES_PORT)
    expect(resolveCoreRoutesPort({ CLI_PORT: '' })).toBe(DEFAULT_CORE_ROUTES_PORT)
  })
})

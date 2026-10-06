import { describe, expect, it } from 'vitest'
import { DEFAULT_CORE_ROUTES_PORT, resolveCoreRoutesPort } from './coreRoutesPort'

describe('resolveCoreRoutesPort (compat alias)', () => {
  it('defaults to HTTP default port', () => {
    expect(resolveCoreRoutesPort({})).toBe(DEFAULT_CORE_ROUTES_PORT)
    expect(DEFAULT_CORE_ROUTES_PORT).toBe(30000)
  })

  it('uses HTTP_PORT when set', () => {
    expect(resolveCoreRoutesPort({ HTTP_PORT: '3002' })).toBe(3002)
  })
})

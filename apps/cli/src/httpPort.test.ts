import { describe, expect, it } from 'vitest'
import { DEFAULT_HTTP_PORT, resolveHttpPort } from './httpPort'

describe('resolveHttpPort', () => {
  it('defaults to 30000', () => {
    expect(resolveHttpPort({})).toBe(DEFAULT_HTTP_PORT)
    expect(DEFAULT_HTTP_PORT).toBe(30000)
  })

  it('uses HTTP_PORT when set', () => {
    expect(resolveHttpPort({ HTTP_PORT: '8080' })).toBe(8080)
  })

  it('falls back to PORT when HTTP_PORT is unset', () => {
    expect(resolveHttpPort({ PORT: '4000' })).toBe(4000)
  })

  it('prefers HTTP_PORT over PORT', () => {
    expect(resolveHttpPort({ HTTP_PORT: '8080', PORT: '4000' })).toBe(8080)
  })

  it('ignores invalid values', () => {
    expect(resolveHttpPort({ HTTP_PORT: 'abc' })).toBe(DEFAULT_HTTP_PORT)
    expect(resolveHttpPort({ HTTP_PORT: '0' })).toBe(DEFAULT_HTTP_PORT)
    expect(resolveHttpPort({ HTTP_PORT: '-1' })).toBe(DEFAULT_HTTP_PORT)
    expect(resolveHttpPort({ HTTP_PORT: '' })).toBe(DEFAULT_HTTP_PORT)
  })
})

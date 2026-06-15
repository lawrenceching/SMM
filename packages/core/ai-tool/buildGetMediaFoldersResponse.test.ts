import { describe, it, expect } from 'vitest'
import type { UserConfig } from '../types'
import {
  buildGetMediaFoldersResponse,
  createEmptyGetMediaFoldersData,
} from './buildGetMediaFoldersResponse'

function createUserConfig(overrides: Partial<UserConfig> = {}): UserConfig {
  return {
    folders: [],
    ...overrides,
  } as UserConfig
}

describe('buildGetMediaFoldersResponse', () => {
  it('returns folders from user config', () => {
    const config = createUserConfig({
      folders: ['/media/tv', '/media/movies'],
    })
    expect(buildGetMediaFoldersResponse(config)).toEqual({
      folders: ['/media/tv', '/media/movies'],
    })
  })

  it('returns empty array when folders is missing', () => {
    const config = createUserConfig({ folders: undefined })
    expect(buildGetMediaFoldersResponse(config)).toEqual({ folders: [] })
  })

  it('createEmptyGetMediaFoldersData returns empty folders', () => {
    expect(createEmptyGetMediaFoldersData()).toEqual({ folders: [] })
  })
})

import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { metadataCachePath } from './testFolders'

describe('metadataCachePath', () => {
  it('sanitizes folder path and appends .json under appDataDir/metadata', () => {
    const result = metadataCachePath('/tmp/app-data', '/media/My TV Show: S01/E01')
    expect(result).toBe(
      join('/tmp/app-data', 'metadata', '_media_My TV Show_ S01_E01.json'),
    )
  })

  it('keeps plain folder names unchanged', () => {
    const result = metadataCachePath('/tmp/app-data', '/media/tvshow')
    expect(result).toBe(join('/tmp/app-data', 'metadata', '_media_tvshow.json'))
  })
})

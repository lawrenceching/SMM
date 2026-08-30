import { describe, expect, it } from 'vitest'
import { Path } from '@core/path'
import { mergeFolderPathsWithUiStatus } from './mergeFolderPathsWithUiStatus'
import type { UIMediaFolder } from '@/types/UIMediaFolder'

describe('mergeFolderPathsWithUiStatus', () => {
  it('defaults status to ok when Zustand has no row', () => {
    const result = mergeFolderPathsWithUiStatus(['/m/A'], [])
    expect(result).toEqual([
      expect.objectContaining({
        status: 'ok',
        path: Path.toPlatformPath('/m/A'),
      }),
    ])
  })

  it('preserves Zustand status/type/test when path matches', () => {
    const existing: UIMediaFolder[] = [
      {
        path: Path.toPlatformPath('/m/A'),
        status: 'initializing',
        type: 'tvshow-folder',
        test: true,
      },
    ]
    const result = mergeFolderPathsWithUiStatus(['/m/A'], existing)
    expect(result[0]?.status).toBe('initializing')
    expect(result[0]?.type).toBe('tvshow-folder')
    expect(result[0]?.test).toBe(true)
  })

  it('follows query path order', () => {
    const existing: UIMediaFolder[] = [
      { path: Path.toPlatformPath('/m/B'), status: 'ok' },
      { path: Path.toPlatformPath('/m/A'), status: 'ok' },
    ]
    const result = mergeFolderPathsWithUiStatus(['/m/A', '/m/B'], existing)
    expect(result.map((r) => r.path)).toEqual([
      Path.toPlatformPath('/m/A'),
      Path.toPlatformPath('/m/B'),
    ])
    expect(result).toHaveLength(2)
  })
})

import { describe, expect, it } from 'vitest'
import type { Plan } from '@smm/core'
import { formatPlanDetailLines, formatPlanListLine, planFileCount } from './planFormat'

const recognize: Plan = {
  id: '11111111-1111-1111-1111-111111111111',
  task: 'recognize-media-file',
  status: 'pending',
  creator: 'app',
  mediaFolderPath: '/m/Show',
  files: [{ season: 1, episode: 2, path: '/m/Show/S01E02.mkv' }],
}

const rename: Plan = {
  id: '22222222-2222-2222-2222-222222222222',
  task: 'rename-files',
  status: 'rejected',
  creator: 'app',
  mediaFolderPath: '/m/Show',
  files: [{ from: '/m/Show/a.mkv', to: '/m/Show/b.mkv' }],
}

describe('planFormat', () => {
  it('formats list line', () => {
    expect(formatPlanListLine(recognize)).toBe(
      '11111111-1111-1111-1111-111111111111  recognize-media-file  pending  /m/Show',
    )
  })

  it('formats recognize detail like try-to-recognize', () => {
    expect(formatPlanDetailLines(recognize)).toEqual([
      'plan: 11111111-1111-1111-1111-111111111111',
      'task: recognize-media-file',
      'status: pending',
      'folder: /m/Show',
      'files:',
      '  S01E02  /m/Show/S01E02.mkv',
    ])
  })

  it('formats rename detail like try-to-rename', () => {
    expect(formatPlanDetailLines(rename)).toEqual([
      'plan: 22222222-2222-2222-2222-222222222222',
      'task: rename-files',
      'status: rejected',
      'folder: /m/Show',
      'files:',
      '  /m/Show/a.mkv → /m/Show/b.mkv',
    ])
  })

  it('planFileCount', () => {
    expect(planFileCount(recognize)).toBe(1)
    expect(planFileCount(rename)).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'
import type { ImportJob } from 'core-app'
import { createAddProgressState, emitAddProgress } from './addProgress'

function job(partial: Partial<ImportJob>): ImportJob {
  return {
    kind: "import",
    id: "j1",
    folderPath: "/m/Show",
    type: "tvshow",
    status: "running",
    stage: "config",
    progress: 0,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

describe('emitAddProgress', () => {
  it('prints the tvshow-friendly sequence', () => {
    const lines: string[] = []
    const log = (line: string) => lines.push(line)
    let state = createAddProgressState()
    const folder = 'C:\\media\\Show'

    state = emitAddProgress(state, job({ stage: 'config', progress: 0 }), folder, 'tvshow', log)
    expect(lines).toEqual([])

    state = emitAddProgress(state, job({ stage: 'config', progress: 10 }), folder, 'tvshow', log)
    expect(lines).toEqual([`imported folder ${folder}`])

    state = emitAddProgress(state, job({ stage: 'listFiles', progress: 40 }), folder, 'tvshow', log)
    expect(lines.at(-1)).toBe('recognizing tvshow')

    state = emitAddProgress(
      state,
      job({ stage: 'recognize', progress: 60, recognizedTitle: 'Demo Show' }),
      folder,
      'tvshow',
      log,
    )
    expect(lines.slice(-2)).toEqual([
      'recognized tvshow "Demo Show"',
      'recognizing episodes',
    ])

    state = emitAddProgress(state, job({ stage: 'episodes', progress: 80 }), folder, 'tvshow', log)
    expect(lines.at(-1)).toBe('recognized episodes')

    state = emitAddProgress(
      state,
      job({ stage: null, progress: 100, status: 'succeeded', recognizedTitle: 'Demo Show' }),
      folder,
      'tvshow',
      log,
    )
    expect(lines.at(-1)).toBe('succeeded')
    expect(lines).toEqual([
      `imported folder ${folder}`,
      'recognizing tvshow',
      'recognized tvshow "Demo Show"',
      'recognizing episodes',
      'recognized episodes',
      'succeeded',
    ])
  })

  it('when recognition finds no title, prints that clearly and skips episode lines', () => {
    const lines: string[] = []
    const log = (line: string) => lines.push(line)
    let state = createAddProgressState()
    const folder = 'C:\\media\\Unknown'

    state = emitAddProgress(state, job({ stage: 'config', progress: 10 }), folder, 'tvshow', log)
    state = emitAddProgress(state, job({ stage: 'listFiles', progress: 40 }), folder, 'tvshow', log)
    state = emitAddProgress(state, job({ stage: 'recognize', progress: 60 }), folder, 'tvshow', log)
    state = emitAddProgress(state, job({ stage: 'episodes', progress: 80 }), folder, 'tvshow', log)
    state = emitAddProgress(
      state,
      job({ stage: null, progress: 100, status: 'succeeded' }),
      folder,
      'tvshow',
      log,
    )

    expect(lines).toEqual([
      `imported folder ${folder}`,
      'recognizing tvshow',
      'recognition completed and no tvshow was recognized.',
      'succeeded',
    ])
  })

  it('for music only prints imported folder and succeeded', () => {
    const lines: string[] = []
    let state = createAddProgressState()
    const folder = '/m/Music'
    state = emitAddProgress(state, job({ type: 'music', stage: 'config', progress: 10 }), folder, 'music', (l) => lines.push(l))
    state = emitAddProgress(state, job({ type: 'music', stage: 'listFiles', progress: 40 }), folder, 'music', (l) => lines.push(l))
    state = emitAddProgress(
      state,
      job({ type: 'music', stage: null, progress: 100, status: 'succeeded' }),
      folder,
      'music',
      (l) => lines.push(l),
    )
    expect(lines).toEqual([`imported folder ${folder}`, 'succeeded'])
  })
})

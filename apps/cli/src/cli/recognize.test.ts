import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetCoreForTests } from '../core/getCore'

describe('smm recognize', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetCoreForTests()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    vi.restoreAllMocks()
    resetCoreForTests()
  })

  it('manual mode calls recognizeFolder with db+id', async () => {
    const { Core } = await import('core-app')
    const recognizeFolder = vi.spyOn(Core.prototype, 'recognizeFolder').mockResolvedValue()
    const { runCli } = await import('./runCli')
    const code = await runCli([
      'node', 'smm', 'recognize', '/m/Show', '--db', 'tmdb', '--id', '84666',
    ])
    expect(code).toBe(0)
    expect(recognizeFolder).toHaveBeenCalledWith('/m/Show', { db: 'tmdb', id: '84666' })
    expect(logSpy).toHaveBeenCalledWith('Metadata is updated')
  })

  it('exits 1 when only --db is provided', async () => {
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'recognize', '/m/Show', '--db', 'tmdb'])
    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('--yes accepts tryToRecognizeFolder candidate', async () => {
    const { Core } = await import('core-app')
    vi.spyOn(Core.prototype, 'tryToRecognizeFolder').mockResolvedValue({
      db: 'tmdb',
      id: '84666',
      title: 'WATATEN',
      year: '2019',
      kind: 'tvshow',
    })
    const recognizeFolder = vi.spyOn(Core.prototype, 'recognizeFolder').mockResolvedValue()
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'recognize', '/m/Show', '--yes'])
    expect(code).toBe(0)
    expect(recognizeFolder).toHaveBeenCalledWith('/m/Show', { db: 'tmdb', id: '84666' })
  })
})

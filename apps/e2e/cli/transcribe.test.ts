import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $ } from 'bun'
import { setup, cleanup, bin } from './base'
import { cliOutput } from './helpers'
import { prepareVideoFile } from '../test/lib/prepareVideoFile'
import { checkVideoCaptionerAvailable } from '../test/lib/checkVideoCaptionerAvailable'

const TEN_MINUTES_MS = 10 * 60 * 1000
const hasVc = checkVideoCaptionerAvailable()

describe('transcribe subtitle', () => {
  let workDir: string | undefined

  beforeEach(async () => {
    await setup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: false,
      resetUserConfig: true,
    })
    workDir = mkdtempSync(join(tmpdir(), 'smm-e2e-transcribe-'))
  })

  afterEach(async () => {
    if (workDir && existsSync(workDir)) {
      rmSync(workDir, { recursive: true, force: true })
    }
    workDir = undefined
    await cleanup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: false,
      resetUserConfig: true,
    })
  })

  it.skipIf(!hasVc)(
    'transcribes sample.mp4 via smm transcribe',
    async () => {
      expect(workDir).toBeDefined()
      const mediaPath = join(workDir!, 'sample.mp4')
      const srtPath = join(workDir!, 'sample.srt')

      await prepareVideoFile(mediaPath)

      const ret =
        await $`${bin} transcribe ${mediaPath} --folder ${workDir!} --format srt`.nothrow()

      if (ret.exitCode !== 0) {
        console.error(cliOutput(ret))
      }
      expect(ret.exitCode).toBe(0)
      expect(existsSync(srtPath)).toBe(true)
      expect(statSync(srtPath).size).toBeGreaterThan(0)
    },
    TEN_MINUTES_MS,
  )
})

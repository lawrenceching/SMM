import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $ } from 'bun'
import * as cp from 'node:child_process'
import { setup, cleanup, bin } from './base'
import { cliOutput } from './helpers'
import { prepareVideoFile } from '../test/lib/prepareVideoFile'

const TEN_MINUTES_MS = 10 * 60 * 1000

function checkFfmpegAvailable(): boolean {
  try {
    cp.execSync('ffmpeg -version', { stdio: 'ignore', timeout: 5_000 })
    return true
  } catch {
    return false
  }
}

const hasFfmpeg = checkFfmpegAvailable()

describe('compress video', () => {
  let workDir: string | undefined

  beforeEach(async () => {
    await setup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: false,
      resetUserConfig: true,
    })
    workDir = mkdtempSync(join(tmpdir(), 'smm-e2e-compress-'))
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

  it.skipIf(!hasFfmpeg)(
    'compresses sample.mp4 via smm compress',
    async () => {
      expect(workDir).toBeDefined()
      const inputPath = join(workDir!, 'sample.mp4')
      const outputPath = join(workDir!, 'sample-out.mp4')

      await prepareVideoFile(inputPath)
      expect(existsSync(inputPath)).toBe(true)
      expect(statSync(inputPath).size).toBeGreaterThan(0)

      const ret =
        await $`${bin} compress ${inputPath} -o ${outputPath} --folder ${workDir!} --container mp4`.nothrow()

      if (ret.exitCode !== 0) {
        console.error(cliOutput(ret))
      }
      expect(ret.exitCode).toBe(0)
      expect(existsSync(outputPath)).toBe(true)
      expect(statSync(outputPath).size).toBeGreaterThan(0)
    },
    TEN_MINUTES_MS,
  )
})

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $ } from 'bun'
import { setup, cleanup, bin } from './base'
import { cliOutput } from './helpers'
import { prepareVideoFile } from '../test/lib/prepareVideoFile'
import { prepareMinimalSrt } from '../test/lib/prepareMinimalSrt'
import { checkVideoCaptionerAvailable } from '../test/lib/checkVideoCaptionerAvailable'

const TEN_MINUTES_MS = 10 * 60 * 1000
const hasVc = checkVideoCaptionerAvailable()

describe('synthesize subtitle', () => {
  let workDir: string | undefined

  beforeEach(async () => {
    await setup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: false,
      resetUserConfig: true,
    })
    workDir = mkdtempSync(join(tmpdir(), 'smm-e2e-synthesize-'))
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
    'burns sample.srt into sample.mp4 via smm synthesize',
    async () => {
      expect(workDir).toBeDefined()
      const mediaPath = join(workDir!, 'sample.mp4')
      const srtPath = join(workDir!, 'sample.srt')
      await prepareVideoFile(mediaPath)
      prepareMinimalSrt(srtPath)
      const beforeVideos = new Map(
        readdirSync(workDir!)
          .filter((n) => /\.(mp4|mkv|webm|mov)$/i.test(n))
          .map((n) => [n, statSync(join(workDir!, n)).mtimeMs] as const),
      )

      const ret =
        await $`${bin} synthesize ${mediaPath} -s ${srtPath} --folder ${workDir!}`.nothrow()

      if (ret.exitCode !== 0) {
        console.error(cliOutput(ret))
        console.error('dir:', readdirSync(workDir!))
      }
      expect(ret.exitCode).toBe(0)

      const after = readdirSync(workDir!).filter((n) => /\.(mp4|mkv|webm|mov)$/i.test(n))
      const changed = after.some((n) => {
        const full = join(workDir!, n)
        if (statSync(full).size <= 0) return false
        const prev = beforeVideos.get(n)
        return prev === undefined || statSync(full).mtimeMs > prev
      })
      expect(changed).toBe(true)
    },
    TEN_MINUTES_MS,
  )
})

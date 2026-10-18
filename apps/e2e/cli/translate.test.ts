import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $ } from 'bun'
import { setup, cleanup, bin } from './base'
import { cliOutput } from './helpers'
import { prepareMinimalSrt } from '../test/lib/prepareMinimalSrt'
import { checkVideoCaptionerAvailable } from '../test/lib/checkVideoCaptionerAvailable'

const TEN_MINUTES_MS = 10 * 60 * 1000
const hasVc = checkVideoCaptionerAvailable()

describe('translate subtitle', () => {
  let workDir: string | undefined

  beforeEach(async () => {
    await setup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: false,
      resetUserConfig: true,
    })
    workDir = mkdtempSync(join(tmpdir(), 'smm-e2e-translate-'))
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
    'translates minimal.srt via smm translate google→en',
    async () => {
      expect(workDir).toBeDefined()
      const srtPath = join(workDir!, 'sample.srt')
      prepareMinimalSrt(srtPath)
      const before = new Map(
        readdirSync(workDir!)
          .filter((n) => n.toLowerCase().endsWith('.srt'))
          .map((n) => [n, statSync(join(workDir!, n)).mtimeMs] as const),
      )

      const ret =
        await $`${bin} translate ${srtPath} --folder ${workDir!} --translator google --target-language en`.nothrow()

      if (ret.exitCode !== 0) {
        console.error(cliOutput(ret))
        console.error('dir:', readdirSync(workDir!))
      }
      expect(ret.exitCode).toBe(0)

      const afterNames = readdirSync(workDir!).filter((n) => n.toLowerCase().endsWith('.srt'))
      const changed = afterNames.some((n) => {
        const full = join(workDir!, n)
        const size = statSync(full).size
        if (size <= 0) return false
        const prev = before.get(n)
        return prev === undefined || statSync(full).mtimeMs > prev
      })
      expect(changed).toBe(true)
    },
    TEN_MINUTES_MS,
  )
})

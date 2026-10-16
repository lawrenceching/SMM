import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { $ } from 'bun'
import { setup, cleanup, bin } from './base'
import { cliOutput } from './helpers'

const TEN_MINUTES_MS = 10 * 60 * 1000

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=KJ_7KPKlO_Q'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const youtubeCookiesPath = join(repoRoot, '.local', 'youtube_cookies.txt')
const hasYoutubeCookies = existsSync(youtubeCookiesPath)

const MEDIA_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.m4a', '.mp3', '.opus']

function listDownloadedMedia(dir: string): string[] {
  return readdirSync(dir).filter((name) => {
    const lower = name.toLowerCase()
    return MEDIA_EXTENSIONS.some((ext) => lower.endsWith(ext))
  })
}

describe('download video', () => {
  let downloadDir: string | undefined

  beforeEach(async () => {
    await setup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: false,
      resetUserConfig: true,
    })
    downloadDir = mkdtempSync(join(tmpdir(), 'smm-e2e-download-'))
  })

  afterEach(async () => {
    if (downloadDir && existsSync(downloadDir)) {
      rmSync(downloadDir, { recursive: true, force: true })
    }
    downloadDir = undefined
    await cleanup({
      binary: bin,
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: false,
      resetUserConfig: true,
    })
  })

  it.skipIf(!hasYoutubeCookies)(
    'downloads a YouTube video using .local/youtube_cookies.txt',
    async () => {
      expect(existsSync(youtubeCookiesPath)).toBe(true)
      expect(downloadDir).toBeDefined()

      // Prefer dedicated ytdlp proxy; fall back to the TMDB proxy used by other e2e suites.
      const proxy =
        process.env.YTDLP_HTTP_PROXY?.trim() ||
        process.env.TMDB_HTTP_PROXY?.trim() ||
        ''

      const ret = proxy
        ? await $`${bin} download ${YOUTUBE_URL} --folder ${downloadDir!} --cookies ${youtubeCookiesPath} --proxy ${proxy} --verbose`.nothrow()
        : await $`${bin} download ${YOUTUBE_URL} --folder ${downloadDir!} --cookies ${youtubeCookiesPath} --verbose`.nothrow()

      if (ret.exitCode !== 0) {
        console.error(cliOutput(ret))
      }
      expect(ret.exitCode).toBe(0)

      const media = listDownloadedMedia(downloadDir!)
      expect(media.length).toBeGreaterThan(0)
      for (const name of media) {
        expect(statSync(join(downloadDir!, name)).size).toBeGreaterThan(0)
      }
    },
    TEN_MINUTES_MS,
  )
})

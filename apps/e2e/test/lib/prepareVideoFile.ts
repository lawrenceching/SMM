/**
 * Download-once sample MP4 for ffmpeg e2e (CLI + Web).
 * Re-exported from `testbed.ts` for Web specs; CLI imports this module
 * directly to avoid pulling `@wdio/globals` via testbed.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** `apps/e2e/test/lib` → repo root */
const REPO_ROOT = path.resolve(__dirname, '../../../..')

export const SAMPLE_MP4_URL =
  'https://github.com/lawrenceching/SMM/releases/download/v0.0.1/sample.mp4'

export const SAMPLE_MP4_CACHE_PATH = path.join(REPO_ROOT, '.local', 'samples', 'sample.mp4')

/**
 * Ensure `filepath` is a copy of the cached sample.mp4.
 * Downloads the release asset into `.local/samples/sample.mp4` when missing.
 */
export async function prepareVideoFile(filepath: string): Promise<void> {
  if (!fs.existsSync(SAMPLE_MP4_CACHE_PATH)) {
    fs.mkdirSync(path.dirname(SAMPLE_MP4_CACHE_PATH), { recursive: true })
    const response = await fetch(SAMPLE_MP4_URL)
    if (!response.ok) {
      throw new Error(
        `Failed to download sample video (${response.status} ${response.statusText}): ${SAMPLE_MP4_URL}`,
      )
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength < 1_000) {
      throw new Error(
        `Downloaded sample video is too small (${buffer.byteLength} bytes): ${SAMPLE_MP4_URL}`,
      )
    }
    fs.writeFileSync(SAMPLE_MP4_CACHE_PATH, buffer)
  }

  const destDir = path.dirname(filepath)
  fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(SAMPLE_MP4_CACHE_PATH, filepath)
}

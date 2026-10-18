import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')

export const VIDEOCAPTIONER_EXE_NAME =
  process.platform === 'win32' ? 'videocaptioner.exe' : 'videocaptioner'

export const VIDEOCAPTIONER_EXE_PATH = path.join(
  REPO_ROOT,
  'bin',
  'videocaptioner',
  VIDEOCAPTIONER_EXE_NAME,
)

/** True when CI/local `bin/videocaptioner` layout from `ci/download-3pp-binary.sh` is present. */
export function checkVideoCaptionerAvailable(): boolean {
  return fs.existsSync(VIDEOCAPTIONER_EXE_PATH)
}

import os from 'node:os'
import path from 'node:path'

/** Shared WDIO driver/browser cache root for browser, electron, and ohos configs. */
export const WDIO_CACHE_DIR = path.join(os.homedir(), 'wdio-cache')

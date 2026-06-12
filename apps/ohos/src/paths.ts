import path from "node:path"

let appRoot: string | undefined

function isUsableAppRoot(dir: string): boolean {
  if (dir.length === 0) return false
  if (dir === "/" || dir === "\\") return false
  if (/^[A-Za-z]:\\?$/.test(dir)) return false
  return true
}

function resolveAppRootFromScript(scriptPath: string): string | null {
  const base = path.basename(scriptPath)
  if (base === "main.js" && !scriptPath.includes(path.sep) && !scriptPath.includes("/")) {
    return null
  }

  const resolved = path.resolve(scriptPath)
  const dir = path.dirname(resolved)
  return isUsableAppRoot(dir) ? dir : null
}

/** Set the runtime app root (resfile/resources/app). Prefer `app.getAppPath()` on Electron. */
export function initAppRoot(root: string): void {
  const resolved = path.resolve(root)
  if (!isUsableAppRoot(resolved)) {
    throw new Error(`Invalid app root: ${root}`)
  }
  appRoot = resolved
}

/** Runtime app root (resfile/resources/app). */
export function getAppRoot(): string {
  if (appRoot) {
    return appRoot
  }

  const mainFilename = require.main?.filename
  if (mainFilename) {
    const fromMain = resolveAppRootFromScript(mainFilename)
    if (fromMain) {
      appRoot = fromMain
      return appRoot
    }
  }

  const argvScript = process.argv[1]
  if (argvScript) {
    const fromArgv = resolveAppRootFromScript(argvScript)
    if (fromArgv) {
      appRoot = fromArgv
      return appRoot
    }
  }

  throw new Error(
    "Unable to resolve app root. Call initAppRoot(app.getAppPath()) during Electron startup.",
  )
}

export const MAIN_HTTP_PORT = 18081
export const MAIN_HTTP_ORIGIN = `http://127.0.0.1:${MAIN_HTTP_PORT}`
export const MAIN_HTTP_HELLO_BODY = "Hello from Electron Main process"

export const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
}

export function getDistDir(): string {
  return path.join(getAppRoot(), "dist")
}

export function getTestIndexPath(): string {
  return path.join(getAppRoot(), "testPage", "index.html")
}

/** Set to true to load testPage/index.html instead of the HTTP server UI. */
export const USE_DEV_PAGE = false

/** @internal Test helper */
export function resetAppRootForTests(): void {
  appRoot = undefined
}

/** @internal Test helper */
export function resolveAppRootFromScriptForTests(scriptPath: string): string | null {
  return resolveAppRootFromScript(scriptPath)
}

/** @internal Test helper */
export function isUsableAppRootForTests(dir: string): boolean {
  return isUsableAppRoot(dir)
}

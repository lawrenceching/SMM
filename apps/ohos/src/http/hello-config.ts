import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { app } from "electron"
import { getAppRoot, MAIN_HTTP_PORT } from "../paths"

export function buildHelloConfig(reverseProxyUrl: string | null): Record<string, unknown> {
  let userDataDir: string
  let tmpDir: string
  try {
    userDataDir = app.getPath("userData")
    tmpDir = app.getPath("temp")
  } catch (err) {
    console.warn("[main] app.getPath failed for hello config, falling back to os.tmpdir():", err)
    userDataDir = os.tmpdir()
    tmpDir = os.tmpdir()
  }

  const logDir = path.join(userDataDir, "logs")
  let version = "0.0.0"
  try {
    const require = createRequire(path.join(getAppRoot(), "package.json"))
    version = (require(path.join(getAppRoot(), "package.json")) as { version: string }).version
  } catch {
    // keep default
  }

  return {
    version,
    userDataDir,
    appDataDir: userDataDir,
    logDir,
    tmpDir,
    reverseProxyUrl,
    osLocale: app.getLocale(),
    coreRoutesPort: MAIN_HTTP_PORT,
  }
}

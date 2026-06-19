import os from "node:os"
import path from "node:path"
import { app } from "electron"
import { MAIN_HTTP_PORT } from "../paths"
import { APP_VERSION } from "../version"

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

  return {
    version: APP_VERSION,
    userDataDir,
    appDataDir: userDataDir,
    logDir,
    tmpDir,
    reverseProxyUrl,
    osLocale: app.getLocale(),
    coreRoutesPort: MAIN_HTTP_PORT,
  }
}

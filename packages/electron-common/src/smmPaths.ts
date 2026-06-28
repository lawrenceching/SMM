import os from "os"
import { join } from "path"

/**
 * Log directory for SMM CLI file logging (`smm.log`).
 * Matches `getLogDir()` in apps/cli/src/utils/config.ts.
 */
export function getSmmLogDir(): string {
  const dirFromEnv = process.env.LOG_DIR?.trim()
  if (dirFromEnv) {
    return dirFromEnv
  }

  const platform = os.platform()
  const homedir = os.homedir()

  switch (platform) {
    case "win32":
      return process.env.LOCALAPPDATA
        ? join(process.env.LOCALAPPDATA, "SMM", "logs")
        : join(homedir, "AppData", "Local", "SMM", "logs")
    case "darwin":
      return join(homedir, "Library", "Logs", "SMM")
    case "linux":
      return process.env.XDG_DATA_HOME
        ? join(process.env.XDG_DATA_HOME, "smm", "logs")
        : join(homedir, ".local", "share", "smm", "logs")
    default:
      return join(homedir, ".local", "share", "smm", "logs")
  }
}

export function getSmmLogFilePath(): string {
  return join(getSmmLogDir(), "smm.log")
}

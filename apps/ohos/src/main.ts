import { app, ipcMain, session } from "electron"
import { registerDialogIpcHandlers, registerExecuteChannelIpcHandlers } from "@smm/electron-common"
import { startMainHttpServer } from "./http/server"
import { registerOhosFileAccessPermission } from "./ipc/file-access-permission"
import { initAppRoot } from "./paths"
import { getAllowedRootItems, resolveRedirect } from "./redirect/file-protocol-redirect"
import { createMainWindow } from "./window/create-main-window"
import {
  loadCoreRoutes,
  type CoreRoutesLogger,
} from "./core-routes-loader"

registerDialogIpcHandlers(ipcMain)
registerExecuteChannelIpcHandlers(ipcMain)
registerOhosFileAccessPermission(ipcMain)

let isQuitting = false

/**
 * Console-backed {@link CoreRoutesLogger} used by the cleanup pipeline.
 * Mirrors the shape the cli uses with pino, so log lines look consistent
 * regardless of host. Levels map directly onto the standard
 * `console.{debug,info,warn,error}` channels; the structured object is
 * JSON-stringified so all fields (e.g. `plansDir`, `removed`, `failed`)
 * remain searchable in `adb logcat`.
 *
 * Every line is prefixed with `[cleanup]` so operators can
 * `adb logcat | grep '[cleanup]'` to isolate cleanup-related events.
 */
function createPlanCleanupLogger(phase: "startup" | "shutdown"): CoreRoutesLogger {
  const prefix = `[cleanup]`
  return {
    debug: (obj, msg) => console.debug(prefix, msg ?? "debug", obj),
    info: (obj, msg) => console.info(prefix, msg ?? "info", obj),
    warn: (obj, msg) => console.warn(prefix, msg ?? "warn", obj),
    error: (obj, msg) => console.error(prefix, msg ?? "error", obj),
  }
}

/**
 * Run shared plan-file cleanup from `@smm/core-routes`. Falls back to a
 * no-op (and a warning) if the loaded bundle predates the cleanup
 * orchestration — older deployments should keep working.
 */
async function runPlanCleanup(phase: "startup" | "shutdown"): Promise<void> {
  const logger = createPlanCleanupLogger(phase)
  try {
    const coreRoutes = loadCoreRoutes() as {
      cleanupStalePlans?: (
        appDataDir: string,
        fs?: unknown,
        logger?: CoreRoutesLogger,
      ) => Promise<number>
    }
    if (typeof coreRoutes.cleanupStalePlans !== "function") {
      logger.warn(
        {
          hint: "rebuild with pnpm --filter @smm/core-routes build:ohos",
        },
        "[cleanup] cleanupStalePlans not in core-routes bundle; skipping plan cleanup",
      )
      return
    }
    const appDataDir = app.getPath("userData")
    const removed = await coreRoutes.cleanupStalePlans(appDataDir, undefined, logger)
    logger.info({ removed, phase }, "[cleanup] plan cleanup phase finished")
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[cleanup] plan cleanup threw an unexpected error",
    )
  }
}

app.whenReady().then(() => {
  initAppRoot(app.getAppPath())

  getAllowedRootItems()

  // Remove stale preparing plan files before the HTTP server starts so
  // any incoming plan requests see a clean state.
  void runPlanCleanup("startup").then(() => {
    void startMainHttpServer().catch((err) => {
      console.error("[main] failed to start HTTP server:", err)
    })
  })

  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    const redirect = resolveRedirect(details.url)
    if (redirect && redirect !== details.url) {
      cb({ redirectURL: redirect })
    } else {
      cb({ cancel: false })
    }
  })

  createMainWindow()
})

// On normal quit, clear any preparing plan files left behind by an
// interrupted session. We only run the lightweight plan cleanup here —
// the HTTP server is torn down by the Electron lifecycle itself.
app.on("before-quit", (event) => {
  if (isQuitting) {
    return
  }
  event.preventDefault()
  isQuitting = true
  void runPlanCleanup("shutdown").finally(() => {
    app.quit()
  })
})

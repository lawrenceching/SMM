# SMM for HarmonyOS

`apps/ohos` holds the codebase for HarmonyOS/OpenHarmony app.
The core is an electron version that ported to HarmonyOS.

Electron main process entry file: `./web_engine/src/main/resources/resfile/resources/app/main.js`

Electron preload file: `./web_engine/src/main/resources/resfile/resources/app/preload.js`

Electron UI bundle: `./web_engine/src/main/resources/resfile/resources/app/dist/` (served over HTTP, not `file://`)

At runtime the main process starts an HTTP server on `http://127.0.0.1:18081` that serves the UI static assets from `dist/` and core-routes API handlers at `/api/*`. The browser window loads `http://127.0.0.1:18081/` via `loadURL`, matching the desktop Electron + CLI pattern.

## Build

From repo root:

```bash
# Build UI
pnpm --filter ui build

# Build shared Electron artifacts and copy UI into ohos resfile
pnpm --filter ohos build
```

`pnpm --filter ohos build` runs:

1. `build:electron-common` — bundles `@smm/electron-common` into `electron-common.cjs` and `preload.js`
2. `copy-ui` — copies `apps/ui/dist` into the HarmonyOS app resources

To rebuild only the shared Electron IPC/preload after changing `packages/electron-common`:

```bash
pnpm --filter ohos build:electron-common
```

HarmonyOS file access persist IPC (`fileAccess:persist`) is registered in `main.js` via `registerFileAccessPersistIpcHandlers`. The preload exposes `window.electron.fileAccess.persist(paths)` which calls `systemPreferences.fileAccessPersist()` in the main process.

## References

https://gitcode.com/openharmony-sig/electron

# SMM for HarmonyOS

`apps/ohos` holds the codebase for HarmonyOS/OpenHarmony app.
The core is an electron version that ported to HarmonyOS.

## Electron runtime files

| File | Role |
|------|------|
| `web_engine/src/main/resources/resfile/resources/app/main.js` | **Build output** — bundled from `apps/ohos/src/` |
| `web_engine/src/main/resources/resfile/resources/app/preload.js` | Preload script (copied from `packages/electron-common/ohos/preload.js`) |
| `web_engine/src/main/resources/resfile/resources/app/core-routes.js` | Shared HTTP API handlers (copied from `@smm/core-routes` build) |
| `web_engine/src/main/resources/resfile/resources/app/dist/` | UI static assets (copied from `apps/ui/dist`) |

At runtime the main process starts an HTTP server on `http://127.0.0.1:18081` that serves the UI static assets from `dist/` and core-routes API handlers at `/api/*`. The browser window loads `http://127.0.0.1:18081/` via `loadURL`.

HarmonyOS IPC is registered in the bundled main process. The preload exposes:

- `window.electron.dialog.showOpenDialog` / `showSaveDialog`
- `window.electron.fileAccess.persist(paths)` / `activate(paths)`
- `window.api.executeChannel(request)` — e.g. `open-in-file-manager` to open a folder, `open-file` to open a file with the default app

## Source layout

```
apps/ohos/src/
  main.ts                         # entry
  paths.ts                        # constants
  core-routes-loader.ts           # runtime require('./core-routes.js')
  http/                           # HTTP server, static files, CORS
  redirect/                       # file:// redirect for Vite assets
  ipc/file-access-permission.ts   # OHOS fileShare.activatePermission IPC
  window/create-main-window.ts    # BrowserWindow + Tray
```

## Build

From repo root:

```bash
# Full HarmonyOS resource build (UI + core-routes + main.js + copy)
pnpm run build:ohos
```

Rebuild only the Electron main process after changing `apps/ohos/src/`:

```bash
pnpm --filter @smm/ohos-electron-main build
```

Typecheck and test:

```bash
pnpm --filter @smm/ohos-electron-main typecheck
pnpm --filter @smm/ohos-electron-main test
```

`pnpm run build:ohos` runs:

1. `core-routes build:cjs` — builds shared API handlers
2. `ui build` — builds the React UI
3. `@smm/ohos-electron-main build` — bundles TypeScript main to `main.js`
4. Copies `core-routes.js`, `preload.js`, and `dist/` into the HarmonyOS resfile

## References

https://gitcode.com/openharmony-sig/electron

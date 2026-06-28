---
"@smm/core-routes": minor
"cli": minor
---

feat(core-routes): extract startup/shutdown plan cleanup into shared module, run on OHOS too

The plan-file cleanup logic (deleting stale `preparing` plan files
left over from a previous session) was previously only called from
the CLI. This change moves the orchestration into
`@smm/core-routes` as `cleanupStalePlans(appDataDir, fs?, logger?)`
so all hosts benefit.

- New `packages/core-routes/src/cleanup.ts` exposes
  `cleanupStalePlans`. The CLI now calls this instead of
  `cleanPreparingPlans` directly.
- `apps/ohos` (HarmonyOS Electron) gains cleanup on both startup
  (in `app.whenReady()`, before `startMainHttpServer`) and shutdown
  (in `app.on('before-quit')`). The OHOS main process dynamically
  loads the function from the `core-routes` bundle and tolerates
  older bundles that predate the orchestration.
- The CLI preserves its existing pre-shutdown cleanup ordering:
  `YtdlpCookiesCleaner` runs first, then `cleanupStalePlans`,
  inside the `Server` `beforeStop` hook.
- `cleanPreparingPlans` / `cleanupStalePlans` accept an optional
  `CoreRoutesLogger`. The CLI passes its pino logger; OHOS creates
  a console-backed `CoreRoutesLogger` (with a `[cleanup]` prefix
  for `adb logcat`).
- All cleanup-related log messages are prefixed with `[cleanup]`
  for easy `grep '[cleanup]'` / `adb logcat | grep '[cleanup]'`
  filtering across the unified log stream.
- `apps/cli/index.ts` adds a one-line summary log on each phase
  (`[cleanup] stale preparing plan files cleaned up on startup/shutdown`).

Behaviour summary:

| Host          | Startup cleanup | Shutdown cleanup |
| ------------- | --------------- | ---------------- |
| `cli` (Bun)   | yes (unchanged) | yes (unchanged)  |
| `ohos` (Electron) | yes (new)   | yes (new)         |

Tests: `packages/core-routes/src/cleanup.test.ts` covers
`cleanupStalePlans` end-to-end, the explicit `ChatFs` override,
logger lifecycle (start / per-file / summary / warn) and the
`[cleanup]` prefix contract.
`packages/core-routes/src/tools/plans.test.ts` covers
`cleanPreparingPlans` (removes only `preparing` plans, no-op on
empty plans dir).

# @smm/core-routes

## 1.4.0

### Minor Changes

- 7204a61: feat(core-routes): extract startup/shutdown plan cleanup into shared module, run on OHOS too

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

  | Host              | Startup cleanup | Shutdown cleanup |
  | ----------------- | --------------- | ---------------- |
  | `cli` (Bun)       | yes (unchanged) | yes (unchanged)  |
  | `ohos` (Electron) | yes (new)       | yes (new)        |

  Tests: `packages/core-routes/src/cleanup.test.ts` covers
  `cleanupStalePlans` end-to-end, the explicit `ChatFs` override,
  logger lifecycle (start / per-file / summary / warn) and the
  `[cleanup]` prefix contract.
  `packages/core-routes/src/tools/plans.test.ts` covers
  `cleanPreparingPlans` (removes only `preparing` plans, no-op on
  empty plans dir).

### Patch Changes

- v1.3.9
- 89a8a49: fix(ai-tools): reject non-existent files in `add-rename-file` and `add-recognized-file`

  The AI Assistant `add-rename-file-to-task`, `add-recognized-media-file`,
  and the matching MCP tools (`add-rename-file`, `add-recognized-file`)
  silently accepted paths that did not exist on disk. The user would
  only discover the broken entry when the plan hit the confirmation
  dialog, by which point the AI had already committed to the plan and
  had no easy way to unwind it.

  The fix:
  - `appendRecognizedFile` in `@smm/core-routes` now runs a default
    filesystem-existence check (via `ChatFs.exists`) before writing
    the entry to the plan. Hosts can override the check through the
    new `RecognizeFilesTaskDeps` seam (mirrors `RenameFilesTaskDeps`).
  - `buildAddRecognizedMediaFileTool` accepts the deps so MCP and the
    CLI both wire in the same default validator.
  - The MCP `add-rename-file` and `add-recognized-file` handlers now
    surface the agent tool's `{ error: "..." }` result back to the
    client as `success: false`. Previously the handlers swallowed
    the result and reported success even when the underlying
    validation (filesystem, path-within-folder, episode-link) had
    failed.
  - The CLI `addRecognizedMediaFile` (`apps/cli`) now performs the
    same Bun-based existence check.
  - The frontend AI tool `AddRecognizedMediaFile` (`apps/ui`) calls
    `checkFileExists` (HTTP-backed `listFiles`) before persisting
    the plan via `/api/updatePlan`.

  Behaviour summary:

  | Tool                                               | Before  | After |
  | -------------------------------------------------- | ------- | ----- |
  | MCP `add-rename-file` (missing `from`)             | success | error |
  | MCP `add-recognized-file` (missing `path`)         | success | error |
  | AI Assistant `add-rename-file-to-task` (missing)   | error   | error |
  | AI Assistant `add-recognized-media-file` (missing) | success | error |
  | CLI `addRecognizedMediaFile` (missing)             | success | error |

  Tests: `packages/core-routes/src/tools/plans.test.ts` covers
  `defaultValidateRecognizedFiles`, `appendRecognizedFile` rejection
  without mutation, and the `validateFiles` override path. The
  real-fs integration test is skipped on Windows because of a
  pre-existing `@smm/core/path` POSIX→Windows conversion bug; the
  in-memory suite covers the same behaviour cross-platform.

- Updated dependencies
  - @smm/core@1.4.0

# ui

## 1.4.10

### Patch Changes

- v1.4.10
- Updated dependencies
  - @smm/core@1.4.10
  - @smm/tvdb4@1.3.18

## 1.4.9

### Patch Changes

- v1.4.9
- Updated dependencies
  - @smm/core@1.4.9
  - @smm/tvdb4@1.3.17

## 1.4.8

### Patch Changes

- v1.4.8
  - @smm/core@1.4.8

## 1.4.7

### Patch Changes

- v1.4.7
- Updated dependencies
  - @smm/core@1.4.7
  - @smm/tvdb4@1.3.16

## 1.4.6

### Patch Changes

- v1.4.6
- Updated dependencies
  - @smm/core@1.4.6
  - @smm/tvdb4@1.3.15

## 1.4.5

### Patch Changes

- v1.4.5
- Updated dependencies
  - @smm/core@1.4.5
  - @smm/tvdb4@1.3.14

## 1.4.4

### Patch Changes

- v1.4.4
- Updated dependencies
  - @smm/core@1.4.4
  - @smm/tvdb4@1.3.13

## 1.4.3

### Patch Changes

- v1.4.3
- Updated dependencies
  - @smm/core@1.4.3
  - @smm/tvdb4@1.3.12

## 1.4.2

### Patch Changes

- v1.4.2
- Updated dependencies
  - @smm/core@1.4.2
  - @smm/tvdb4@1.3.11

## 1.4.1

### Patch Changes

- v1.4.1
- Updated dependencies
  - @smm/core@1.4.1
  - @smm/tvdb4@1.3.10

## 1.4.0

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

- f4db473: fix(ohos): hide MusicPanel "Summarize" context-menu item on HarmonyOS

  The MusicPanel row right-click "Summarize" item (`LocalFileRow`) was
  ungated. The `useFeatures().isAiFeatureEnabled` flag is now read and
  the item is hidden when AI features are disabled. The default for
  `isAiFeatureEnabled` is now `false` on HarmonyOS (no bundled AI
  tools) and `true` on desktop, matching the OHOS no-CLI-tools policy
  documented in `docs/superpowers/design/harmonyos-integration.md` §6.

  The flag is a master switch — it also hides the AI Assistant chat
  and AI-based recognize/rename prompts on OHOS, which is the intended
  behavior. Existing localStorage `features.isAiFeatureEnabled` values
  are preserved, so users who explicitly enabled AI keep their setting.

- Updated dependencies
  - @smm/core@1.4.0
  - @smm/tvdb4@1.3.9

## 1.3.8

### Patch Changes

- v1.3.8
- Updated dependencies
  - @smm/tvdb4@1.3.8

## 1.3.7

### Patch Changes

- v1.3.7
- Updated dependencies
  - @smm/tvdb4@1.3.7

## 1.3.6

### Patch Changes

- v1.3.6
- Updated dependencies
  - @smm/tvdb4@1.3.6

## 1.3.5

### Patch Changes

- v1.3.5
- Updated dependencies
  - @smm/tvdb4@1.3.5

## 1.3.4

### Patch Changes

- v1.3.5
- Updated dependencies
  - @smm/tvdb4@1.3.4

## 1.3.3

### Patch Changes

- v1.3.4
- Updated dependencies
  - @smm/tvdb4@1.3.3

## 1.3.2

### Patch Changes

- v1.3.3
- Updated dependencies
  - @smm/tvdb4@1.3.2

## 1.3.1

### Patch Changes

- v1.3.1
- Updated dependencies
  - @smm/tvdb4@1.3.1

## 1.3.0

### Minor Changes

- ytdlp and videocaptioner integration

### Patch Changes

- Updated dependencies
  - @smm/tvdb4@1.3.0

## 1.2.5

### Patch Changes

- v1.2.5
- Updated dependencies
  - @smm/tvdb4@1.2.5

## 1.2.4

### Patch Changes

- v1.2.3
- Updated dependencies
  - @smm/tvdb4@1.2.4

## 1.2.3

### Patch Changes

- v1.2.3
- Updated dependencies
  - @smm/tvdb4@1.2.3

## 1.2.2

### Patch Changes

- Support downloading Bilibili Collection
- Updated dependencies
  - @smm/tvdb4@1.2.2

## 1.2.1

### Patch Changes

- Support transcribe for TV show and movie folder
- Updated dependencies
  - @smm/tvdb4@1.2.1

## 1.2.0

### Minor Changes

- Support TVDB

### Patch Changes

- Updated dependencies
  - @smm/tvdb4@1.2.0

## 1.1.6

### Patch Changes

- v1.1.6
- Updated dependencies
  - @smm/tvdb4@1.1.6

## 1.1.5

### Patch Changes

- v1.1.5

## 1.1.4

### Patch Changes

- 1.1.4

## 1.1.3

### Patch Changes

- New UI

## 1.1.2

### Patch Changes

- Video format converter

## 1.1.1

### Patch Changes

- yd-dlp integration

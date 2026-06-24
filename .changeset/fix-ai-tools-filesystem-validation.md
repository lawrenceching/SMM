---
"@smm/core-routes": patch
"cli": patch
"ui": patch
---

fix(ai-tools): reject non-existent files in `add-rename-file` and `add-recognized-file`

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

| Tool                                            | Before | After   |
| ----------------------------------------------- | ------ | ------- |
| MCP `add-rename-file` (missing `from`)          | success | error   |
| MCP `add-recognized-file` (missing `path`)      | success | error   |
| AI Assistant `add-rename-file-to-task` (missing) | error  | error   |
| AI Assistant `add-recognized-media-file` (missing) | success | error |
| CLI `addRecognizedMediaFile` (missing)           | success | error   |

Tests: `packages/core-routes/src/tools/plans.test.ts` covers
`defaultValidateRecognizedFiles`, `appendRecognizedFile` rejection
without mutation, and the `validateFiles` override path. The
real-fs integration test is skipped on Windows because of a
pre-existing `@smm/core/path` POSIX→Windows conversion bug; the
in-memory suite covers the same behaviour cross-platform.

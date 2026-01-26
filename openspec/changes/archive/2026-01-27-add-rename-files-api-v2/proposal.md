# Change: Add Rename Files API V2

## Why

The existing rename HTTP APIs (`/api/renameFile` and `/api/renameFileInBatch`) are single/batch file renames that always update media metadata and emit `mediaMetadataUpdated`. Callers that only need to rename files on disk (e.g. plan execution, scripting, or flows that manage metadata elsewhere) have no way to do a “rename-only” operation without triggering metadata updates and broadcasts. A dedicated `POST /api/renameFiles` that does pure renames, supports batch and optional tracing, and uses strict path validation (media folders and same-folder constraint) fills that gap and simplifies migration to a single, well-scoped contract.

## What Changes

- Add `POST /api/renameFiles` in the cli module that:
  - Accepts a batch of `{ from, to }` pairs and an optional `traceId`.
  - Uses **platform-specific** paths: POSIX on Linux/macOS, Windows format on Windows.
  - Does **not** emit `mediaMetadataUpdated` and does **not** update media metadata.
  - Returns which renames succeeded and which failed (e.g. `succeeded: string[]`, `failed: { path: string, error: string }[]` or equivalent).
  - Validates that every `from` is under one of `userConfig.folders` and every `to` is in the same directory as its `from` (no moving files across folders).
- **BREAKING:** Deprecate and remove `POST /api/renameFile` and `POST /api/renameFileInBatch`. Callers must migrate to `POST /api/renameFiles`.

## Capabilities

### New Capabilities

- `rename-files-api`: Contract and requirements for `POST /api/renameFiles` (request/response shape, validation rules, platform-specific paths, no metadata/broadcast, succeeded/failed reporting).

### Modified Capabilities

- (none — existing `openspec/specs/` do not define the current rename HTTP APIs)

## Impact

- **cli**: New route/handler for `POST /api/renameFiles`; removal of `/api/renameFile` and `/api/renameFileInBatch` routes and their handlers; shared validation and rename logic may be refactored for reuse.
- **core/types.ts**: New request/response types for renameFiles (e.g. `RenameFilesRequestBody`, `RenameFilesResponseBody`); possible deprecation/removal of `FileRenameRequestBody`, `FileRenameResponseBody`, `FileRenameInBatchRequestBody`, `FileRenameInBatchResponseBody` or their usages.
- **ui**: Any code calling `/api/renameFile` or `/api/renameFileInBatch` must switch to `POST /api/renameFiles` and handle the new request/response shape.
- **Docs**: `cli/docs/MediaFolderOperationAPI.md` and any other references to the old endpoints must be updated or removed.

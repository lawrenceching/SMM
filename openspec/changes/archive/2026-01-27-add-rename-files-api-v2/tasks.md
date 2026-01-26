# Tasks: Add Rename Files API V2

## 1. Types and validation (core + cli)

- [x] 1.1 In `core/types.ts`, add `RenameFilesRequestBody` (`files: { from: string, to: string }[]`, `traceId?: string`) and `RenameFilesResponseBody` (`data?: { succeeded: string[], failed: { path: string, error: string }[] }`, `error?: string`).
- [x] 1.2 In cli, add validation for rename-files-api: (a) load `userConfig` via `getUserConfig()`, (b) for each `from`, require it is under one of `userConfig.folders` (platform-aware), (c) for each pair, require `to` is in the same directory as `from`. Reuse or adapt existing path-under-folder and same-dir checks; add a small module or functions used only by the new route.

## 2. POST /api/renameFiles handler and route

- [x] 2.1 Implement the `POST /api/renameFiles` handler: parse body, run validation from 1.2, then perform renames (reuse `executeRenameOperation` or batch execution logic) without calling `updateMediaMetadataAndBroadcast` or emitting `mediaMetadataUpdated`. Return `{ data: { succeeded, failed } }` or `{ error }` with HTTP 200.
- [x] 2.2 Register `POST /api/renameFiles` in the cli app (same Hono app that currently exposes rename routes); ensure it uses the new types and validation.

## 3. Remove old endpoints and obsolete types

- [x] 3.1 Completely remove `POST /api/renameFile` and `POST /api/renameFileInBatch`: delete their route registrations and handler functions from the cli (e.g. in `RenameFile.ts`). If that file only hosted these routes, remove the file and any wiring that imports it.
- [x] 3.2 In `core/types.ts`, remove `FileRenameRequestBody`, `FileRenameResponseBody`, `FileRenameInBatchRequestBody`, and `FileRenameInBatchResponseBody`. Fix or remove any remaining imports (cli, electron, ui) that reference these types—e.g. point ui to the new `RenameFiles*` types or a local type until UI is migrated to the new API.

## 4. Documentation

- [x] 4.1 In `cli/docs/MediaFolderOperationAPI.md`, add documentation for `POST /api/renameFiles` and remove or replace sections for `/api/renameFile` and `/api/renameFileInBatch` so the doc describes only the new endpoint.

## 5. Deferred (future change)

UI migration is **out of scope** for this change and will be arranged later:

- Add `ui/src/api/renameFiles.ts` and update UI callers (`useTvShowRenaming`, `episode-file.tsx`, etc.) to use `POST /api/renameFiles`. Update or remove `ui/src/api/renameFile.ts` once no longer used.

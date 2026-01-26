# Design: Rename Files API V2

## Context

The app currently exposes `POST /api/renameFile` (single) and `POST /api/renameFileInBatch` (batch). Both take a `mediaFolder` and `from`/`to` paths, run validation and rename, then call `updateMediaMetadataAndBroadcast`. That forces every HTTP caller to trigger metadata updates and Socket.IO broadcasts even when they only need filesystem renames (e.g. executing a rename plan, scripts, or flows that manage metadata separately). User-configurable media roots are in `UserConfig.folders` (`core/types.ts`), loaded via `getUserConfig()` from the cli config layer. Path handling uses `Path` from `@core/path` and follows the project rule: paths are platform-specific (POSIX on Linux/macOS, Windows format on Windows). The API design guideline mandates 200 for HTTP success and business errors in the `error` field of the JSON body.

## Goals / Non-Goals

**Goals:**

- Add `POST /api/renameFiles` that performs rename-only operations: no media metadata updates, no `mediaMetadataUpdated` broadcast.
- Support batch renames and an optional `traceId` for correlation.
- Use platform-specific paths for `from` and `to` and validate that every `from` is under one of `userConfig.folders` and every `to` is in the same directory as its `from`.
- Return per-item results: succeeded paths and failed items with path and error.
- Deprecate and remove `/api/renameFile` and `/api/renameFileInBatch` after callers are migrated.

**Non-Goals:**

- Changing how rename plans (e.g. V2 tools) persist or execute; they can call the new API when executing.
- Adding dry-run or preview modes in this change.
- Changing `Path` or `UserConfig` semantics beyond using them for validation.

## Decisions

### Request/response shape

- **Decision:** Request body: `{ files: { from: string, to: string }[], traceId?: string }`. Response body: `{ data?: { succeeded: string[], failed: { path: string, error: string }[] }, error?: string }`. Use the same top-level `data`/`error` pattern as other RPC-style APIs.
- **Rationale:** Aligns with existing API style; `succeeded` and `failed` make partial success explicit and testable.
- **Alternatives considered:** Single `results: { path, success, error? }[]`; kept `succeeded`/`failed` for clarity and to match “files succeeded to rename and failed to update” wording.

### Path format and validation authority

- **Decision:** `from` and `to` are in platform-specific format. Allowable roots are `userConfig.folders` (no separate `mediaFolder` in the request). For each pair, require: (1) `from` is under one of `userConfig.folders`, and (2) `to` is in the same directory as `from` (so renames stay within that folder).
- **Rationale:** Uses the single source of truth for media folders and prevents moving files across folders via this API.
- **Alternatives considered:** Keeping a `mediaFolder` argument was rejected so the API cannot be used to rename outside configured folders.

### No metadata update or broadcast

- **Decision:** The handler must not call `updateMediaMetadataAndBroadcast` or any logic that emits `mediaMetadataUpdated`. It may reuse `executeRenameOperation`/`executeBatchRenameOperations`-style logic for the actual renames, but must not trigger metadata or Socket.IO updates.
- **Rationale:** Clear contract for “rename-only”; callers that need metadata can do it in a separate step or a different API.

### Where validation runs

- **Decision:** Implement validation in the cli (route or a dedicated module) that: (a) loads `userConfig` via existing `getUserConfig()`, (b) checks each `from` against `userConfig.folders` using path-under-folder logic (respecting platform), (c) checks each `to` is in the same directory as its `from`. Reuse or adapt existing validation helpers (e.g. path-under-folder, source exists, destination does not exist) where they accept platform-specific paths; add new logic for “under one of folders” and “same directory as from.”
- **Rationale:** Keeps validation next to the API and avoids coupling the new contract to the old `mediaFolder`-scoped helpers that assume a single folder.

### Removal of old endpoints

- **Decision:** Remove the `POST /api/renameFile` and `POST /api/renameFileInBatch` route registrations and their handler code in the same change that adds `POST /api/renameFiles`. Update or remove types only used by those endpoints (e.g. `FileRenameRequestBody`, `FileRenameInBatchRequestBody` and their response types) as part of this change.
- **Rationale:** Single breaking change and a single migration path to the new API.

## Risks / Trade-offs

- **Callers must migrate:** UI or other clients calling the old endpoints will break. Mitigation: Implement the new API and migrate all known callers (e.g. plan execution, any UI that calls rename) in the same change or in a coordinated follow-up; document the switch in release notes.
- **Partial failure semantics:** Some renames can succeed while others fail. Mitigation: Response shape and spec make this explicit; callers can retry or report per path.

## Migration Plan

1. Add `POST /api/renameFiles` with types, validation, and handler.
2. Identify and update all callers of `/api/renameFile` and `/api/renameFileInBatch` to use `POST /api/renameFiles` with the new request/response shape.
3. Remove the two old routes and their handlers; remove or repurpose obsolete request/response types.
4. Update `cli/docs/MediaFolderOperationAPI.md` (and any other docs) to describe only the new endpoint.
5. Rollback: Revert the commit(s); previous callers must be reverted as well to use the old endpoints again.

## Open Questions

- None at this time.

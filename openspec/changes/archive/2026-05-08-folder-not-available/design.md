## Context

The UI already defines `UIMediaFolderStatus` including `folder_not_found` (`apps/ui/src/types/UIMediaFolder.ts`). Media folders are hydrated from persisted `UserConfig` into `uiMediaFolderStore` during initialization (`UIMediaFolderStoreInitializer`, `useSyncUIMediaFolderStoreFromUserConfig`). The CLI exposes HTTP APIs via Hono (e.g. `POST /api/listFiles`). There is no endpoint yet that answers “is this absolute path currently usable as a directory?”.

## Goals / Non-Goals

**Goals:**

- Provide a single, cheap HTTP check the UI can call after config sync to mark folders `folder_not_found` when the path is missing, not a directory, or inaccessible (e.g. disconnected drive).
- Route `AppV2` so the selected folder with `folder_not_found` shows a dedicated **Folder not available** panel instead of TvShow / Movie / Music / local file panels.
- Keep persistence unchanged: config still lists paths; availability is runtime state.

**Non-Goals:**

- Automatically removing missing folders from `UserConfig`.
- Polling or watching the filesystem for paths coming back online (can be a follow-up).
- Perfect distinction between “not found” vs “permission denied” in the UI (may map both to unavailable unless we decide otherwise in implementation).

## Decisions

1. **Endpoint shape: `POST /api/isFolderAvailable`**

   - **Request body**: JSON with a single normalized path field (align name with similar routes, e.g. `path` as string).
   - **Response**: JSON boolean or object, e.g. `{ available: boolean }`, so the UI can branch without parsing errors as “available”.
   - **Rationale**: POST avoids encoding issues with long Windows paths in query strings; consistent with other mutating/query-body routes.

2. **Server-side check**

   - Use Node/Bun `fs` (or existing project helpers) to verify the path exists and `stat` indicates a directory (or symlink to directory). Treat any thrown error or non-directory as `available: false`.
   - **Alternatives**: Shelling out — rejected (slower, harder to secure). Client-only check — rejected (Electron security / inconsistent with CLI as source of truth for FS).

3. **When the UI runs the check**

   - After folders from user config are reflected in the store (same phase as `UIMediaFolderStoreInitializer` today), issue one request per configured folder (or a future batched API — **non-goal** for v1 unless trivial). Update each folder’s `status` to `folder_not_found` when `available` is false; otherwise proceed with existing initialization flows (e.g. toward metadata loading) without regressing current `ok` / loading transitions.

4. **Panel selection in `AppV2`**

   - Centralize: if active `UIMediaFolder.status === 'folder_not_found'`, render `FolderNotAvailablePanel`; else existing panel switch by media type / mode.

5. **i18n**

   - User-facing copy for the new panel SHALL use existing i18n patterns (`react-i18next`) and locale files under `apps/ui/public/locales/`.

## Risks / Trade-offs

- **Many folders → many requests on startup** → Acceptable for typical library sizes; batch endpoint can be added later.
- **Race: folder disappears after check** → Existing operations may still fail; panel can be updated on next navigation or refetch if we add refresh later.
- **Path normalization mismatch** → Reuse the same path string the app already stores and sends to other APIs (`listFiles`, metadata) to stay consistent.

## Migration Plan

No data migration. Deploy CLI + UI together so the UI does not call a missing route; if rolled back, UI should tolerate API errors (keep prior behavior or mark error — implementation detail in tasks).

## Open Questions

- Whether to expose a distinguishable reason (`not_found` vs `permission_denied`) in API v1 — optional extension on response shape.
